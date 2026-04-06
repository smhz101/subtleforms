import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  TabPanel,
} from '@wordpress/components';
import { Button } from '../components/navigation';
import { useNavigate } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import { apiClient } from '../data';
import Icon from '../components/ui/Icon';
import './SubmissionDetailPage.scss';

// ─── Pipeline timeline helpers ──────────────────────────────────────────────

const ACTION_META = {
  save:    { iconName: 'Database', label: 'Store Submission' },
  email:   { iconName: 'Mail',     label: 'Send Email' },
  webhook: { iconName: 'Zap',      label: 'Call Webhook' },
};

const getActionMeta = ( actionType ) =>
  ACTION_META[ actionType ] || { iconName: 'Settings', label: actionType || 'Step' };

/** Group log rows into per-step objects, preserving order of first appearance. */
const buildTimeline = ( logs ) => {
  const map = new Map();
  logs.forEach( ( log ) => {
    const ctx    = log.context  || {};
    const stepId = ctx.step_id || '__unknown__';
    if ( ! map.has( stepId ) ) {
      map.set( stepId, {
        stepId,
        actionType: ctx.action_type || stepId,
        entries:    [],
      } );
    }
    map.get( stepId ).entries.push( {
      status:    ctx.status  || '',
      level:     log.level,
      data:      ctx.data    || {},
      error:     ctx.error   || null,
      createdAt: log.created_at,
    } );
  } );
  return Array.from( map.values() );
};

/** Derive overall step status from its entries (last non-started + non-async). */
const stepStatus = ( entries ) => {
  const main = entries.filter(
    ( e ) => e.status !== 'started' && ! e.status.startsWith( 'async_' )
  );
  return main.length ? main[ main.length - 1 ].status : 'started';
};

const STATUS_LABEL = {
  succeeded:       'Succeeded',
  failed:          'Failed',
  skipped:         'Skipped',
  started:         'Started',
  async_completed: 'Completed',
  async_failed:    'Failed',
};

