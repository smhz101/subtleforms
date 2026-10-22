import { useEffect, useState } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import AdminShell from '../components/AdminShell';
import FormAnalyticsPanel from '../components/analytics/FormAnalyticsPanel';
import FunnelPanel from '../components/analytics/FunnelPanel';
import { formatRate, useAnalyticsSummary } from '../components/analytics/useAnalytics';
import ShowAllButton, { useShowAll } from '../components/analytics/ShowAll';
import { apiGet } from '../utils/api';
import './DashboardPage.scss';
import './ReportsPage.scss';
import { chartColumnProps } from '../utils/chartA11y';

const formatNumber = ( value ) => Number( value || 0 ).toLocaleString();

// Forms listed in "Each form" before "Show all".
export const REPORT_TOP_FORMS = 10;

/**
 * Rows for "Each form, last 30 days": most viewed first, then most sent.
 *
 * @param {Object} summaryForms Per-form totals keyed by form ID.
 * @param {Array}  forms        Forms ({ id, title }).
 * @return {Array} Rows with a title.
 */
export function reportRows( summaryForms, forms ) {
  return Object.values( summaryForms || {} )
    .map( ( row ) => ( {
      ...row,
      title: ( forms || [] ).find( ( form ) => Number( form.id ) === Number( row.form_id ) )?.title
        /* translators: %d: form ID */
        || sprintf( __( 'Form #%d', 'subtleforms' ), row.form_id ),
    } ) )
    .sort( ( a, b ) =>
      Number( b.views || 0 ) - Number( a.views || 0 )
      || Number( b.submissions || 0 ) - Number( a.submissions || 0 )
      || Number( a.form_id ) - Number( b.form_id ) );
}

export default function ReportsPage() {
  const [ overview, setOverview ] = useState( null );
  const [ error, setError ] = useState( '' );
  const summary = useAnalyticsSummary( 30 );

  useEffect( () => {
    let cancelled = false;
    apiGet( '/reports/overview' ).then( ( result ) => {
      if ( cancelled ) {
        return;
      }
      if ( result.ok ) {
        setOverview( result.body.data );
      } else {
        setError( result.body?.message || __( 'Reports could not be loaded.', 'subtleforms' ) );
      }
    } );
    return () => {
      cancelled = true;
    };
  }, [] );

  const forms = overview?.forms || [];
  const series = overview?.series || [];
  const week = series.reduce( ( sum, day ) => sum + Number( day.count || 0 ), 0 );
  const rows = reportRows( summary.data?.forms, forms );
  const formRows = useShowAll( rows, REPORT_TOP_FORMS );

  return (
    <AdminShell
      title={ __( 'Reports', 'subtleforms' ) }
      description={ __( 'How many people see and send each form. Spam, failed and trashed entries are not counted.', 'subtleforms' ) }
      isLoading={ ! overview && ! error }
      error={ error }>
      { overview && (
        <div className='sf-dash'>
          <section className='sf-kpis' aria-label={ __( 'Key figures', 'subtleforms' ) }>
            <Kpi label={ __( 'Forms', 'subtleforms' ) } value={ overview.total_forms } meta={ __( 'Not in the Trash', 'subtleforms' ) } />
            <Kpi label={ __( 'Submissions', 'subtleforms' ) } value={ overview.total_submissions } meta={ __( 'Every form', 'subtleforms' ) } />
            <Kpi
              label={ __( 'Unread', 'subtleforms' ) }
              value={ overview.unread_submissions }
              meta={ Number( overview.unread_submissions ) > 0 ? __( 'Waiting for review', 'subtleforms' ) : __( 'Inbox zero', 'subtleforms' ) }
              accent={ Number( overview.unread_submissions ) > 0 }
            />
            <Kpi label={ __( 'Last 7 days', 'subtleforms' ) } value={ week } meta={ __( 'Submissions received', 'subtleforms' ) } />
          </section>

          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <div>
                <h2 className='sf-panel__title'>{ __( 'Submissions', 'subtleforms' ) }</h2>
                <p className='sf-panel__subtitle'>{ __( 'Last 7 days', 'subtleforms' ) }</p>
              </div>
              <div className='sf-dash__trend-total'>
                <span className='sf-dash__trend-total-value'>{ formatNumber( week ) }</span>
                <span className='sf-dash__trend-total-label'>{ __( 'in period', 'subtleforms' ) }</span>
              </div>
            </header>
            <div className='sf-panel__body'>
              <TrendChart data={ series } />
            </div>
          </section>

          <FormAnalyticsPanel forms={ forms } />

          <FunnelPanel forms={ forms } />

          <section className='sf-panel sf-analytics-panel'>
            <header className='sf-panel__header'>
              <div>
                <h2 className='sf-panel__title'>{ __( 'Each form, last 30 days', 'subtleforms' ) }</h2>
                <p className='sf-panel__subtitle'>{ __( 'Conversion is submissions divided by views.', 'subtleforms' ) }</p>
              </div>
            </header>
            <div className='sf-panel__body sf-panel__body--flush'>
              { summary.isLoading ? (
                <div className='sf-reports__loading'><Spinner /></div>
              ) : (
                <div className='sf-analytics-panel__chart'>
                  <table className='sf-reports__table' id='sf-reports-forms'>
                    <thead>
                      <tr>
                        <th>{ __( 'Form', 'subtleforms' ) }</th>
                        <th>{ __( 'Views', 'subtleforms' ) }</th>
                        <th>{ __( 'Submissions', 'subtleforms' ) }</th>
                        <th>{ __( 'Conversion', 'subtleforms' ) }</th>
                      </tr>
                    </thead>
                    <tbody>
                      { formRows.visible.map( ( row ) => (
                        <tr key={ row.form_id }>
                          <td>{ row.title }</td>
                          <td>{ formatNumber( row.views ) }</td>
                          <td>{ formatNumber( row.submissions ) }</td>
                          <td>{ formatRate( row.conversion ) }</td>
                        </tr>
                      ) ) }
                      { rows.length === 0 && (
                        <tr><td colSpan='4'>{ __( 'No views yet.', 'subtleforms' ) }</td></tr>
                      ) }
                    </tbody>
                  </table>
                  <ShowAllButton
                    hidden={ formRows.hidden }
                    expanded={ formRows.expanded }
                    onToggle={ formRows.toggle }
                    controls='sf-reports-forms'
                    more={ sprintf(
                      /* translators: %d: number of forms */
                      _n( 'Show all %d form', 'Show all %d forms', rows.length, 'subtleforms' ),
                      rows.length
                    ) }
                    less={ __( 'Show fewer forms', 'subtleforms' ) }
                  />
                </div>
              ) }
            </div>
          </section>
        </div>
      ) }
    </AdminShell>
  );
}

