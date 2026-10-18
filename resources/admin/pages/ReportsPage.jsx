import { useEffect, useState } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import FormAnalyticsPanel from '../components/analytics/FormAnalyticsPanel';
import { formatRate, useAnalyticsSummary } from '../components/analytics/useAnalytics';
import { apiGet } from '../utils/api';
import { requirePro } from '../utils/featureGate';
import './ReportsPage.scss';

const SAMPLE_FORMS = [
  { form_id: 1, title: 'Contact', views: 420, submissions: 64, conversion: 15.2 },
  { form_id: 2, title: 'Newsletter', views: 880, submissions: 210, conversion: 23.9 },
  { form_id: 3, title: 'Support', views: 190, submissions: 41, conversion: 21.6 },
];

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
  const max = Math.max( 1, ...series.map( ( day ) => day.count ) );
  const rows = summary.locked
    ? SAMPLE_FORMS
    : Object.values( summary.data?.forms || {} ).map( ( row ) => ( {
      ...row,
      title: forms.find( ( form ) => Number( form.id ) === Number( row.form_id ) )?.title
        || sprintf( __( 'Form #%d', 'subtleforms' ), row.form_id ),
    } ) );

  return (
    <AdminShell
      title={ __( 'Reports', 'subtleforms' ) }
      description={ __( 'How many people send a form. Views and conversion are part of Pro.', 'subtleforms' ) }
      isLoading={ ! overview && ! error }
      error={ error }>
      { overview && (
        <>
          <dl className='sf-reports__totals'>
            <div>
              <dt>{ __( 'Forms', 'subtleforms' ) }</dt>
              <dd>{ Number( overview.total_forms || 0 ).toLocaleString() }</dd>
            </div>
            <div>
              <dt>{ __( 'Submissions', 'subtleforms' ) }</dt>
              <dd>{ Number( overview.total_submissions || 0 ).toLocaleString() }</dd>
            </div>
            <div>
              <dt>{ __( 'Unread', 'subtleforms' ) }</dt>
              <dd>{ Number( overview.unread_submissions || 0 ).toLocaleString() }</dd>
            </div>
          </dl>
          <section className='sf-reports__chart'>
            <h2>{ __( 'Submissions, last 7 days', 'subtleforms' ) }</h2>
            <div className='sf-reports__bars'>
              { series.map( ( day ) => (
                <div key={ day.date } className='sf-reports__bar'>
                  <span style={ { height: `${ Math.max( 4, ( day.count / max ) * 100 ) }%` } } />
                  <em>{ day.count }</em>
                  <small>{ day.date.slice( 5 ) }</small>
                </div>
              ) ) }
            </div>
          </section>
        </>
      ) }

      <FormAnalyticsPanel forms={ forms } />

      <section className={ `sf-reports__table${ summary.locked ? ' is-locked' : '' }` }>
        <header>
          <h2>{ __( 'Each form, last 30 days', 'subtleforms' ) }</h2>
        </header>
        { summary.isLoading && ! summary.locked ? <Spinner /> : (
          <table>
            <thead>
              <tr>
                <th>{ __( 'Form', 'subtleforms' ) }</th>
                <th>{ __( 'Views', 'subtleforms' ) }</th>
                <th>{ __( 'Submissions', 'subtleforms' ) }</th>
                <th>{ __( 'Conversion', 'subtleforms' ) }</th>
              </tr>
            </thead>
            <tbody>
              { rows.map( ( row ) => (
                <tr key={ row.form_id }>
                  <td>{ row.title }</td>
                  <td>{ Number( row.views || 0 ).toLocaleString() }</td>
                  <td>{ Number( row.submissions || 0 ).toLocaleString() }</td>
                  <td>{ formatRate( row.conversion ) }</td>
                </tr>
              ) ) }
              { ! summary.locked && rows.length === 0 && (
                <tr><td colSpan='4'>{ __( 'No views yet.', 'subtleforms' ) }</td></tr>
              ) }
            </tbody>
          </table>
        ) }
        { summary.locked && (
          <div className='sf-reports__lock'>
            <p>{ __( 'Sample data. Views are already being counted.', 'subtleforms' ) }</p>
            <Button
              variant='primary'
              onClick={ () => requirePro( 'extensions.analytics', () => {}, { label: __( 'Reports', 'subtleforms' ) } ) }>
              { __( 'Unlock reports', 'subtleforms' ) }
            </Button>
          </div>
        ) }
      </section>
    </AdminShell>
  );
}