/** A single pipeline step card showing dispatch + async completion. */
const PipelineStepCard = ( { step } ) => {
  const [ open, setOpen ] = useState( false );
  const { iconName, label } = getActionMeta( step.actionType );
  const StepIcon = Icon[ iconName ] || Icon.Settings;
  const mainEntries  = step.entries.filter(
    ( e ) => ! e.status.startsWith( 'async_' ) && e.status !== 'started'
  );
  const asyncEntries = step.entries.filter( ( e ) => e.status.startsWith( 'async_' ) );
  const mainEntry    = mainEntries[ mainEntries.length - 1 ] || step.entries[ 0 ];
  const status       = stepStatus( step.entries );
  const hasData      = mainEntry && Object.keys( mainEntry.data ).length > 0;
  const hasAsync     = asyncEntries.length > 0;

  return (
    <div className={ `sf-pipe-step sf-pipe-step--${ status }` }>
      {/* Header row */}
      <div
        className={ `sf-pipe-step__head${ hasData || hasAsync ? ' sf-pipe-step__head--clickable' : '' }` }
        onClick={ () => ( hasData || hasAsync ) && setOpen( ( v ) => ! v ) }
        role={ hasData || hasAsync ? 'button' : undefined }
        tabIndex={ hasData || hasAsync ? 0 : undefined }
        onKeyDown={ ( e ) => e.key === 'Enter' && ( hasData || hasAsync ) && setOpen( ( v ) => ! v ) }
      >
        <span className='sf-pipe-step__icon' aria-hidden='true'><StepIcon size={ 14 } strokeWidth={ 2 } /></span>
        <span className='sf-pipe-step__label'>{ label }</span>
        <span className='sf-pipe-step__stepid'>{ step.stepId }</span>
        <span className={ `sf-pipe-status sf-pipe-status--${ status }` }>
          { STATUS_LABEL[ status ] || status }
        </span>
        { mainEntry && (
          <span className='sf-pipe-step__time'>{ mainEntry.createdAt }</span>
        ) }
        { ( hasData || hasAsync ) && (
          <span className='sf-pipe-step__toggle' aria-hidden='true'>
            { open ? '▲' : '▼' }
          </span>
        ) }
      </div>

      {/* Expandable body */}
      { open && (
        <div className='sf-pipe-step__body'>
          { hasData && (
            <div className='sf-pipe-step__section'>
              <div className='sf-pipe-step__section-title'>
                { __( 'Action details', 'subtleforms' ) }
              </div>
              <dl className='sf-pipe-data'>
                { Object.entries( mainEntry.data ).map( ( [ k, v ] ) => (
                  <div key={ k } className='sf-pipe-data__row'>
                    <dt className='sf-pipe-data__key'>{ k.replace( /_/g, ' ' ) }</dt>
                    <dd className='sf-pipe-data__val'>
                      { Array.isArray( v )
                        ? v.join( ', ' )
                        : typeof v === 'boolean'
                        ? ( v ? 'Yes' : 'No' )
                        : String( v ) }
                    </dd>
                  </div>
                ) ) }
              </dl>
            </div>
          ) }

          { mainEntry && mainEntry.error && (
            <div className='sf-pipe-step__section sf-pipe-step__section--error'>
              <div className='sf-pipe-step__section-title'>{ __( 'Error', 'subtleforms' ) }</div>
              <p className='sf-pipe-error-msg'>{ mainEntry.error }</p>
            </div>
          ) }

          { hasAsync && asyncEntries.map( ( ae, idx ) => (
            <div key={ idx } className='sf-pipe-step__section sf-pipe-step__section--async'>
              <div className='sf-pipe-step__section-title sf-pipe-step__section-title--async'>
                <span aria-hidden='true'>↓</span>
                &nbsp;{ ae.status === 'async_completed'
                  ? __( 'Async result', 'subtleforms' )
                  : __( 'Async failure', 'subtleforms' ) }
              </div>
              <dl className='sf-pipe-data'>
                { Object.entries( ae.data ).map( ( [ k, v ] ) => (
                  <div key={ k } className='sf-pipe-data__row'>
                    <dt className='sf-pipe-data__key'>{ k.replace( /_/g, ' ' ) }</dt>
                    <dd className={ `sf-pipe-data__val${ k === 'http_status' && Number( v ) >= 400 ? ' sf-pipe-data__val--error' : '' }` }>
                      { Array.isArray( v )
                        ? v.join( ', ' )
                        : typeof v === 'boolean'
                        ? ( v ? 'Yes' : 'No' )
                        : String( v ) }
                    </dd>
                  </div>
                ) ) }
                { ae.error && (
                  <div className='sf-pipe-data__row'>
                    <dt className='sf-pipe-data__key'>{ __( 'error', 'subtleforms' ) }</dt>
                    <dd className='sf-pipe-data__val sf-pipe-data__val--error'>{ ae.error }</dd>
                  </div>
                ) }
              </dl>
              <span className='sf-pipe-step__async-time'>{ ae.createdAt }</span>
            </div>
          ) ) }
        </div>
      ) }
    </div>
  );
};

/**
 * Recursively render object or array values in a readable format
 * @param {any} data - The data to render
 * @returns JSX.Element
 */