function Kpi( { label, value, meta, accent = false } ) {
  return (
    <div className='sf-kpi'>
      <span className='sf-kpi__label'>
        { accent && <span className='sf-kpi__dot' aria-hidden='true' /> }
        { label }
      </span>
      <span className='sf-kpi__value'>{ formatNumber( value ) }</span>
      { meta && <span className='sf-kpi__meta'>{ meta }</span> }
    </div>
  );
}

function TrendChart( { data = [] } ) {
  const [ active, setActive ] = useState( null );
  if ( ! data.length ) {
    return null;
  }
  const max = Math.max( 1, ...data.map( ( day ) => day.count ) );
  const pow = 10 ** Math.floor( Math.log10( max ) );
  const n = max / pow;
  const niceMax = ( n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10 ) * pow;
  const formatDay = ( iso, opts ) => new Date( `${ iso }T00:00:00` ).toLocaleDateString( undefined, opts );
  const last = data.length - 1;

  return (
    <div className='sf-trend'>
      <div className='sf-trend__plot'>
        <div className='sf-trend__grid' aria-hidden='true'>
          <span data-value={ formatNumber( niceMax ) } />
          <span data-value={ formatNumber( niceMax / 2 ) } />
          <span data-value='0' />
        </div>
        <div className='sf-trend__bars' onMouseLeave={ () => setActive( null ) }>
          <ul className='screen-reader-text'>
            { data.map( ( day ) => (
              <li key={ day.date }>
                { sprintf(
                  /* translators: 1: date, 2: number of submissions */
                  _n( '%1$s: %2$s submission', '%1$s: %2$s submissions', day.count, 'subtleforms' ),
                  formatDay( day.date, { month: 'short', day: 'numeric' } ),
                  formatNumber( day.count )
                ) }
              </li>
            ) ) }
          </ul>
          { data.map( ( day, index ) => {
            const label = sprintf(
              /* translators: 1: date, 2: number of submissions */
              _n( '%1$s: %2$s submission', '%1$s: %2$s submissions', day.count, 'subtleforms' ),
              formatDay( day.date, { month: 'short', day: 'numeric' } ),
              formatNumber( day.count )
            );
            return (
              <div
                key={ day.date }
                className={ clsx( 'sf-trend__col', { 'is-active': active === index, 'is-today': index === last } ) }
                tabIndex={ 0 }
                { ...chartColumnProps( label ) }
                onMouseEnter={ () => setActive( index ) }
                onFocus={ () => setActive( index ) }
                onBlur={ () => setActive( null ) }>
                <span
                  className='sf-trend__bar'
                  style={ { height: day.count > 0 ? `max(${ ( day.count / niceMax ) * 100 }%, 3px)` : 0 } }
                />
                { active === index && (
                  <span className='sf-trend__tip' role='tooltip'>
                    <strong>{ formatNumber( day.count ) }</strong>
                    <span>{ formatDay( day.date, { weekday: 'short', month: 'short', day: 'numeric' } ) }</span>
                  </span>
                ) }
              </div>
            );
          } ) }
        </div>
      </div>
      <div className='sf-trend__axis' aria-hidden='true'>
        <span>{ formatDay( data[ 0 ].date, { month: 'short', day: 'numeric' } ) }</span>
        <span>{ formatDay( data[ Math.floor( last / 2 ) ].date, { month: 'short', day: 'numeric' } ) }</span>
        <span>{ __( 'Today', 'subtleforms' ) }</span>
      </div>
    </div>
  );
}