const renderReadableData = (data) => {
  // Handle arrays
  if (Array.isArray(data)) {
    return (
      <ul className="sf-submission-field__list">
        {data.map((item, index) => (
          <li key={index}>{renderReadableData(item)}</li>
        ))}
      </ul>
    );
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    return (
      <div className="sf-submission-field__object">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="sf-submission-field__row">
            <strong className="sf-submission-field__key">
              {key.replace(/_/g, ' ')}:
            </strong>{' '}
            <span className="sf-submission-field__value">
              {renderReadableData(val)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Primitive values
  return <span>{String(data)}</span>;
};

export default function SubmissionDetailPage({ submissionId, onBack, formId }) {
  const routerNavigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [logs, setLogs] = useState([]);
  const [adjacent, setAdjacent] = useState({ next: null, prev: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    setLoading(true);
    setError(null);

    try {
      const [subData, logsData, adjData] = await Promise.all([
        apiClient.get(`/submissions/${submissionId}`),
        apiClient.get(`/submissions/${submissionId}/logs`),
        apiClient.get(
          `/submissions/${submissionId}/adjacent${
            formId ? `?form_id=${formId}` : ''
          }`
        ),
      ]);

      // ApiResponse wraps payloads in { data: ... } for consistency. Unwrap if present.
      setSubmission(subData && subData.data ? subData.data : subData);
      setLogs(
        Array.isArray(logsData)
          ? logsData
          : Array.isArray(logsData?.data)
          ? logsData.data
          : []
      );
      setAdjacent(adjData && adjData.data ? adjData.data : adjData);
    } catch (err) {
      setError(__('Failed to load submission', 'subtleforms'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!submission) return;

    setUpdating(true);
    try {
      await apiClient.put(`/submissions/${submission.id}`, { status: newStatus });
      setSubmission({ ...submission, status: newStatus });
    } catch (err) {
      setError(__('Failed to update status', 'subtleforms'));
    } finally {
      setUpdating(false);
    }
  };

  const getFieldLabel = (key) => {
    if (!submission?.schema?.fields) return key;

    // Recursively search for field in schema including nested fields
    const findField = (fields) => {
      for (const field of fields) {
        const fieldKey = field?.config?.key || field?.key;
        if (fieldKey === key) {
          return field?.config?.label || field?.label || key;
        }
        // Check children and fields properties
        const childFields = field?.children || field?.fields;
        if (Array.isArray(childFields)) {
          const found = findField(childFields);
          if (found) return found;
        }
      }
      return null;
    };

    return findField(submission.schema.fields) || key;
  };

  const navigate = (direction) => {
    const targetId = direction === 'next' ? adjacent.next : adjacent.prev;
    if (targetId) {
      routerNavigate(`/submissions/${targetId}${formId ? `?form_id=${formId}` : ''}`);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;
  if (!submission)
    return (
      <Notice status='warning'>
        {__('Submission not found', 'subtleforms')}
      </Notice>
    );

  const payload = submission.payload || {};
  const meta = submission.meta || {};
  const filteredPayload = showEmpty
    ? payload
    : Object.fromEntries(
        Object.entries(payload).filter(
          ([, value]) => value !== '' && value !== null && value !== undefined
        )
      );

  const timeline = buildTimeline( logs );
  const generalLogs = logs.filter(
    ( log ) => ! log.context || typeof log.context !== 'string' || log.context !== 'api'
  );
  const apiLogs = logs.filter(
    ( log ) => typeof log.context === 'string' && log.context === 'api'
  );

  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;
  if (!submission)
    return (
      <Notice status='warning'>
        {__('Submission not found', 'subtleforms')}
      </Notice>
    );

  // ─── computed values ─────────────────────────────────────────────────────
  const formType   = submission.schema?.metadata?.type || 'regular';
  const formTypeLabels = {
    regular:        __( 'Standard',       'subtleforms' ),
    conversational: __( 'Conversational', 'subtleforms' ),
    multistep:      __( 'Multi-Step',     'subtleforms' ),
    payment:        __( 'Payment',        'subtleforms' ),
  };
  const formTypeLabel = formTypeLabels[ formType ] || __( 'Standard', 'subtleforms' );

  const parsedBrowser = submission.user_agent
    ? submission.user_agent.match(
        /(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/
      )?.[0] || __( 'Unknown', 'subtleforms' )
    : __( 'N/A', 'subtleforms' );

  const parsedDevice = submission.user_agent
    ? /Mobile|Android|iPhone|iPad/.test( submission.user_agent )
      ? __( 'Mobile', 'subtleforms' )
      : __( 'Desktop', 'subtleforms' )
    : __( 'N/A', 'subtleforms' );

  const formatAbsDate = ( iso ) => {
    try {
      return new Date( iso ).toLocaleDateString( 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      } );
    } catch {
      return iso;
    }
  };

  const formatRelDate = ( iso ) => {
    try {
      const diff = Math.floor( ( Date.now() - new Date( iso ).getTime() ) / 1000 );
      if ( diff < 60 )    return sprintf( __( '%ds ago', 'subtleforms' ), diff );
      if ( diff < 3600 )  return sprintf( __( '%dm ago', 'subtleforms' ), Math.floor( diff / 60 ) );
      if ( diff < 86400 ) return sprintf( __( '%dh ago', 'subtleforms' ), Math.floor( diff / 3600 ) );
      return sprintf( __( '%dd ago', 'subtleforms' ), Math.floor( diff / 86400 ) );
    } catch {
      return '';
    }
  };

  const absDate = formatAbsDate( submission.created_at );
  const relDate = formatRelDate( submission.created_at );

  // 'read' status: any status other than 'unread' is treated as read
  const readStatus = submission.status === 'unread' ? 'unread' : 'read';

  // ─── header actions (lean: just navigation) ──────────────────────────────
  const actions = (
    <>
      <Button isSecondary onClick={ onBack }>
        ← { __( 'All Submissions', 'subtleforms' ) }
      </Button>
      <div className='sf-sub-nav'>
        <Button
          isSecondary
          disabled={ ! adjacent.prev }
          onClick={ () => navigate( 'prev' ) }>
          ← { __( 'Previous', 'subtleforms' ) }
        </Button>
        <Button
          isSecondary
          disabled={ ! adjacent.next }
          onClick={ () => navigate( 'next' ) }>
          { __( 'Next', 'subtleforms' ) } →
        </Button>
      </div>
    </>
  );

  // ─── render ──────────────────────────────────────────────────────────────
  return (
    <AdminShell
      title={ sprintf( __( 'Submission #%d', 'subtleforms' ), submission.id ) }
      actions={ actions }>

      <div className='sf-sub-layout'>

        {/* ═══════════════════ MAIN COLUMN ═══════════════════ */}
        <div className='sf-sub-main'>

          {/* ── Context Banner ── */}
          <div className={ `sf-sub-context sf-sub-context--${ formType }` }>
            <div className='sf-sub-context__left'>
              <span className={ `sf-type-badge sf-type-badge--${ formType }` }>
                { formTypeLabel }
              </span>
              { submission.form_title ? (
                <a
                  href={ `admin.php?page=subtleforms-forms&form_id=${ submission.form_id }` }
                  className='sf-sub-context__form-link'>
                  { submission.form_title }
                  <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='sf-sub-context__ext-icon' aria-hidden='true'><path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/><polyline points='15 3 21 3 21 9'/><line x1='10' y1='14' x2='21' y2='3'/></svg>
                </a>
              ) : (
                <span className='sf-sub-context__form-id'>
                  { sprintf( __( 'Form #%d', 'subtleforms' ), submission.form_id ) }
                </span>
              ) }
            </div>

            <div className='sf-sub-context__right'>
              <button
                type='button'
                className={ `sf-status-pill sf-status-pill--${ readStatus }` }
                onClick={ () =>
                  handleStatusChange(
                    readStatus === 'read' ? 'unread' : 'read'
                  )
                }
                disabled={ updating }
                aria-label={ readStatus === 'read'
                  ? __( 'Mark as unread', 'subtleforms' )
                  : __( 'Mark as read', 'subtleforms' ) }>
                <span className='sf-status-pill__dot' aria-hidden='true' />
                { readStatus === 'unread'
                  ? __( 'Unread', 'subtleforms' )
                  : __( 'Read', 'subtleforms' ) }
              </button>

              <div className='sf-sub-context__datetime' title={ submission.created_at }>
                <span className='sf-sub-context__date'>{ absDate }</span>
                <span className='sf-sub-context__rel'>{ relDate }</span>
              </div>
            </div>
          </div>

          {/* ── Submitted Data Card ── */}
          <div className='subtleforms-card'>
            <div className='sf-card-head'>
              <h2 className='sf-card-title'>{ __( 'Submitted Data', 'subtleforms' ) }</h2>
              <div className='sf-card-head__controls'>
                <label className='sf-field-toggle'>
                  <input
                    type='checkbox'
                    checked={ showEmpty }
                    onChange={ ( e ) => setShowEmpty( e.target.checked ) }
                  />
                  { __( 'Show empty fields', 'subtleforms' ) }
                </label>
                <label className='sf-field-toggle'>
                  <input
                    type='checkbox'
                    checked={ showTechnical }
                    onChange={ ( e ) => setShowTechnical( e.target.checked ) }
                  />
                  { __( 'Show field keys', 'subtleforms' ) }
                </label>
              </div>
            </div>

            { Object.keys( filteredPayload ).length > 0 ? (
              <div className='sf-field-list'>
                { Object.entries( filteredPayload ).map( ( [ key, value ] ) => {
                  const isEmpty =
                    value === '' || value === null || value === undefined ||
                    ( Array.isArray( value ) && value.length === 0 );
                  return (
                    <div key={ key } className={ `sf-field-row ${ isEmpty ? 'sf-field-row--empty' : '' }` }>
                      <div className='sf-field-row__meta'>
                        <span className='sf-field-row__label'>
                          { getFieldLabel( key ) }
                        </span>
                        { showTechnical && (
                          <code className='sf-field-row__key'>{ key }</code>
                        ) }
                      </div>
                      <div className='sf-field-row__value'>
                        { ! isEmpty ? (
                          typeof value === 'object' ? (
                            <div className='sf-field-row__object'>
                              { renderReadableData( value ) }
                            </div>
                          ) : (
                            <span className='sf-field-row__text'>
                              { String( value )
                                .split( '\n' )
                                .map( ( line, i, arr ) => (
                                  <span key={ i }>
                                    { line }
                                    { i < arr.length - 1 && <br /> }
                                  </span>
                                ) ) }
                            </span>
                          )
                        ) : (
                          <span className='sf-field-row__empty'>
                            { __( '(empty)', 'subtleforms' ) }
                          </span>
                        ) }
                      </div>
                    </div>
                  );
                } ) }
              </div>
            ) : (
              <div className='sf-empty-state'>
                <div className='sf-empty-state__icon'>
                  <Icon.FileText size={ 28 } strokeWidth={ 1.5 } />
                </div>
                <h3 className='sf-empty-state__title'>
                  { __( 'No Data Submitted', 'subtleforms' ) }
                </h3>
                <p className='sf-empty-state__desc'>
                  { __(
                    'This submission was recorded but contains no field data.',
                    'subtleforms'
                  ) }
                </p>
                <div className='sf-empty-state__help'>
                  <p>{ __( 'Possible causes:', 'subtleforms' ) }</p>
                  <ul>
                    <li>{ __( 'Form fields not configured with field keys', 'subtleforms' ) }</li>
                    <li>{ __( 'JavaScript error prevented data collection', 'subtleforms' ) }</li>
                    <li>{ __( 'Multi-step form field paths not collected', 'subtleforms' ) }</li>
                  </ul>
                  <p className='sf-empty-state__tip'>
                    <strong>{ __( 'Debug tip:', 'subtleforms' ) }</strong>{ ' ' }
                    { __( 'Check Execution Logs below for clues.', 'subtleforms' ) }
                  </p>
                </div>
              </div>
            ) }
          </div>

          {/* ── Technical section (shown when toggle is on) ── */}
          { showTechnical && (
            <div className='subtleforms-card'>
              <div className='sf-card-head'>
                <h2 className='sf-card-title'>
                  { __( 'Technical Details', 'subtleforms' ) }
                </h2>
              </div>
              <div className='sf-tech-grid'>
                <div className='sf-tech-section'>
                  <h4 className='sf-tech-section__title'>
                    { __( 'Raw Payload', 'subtleforms' ) }
                  </h4>
                  <pre className='sf-tech-code'>
                    { JSON.stringify( submission.payload, null, 2 ) }
                  </pre>
                </div>
                <div className='sf-tech-section'>
                  <h4 className='sf-tech-section__title'>
                    { __( 'Meta', 'subtleforms' ) }
                  </h4>
                  <pre className='sf-tech-code'>
                    { JSON.stringify( meta, null, 2 ) }
                  </pre>
                </div>
              </div>
            </div>
          ) }

          {/* ── Pipeline Timeline ── */}
          <div className='subtleforms-card'>
            <div className='sf-card-head'>
              <h2 className='sf-card-title'>
                { __( 'Pipeline', 'subtleforms' ) }
              </h2>
              <span className='sf-card-head__count'>
                { timeline.length }
              </span>
            </div>
            { timeline.length > 0 ? (
              <div className='sf-pipeline-timeline'>
                { timeline.map( ( step ) => (
                  <PipelineStepCard key={ step.stepId } step={ step } />
                ) ) }
              </div>
            ) : (
              <p className='sf-logs-empty'>
                <em>{ __( 'No pipeline activity recorded.', 'subtleforms' ) }</em>
              </p>
            ) }
          </div>

          {/* ── Execution Logs ── */}
          <div className='subtleforms-card'>
            <div className='sf-card-head'>
              <h2 className='sf-card-title'>
                { __( 'Execution Logs', 'subtleforms' ) }
              </h2>
              <span className='sf-card-head__count'>
                { logs.length }
              </span>
            </div>
            <TabPanel
              tabs={ [
                {
                  name: 'general',
                  title: sprintf(
                    __( 'General (%d)', 'subtleforms' ),
                    generalLogs.length
                  ),
                },
                {
                  name: 'api',
                  title: sprintf(
                    __( 'API Calls (%d)', 'subtleforms' ),
                    apiLogs.length
                  ),
                },
              ] }>
              { ( tab ) => {
                const displayLogs = tab.name === 'general' ? generalLogs : apiLogs;
                return displayLogs.length > 0 ? (
                  <div className='sf-log-table-wrap'>
                    <table className='sf-log-table'>
                      <thead>
                        <tr>
                          <th>{ __( 'Time', 'subtleforms' ) }</th>
                          <th>{ __( 'Level', 'subtleforms' ) }</th>
                          <th>{ __( 'Message', 'subtleforms' ) }</th>
                        </tr>
                      </thead>
                      <tbody>
                        { displayLogs.map( ( log, idx ) => (
                          <tr key={ idx }>
                            <td className='sf-log-table__time'>{ log.created_at }</td>
                            <td>
                              <span className={ `sf-log-level sf-log-level--${ log.level }` }>
                                { log.level }
                              </span>
                            </td>
                            <td className='sf-log-table__message'>{ log.message }</td>
                          </tr>
                        ) ) }
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className='sf-logs-empty'>
                    <em>{ __( 'No logs recorded.', 'subtleforms' ) }</em>
                  </p>
                );
              } }
            </TabPanel>
          </div>

        </div>{/* /sf-sub-main */}

        {/* ═══════════════════ SIDEBAR ═══════════════════════ */}
        <aside className='sf-sub-sidebar'>
          <div className='subtleforms-card sf-sub-sidebar__card'>

            {/* Status control — prominent at top */}
            <div className='sf-sidebar-status'>
              <div className='sf-sidebar-status__label'>
                { __( 'Status', 'subtleforms' ) }
              </div>
              <button
                type='button'
                className={ `sf-status-pill sf-status-pill--${ readStatus } sf-status-pill--lg` }
                onClick={ () =>
                  handleStatusChange(
                    readStatus === 'read' ? 'unread' : 'read'
                  )
                }
                disabled={ updating }>
                <span className='sf-status-pill__dot' aria-hidden='true' />
                { readStatus === 'unread'
                  ? __( 'Unread — click to mark read', 'subtleforms' )
                  : __( 'Read — click to mark unread', 'subtleforms' ) }
              </button>
            </div>

            <div className='sf-sidebar-divider' />

            {/* Submission section */}
            <div className='sf-sidebar-section'>
              <h3 className='sf-sidebar-section__title'>
                { __( 'Submission', 'subtleforms' ) }
              </h3>
              <dl className='sf-detail-list'>
                <div className='sf-detail-row'>
                  <dt>{ __( 'ID', 'subtleforms' ) }</dt>
                  <dd><code>#{submission.id}</code></dd>
                </div>
                <div className='sf-detail-row'>
                  <dt>{ __( 'Submitted', 'subtleforms' ) }</dt>
                  <dd title={ submission.created_at }>
                    <span className='sf-detail-date'>{ absDate }</span>
                    <span className='sf-detail-rel'>{ relDate }</span>
                  </dd>
                </div>
                <div className='sf-detail-row'>
                  <dt>{ __( 'User', 'subtleforms' ) }</dt>
                  <dd>
                    { meta.user_id
                      ? sprintf( __( 'User #%d', 'subtleforms' ), meta.user_id )
                      : __( 'Guest', 'subtleforms' ) }
                  </dd>
                </div>
              </dl>
            </div>

            <div className='sf-sidebar-divider' />

            {/* Form section */}
            <div className='sf-sidebar-section'>
              <h3 className='sf-sidebar-section__title'>
                { __( 'Form', 'subtleforms' ) }
              </h3>
              <dl className='sf-detail-list'>
                <div className='sf-detail-row'>
                  <dt>{ __( 'Name', 'subtleforms' ) }</dt>
                  <dd>
                    { submission.form_title ? (
                      <a
                        href={ `admin.php?page=subtleforms-forms&form_id=${ submission.form_id }` }
                        className='sf-detail-link'>
                        { submission.form_title }
                      </a>
                    ) : (
                      sprintf( __( 'Form #%d', 'subtleforms' ), submission.form_id )
                    ) }
                  </dd>
                </div>
                <div className='sf-detail-row'>
                  <dt>{ __( 'Type', 'subtleforms' ) }</dt>
                  <dd>
                    <span className={ `sf-type-badge sf-type-badge--${ formType } sf-type-badge--sm` }>
                      { formTypeLabel }
                    </span>
                  </dd>
                </div>
                <div className='sf-detail-row'>
                  <dt>{ __( 'Form ID', 'subtleforms' ) }</dt>
                  <dd><code>#{ submission.form_id }</code></dd>
                </div>
              </dl>
            </div>

            <div className='sf-sidebar-divider' />

            {/* Technical section */}
            <div className='sf-sidebar-section'>
              <h3 className='sf-sidebar-section__title'>
                { __( 'Technical', 'subtleforms' ) }
              </h3>
              <dl className='sf-detail-list'>
                <div className='sf-detail-row'>
                  <dt>{ __( 'IP Address', 'subtleforms' ) }</dt>
                  <dd><code>{ submission.ip_address || __( 'N/A', 'subtleforms' ) }</code></dd>
                </div>
                <div className='sf-detail-row'>
                  <dt>{ __( 'Browser', 'subtleforms' ) }</dt>
                  <dd>{ parsedBrowser }</dd>
                </div>
                <div className='sf-detail-row'>
                  <dt>{ __( 'Device', 'subtleforms' ) }</dt>
                  <dd>{ parsedDevice }</dd>
                </div>
                { meta.source_url && (
                  <div className='sf-detail-row sf-detail-row--full'>
                    <dt>{ __( 'Source URL', 'subtleforms' ) }</dt>
                    <dd>
                      <a
                        href={ meta.source_url }
                        target='_blank'
                        rel='noopener noreferrer'
                        className='sf-detail-link sf-detail-link--break'>
                        { meta.source_url }
                      </a>
                    </dd>
                  </div>
                ) }
              </dl>
            </div>

          </div>
        </aside>

      </div>{/* /sf-sub-layout */}
    </AdminShell>
  );
}
