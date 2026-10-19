import { submissionStatus } from '../utils/submissionStatus';
import { displayItems, displayLabel, displayRow, displayText } from '../utils/entryDisplay';
import { adminLabel } from '../../shared/fieldDisplay';
import { structuralType } from '../../shared/formType';
import { useState, useEffect, useRef } from '@wordpress/element';
import {
  Notice,
  TabPanel,
  Button,
  ToggleControl,
  TextareaControl,
  __experimentalConfirmDialog as ConfirmDialog,
} from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import { apiClient } from '../data';
import Icon from '../ui/Icon';
import { formatMoney } from '../../shared/pricing';
import './SubmissionDetailPage.scss';

// ─── Pipeline timeline helpers ──────────────────────────────────────────────

const ACTION_META = {
  save:    { iconName: 'Database', label: 'Store Submission' },
  email:   { iconName: 'Mail',     label: 'Send Email' },
  webhook: { iconName: 'Zap',      label: 'Call Webhook' },
  email_marketing: { iconName: 'Mail',     label: 'Email Marketing' },
  crm:     { iconName: 'Users',    label: 'CRM' },
  pdf:     { iconName: 'FileText', label: 'Entry PDF' },
};

/** Entry PDF (SubtleForms Pro). Cookie-authenticated REST link with a nonce. */
const pdfUrl = ( id ) => {
  const base = ( window.subtleformsAdmin?.restUrl || '/wp-json/subtleforms/v1' ).replace( /\/$/, '' );
  const nonce = window.wpApiSettings?.nonce || window.subtleformsAdmin?.restNonce || '';
  return `${ base }/entries/${ id }/pdf?_wpnonce=${ encodeURIComponent( nonce ) }`;
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

/**
 * Repeater answer (2.3.1): one row per group, one column per child field.
 */
export function RepeaterTable( { node, groups, submissionId, display } ) {
  const children = ( Array.isArray( node?.children ) && node.children.length ? node.children : node?.fields || [] )
    .filter( ( c ) => c && ( c.config?.key || c.key ) );
  // Column names and cell text come from the server formatter when sent.
  const columns = Array.isArray( display?.columns ) && display.columns.length
    ? display.columns
    : children.length
      ? children.map( ( c ) => ( { key: c.config?.key || c.key, label: adminLabel( c ) } ) )
      : Array.from( new Set( groups.flatMap( ( g ) => Object.keys( g || {} ) ) ) ).map( ( k ) => ( { key: k, label: k } ) );
  const cell = ( v, i, key ) => {
    if ( v === undefined || v === null || v === '' ) return '';
    if ( isSignatureImage( v ) ) return <img className='sf-answers__signature' src={ v } alt={ __( 'Signature', 'subtleforms' ) } />;
    // Files uploaded in a group get download links like any other upload (FA-03).
    if ( isFileList( v ) ) return <FileLinks files={ v } submissionId={ submissionId } />;
    const text = display?.cells?.[ i ]?.[ key ];
    if ( typeof text === 'string' ) return text;
    if ( Array.isArray( v ) ) return v.map( ( x ) => ( x && typeof x === 'object' ? x.label || JSON.stringify( x ) : String( x ) ) ).join( ', ' );
    if ( typeof v === 'object' ) return Object.values( v ).filter( Boolean ).join( ' ' );
    return String( v );
  };
  return (
    <div className='sf-answers__repeater'>
      <table className='sf-answers__repeater-table'>
        <thead>
          <tr>
            <th scope='col'>#</th>
            { columns.map( ( c ) => <th key={ c.key } scope='col'>{ c.label }</th> ) }
          </tr>
        </thead>
        <tbody>
          { groups.map( ( g, i ) => (
            <tr key={ i }>
              <th scope='row'>{ i + 1 }</th>
              { columns.map( ( c ) => <td key={ c.key }>{ cell( g?.[ c.key ], i, c.key ) }</td> ) }
            </tr>
          ) ) }
        </tbody>
      </table>
    </div>
  );
}

/**
 * Whether an answer is a drawn signature (a PNG or JPEG data URI). Only this
 * exact shape is ever used as an image source (2.3.3).
 */
export function isSignatureImage( value ) {
  return typeof value === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test( value );
}

/**
 * Whether an answer is a list of uploaded files ({ id, name, size }).
 */
function isFileList( value ) {
  return (
    Array.isArray( value ) &&
    value.length > 0 &&
    value.every( ( v ) => v && typeof v === 'object' && /^[a-f0-9]{32}$/.test( String( v.id || '' ) ) && 'name' in v )
  );
}

/**
 * Download links for uploaded files. Files are served by wp-admin with a
 * nonce check, never from a public URL.
 */
function FileLinks( { files, submissionId } ) {
  const admin = window.subtleformsAdmin || {};
  const base = String( admin.ajaxUrl || '/wp-admin/admin-ajax.php' ).replace( /admin-ajax\.php.*$/, 'admin-post.php' );
  const size = ( n ) => {
    const b = Number( n ) || 0;
    if ( b >= 1048576 ) return `${ ( b / 1048576 ).toFixed( 1 ) } MB`;
    if ( b >= 1024 ) return `${ Math.round( b / 1024 ) } KB`;
    return `${ b } B`;
  };
  return (
    <ul className='sf-answers__files'>
      { files.map( ( f ) => {
        const url = `${ base }?action=subtleforms_file&entry=${ encodeURIComponent( submissionId ) }&file=${ encodeURIComponent( f.id ) }${ admin.fileNonce ? `&_wpnonce=${ encodeURIComponent( admin.fileNonce ) }` : '' }`;
        return (
          <li key={ f.id }>
            <a href={ url }>
              <Icon.DownloadCloud size={ 14 } aria-hidden='true' />
              { String( f.name ) }
            </a>
            <span className='sf-answers__file-size'>{ size( f.size ) }</span>
          </li>
        );
      } ) }
    </ul>
  );
}

export default function SubmissionDetailPage({ submissionId, onBack, formId, embedded = false, onBrowse = null, onEntryChanged = null }) {
  const routerNavigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [logs, setLogs] = useState([]);
  const [adjacent, setAdjacent] = useState({ next: null, prev: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [updating, setUpdating] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    const requestId = ++requestRef.current;
    // Keep the previous entry on screen while the next one loads, so the
    // pane does not collapse to a spinner between Previous and Next.
    // A different entry must not keep showing the previous person's answers.
    if (!submission || String(submission.id) !== String(submissionId)) {
      setLoading(true);
    }
    setError(null);
    setConfirmResend(false);
    setConfirmDelete(false);

    try {
      const [subData, logsData, adjData] = await Promise.all([
        apiClient.get(`/submissions/${submissionId}`),
        apiClient.get(`/submissions/${submissionId}/logs`),
        onBrowse
          ? Promise.resolve(null)
          : apiClient.get(
              `/submissions/${submissionId}/adjacent${
                formId ? `?form_id=${formId}` : ''
              }`
            ),
      ]);
      if (requestId !== requestRef.current) {
        return;
      }

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
      if (requestId !== requestRef.current) {
        return;
      }
      setError(__('Failed to load submission', 'subtleforms'));
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
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

  // Read state lives in is_read; status is the pipeline result.
  const handleReadToggle = async () => {
    if (!submission) return;
    const nextRead = parseInt(submission.is_read, 10) === 1 ? 0 : 1;
    setUpdating(true);
    try {
      await apiClient.put(`/submissions/${submission.id}`, { is_read: nextRead });
      setSubmission({ ...submission, is_read: nextRead });
    } catch (err) {
      setError(__('Failed to update status', 'subtleforms'));
    } finally {
      setUpdating(false);
    }
  };

  // Star (2.3.0).
  const handleStarToggle = async () => {
    if (!submission) return;
    const next = parseInt(submission.starred, 10) === 1 ? 0 : 1;
    setUpdating(true);
    try {
      await apiClient.put(`/submissions/${submission.id}`, { starred: !!next });
      setSubmission({ ...submission, starred: next });
    } catch (err) {
      setError(__('Failed to update status', 'subtleforms'));
    } finally {
      setUpdating(false);
    }
  };

  // Resend notifications (2.3.0).
  const [resend, setResend] = useState({ busy: false, message: '', status: '' });
  const [confirmResend, setConfirmResend] = useState(false);
  const handleResend = async () => {
    setConfirmResend(false);
    setResend({ busy: true, message: '', status: '' });
    try {
      const res = await apiClient.post(`/submissions/${submission.id}/resend`, {});
      setResend({
        busy: false,
        status: 'success',
        message: sprintf(
          /* translators: %d: number of email notifications */
          _n('%d notification queued again.', '%d notifications queued again.', res?.count || 1, 'subtleforms'),
          res?.count || 1
        ),
      });
      loadSubmission();
    } catch (err) {
      setResend({
        busy: false,
        status: 'error',
        message: err?.message || __('The notifications could not be sent.', 'subtleforms'),
      });
    }
  };

  // Notes (2.3.0).
  const [noteText, setNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const addNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteBusy(true);
    try {
      const note = await apiClient.post(`/submissions/${submission.id}/notes`, { text });
      const notes = [...(submission.meta?.notes || []), note];
      setSubmission({ ...submission, meta: { ...(submission.meta || {}), notes } });
      setNoteText('');
    } catch (err) {
      setError(__('The note could not be saved.', 'subtleforms'));
    } finally {
      setNoteBusy(false);
    }
  };
  const removeNote = async (noteId) => {
    try {
      await apiClient.delete(`/submissions/${submission.id}/notes/${noteId}`);
      const notes = (submission.meta?.notes || []).filter((n) => n.id !== noteId);
      setSubmission({ ...submission, meta: { ...(submission.meta || {}), notes } });
    } catch (err) {
      setError(__('The note could not be deleted.', 'subtleforms'));
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  // In the Trash the entry is deleted for good; otherwise it moves to the
  // Trash, where it can be restored (2.3.1).
  const isTrashed = submission?.status === 'trash';
  const handleDelete = async () => {
    setConfirmDelete(false);
    setUpdating(true);
    try {
      await apiClient.delete(`/submissions/${submission.id}${isTrashed ? '?force=1' : ''}`);
      onEntryChanged?.();
      onBack();
    } catch (err) {
      setError(__('Failed to delete submission', 'subtleforms'));
      setUpdating(false);
    }
  };
  const handleRestore = async () => {
    setUpdating(true);
    try {
      const res = await apiClient.post(`/submissions/${submission.id}/restore`, {});
      setSubmission((prev) => ({ ...prev, status: res?.status || 'completed' }));
    } catch (err) {
      setError(__('The entry could not be restored. Please try again.', 'subtleforms'));
    }
    setUpdating(false);
  };

  const getFieldLabel = (key) => {
    // The server names fields the same way in every output (FLD2-12).
    const named = displayLabel(submission?.display, key);
    if (named) return named;
    if (!submission?.schema?.fields) return key;

    // Recursively search for field in schema including nested fields
    const findField = (fields) => {
      for (const field of fields) {
        const fieldKey = field?.config?.key || field?.key;
        if (fieldKey === key) {
          // The admin label names the field in entries (2.3.2).
          return adminLabel(field) || key;
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
    if (onBrowse) {
      if (direction === 'next') {
        onBrowse.onNext();
      } else {
        onBrowse.onPrev();
      }
      return;
    }
    const targetId = direction === 'next' ? adjacent.next : adjacent.prev;
    if (targetId) {
      routerNavigate(`/submissions/${targetId}${formId ? `?form_id=${formId}` : ''}`);
    }
  };
  const canPrev = onBrowse ? onBrowse.hasPrev : !!adjacent?.prev;
  const canNext = onBrowse ? onBrowse.hasNext : !!adjacent?.next;

  if (loading || error || !submission) {
    if (embedded) {
      return (
        <div className='sf-inbox-entry sf-inbox-entry--state' role='status'>
          <p>
            {loading
              ? __('Loading submission…', 'subtleforms')
              : error || __('Submission not found', 'subtleforms')}
          </p>
          {!loading && (
            <Button variant='secondary' onClick={loadSubmission}>
              {__('Try again', 'subtleforms')}
            </Button>
          )}
          <Button variant='tertiary' onClick={onBack}>
            {__('Close', 'subtleforms')}
          </Button>
        </div>
      );
    }
    return (
      <AdminShell
        title={__('Submission', 'subtleforms')}
        isLoading={loading}
        loadingLabel={__('Loading submission…', 'subtleforms')}
        error={!loading ? error || __('Submission not found', 'subtleforms') : null}
        onRetry={loadSubmission}
        actions={
          <Button variant='secondary' icon={<Icon.ArrowLeft size={16} />} onClick={onBack}>
            {__('All submissions', 'subtleforms')}
          </Button>
        }
      />
    );
  }

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

  // ─── computed values ─────────────────────────────────────────────────────
  // The structure decides between Standard and Multi-step (2.3.2).
  const formType   = structuralType( submission.schema || {} ) || 'regular';
  const formTypeLabels = {
    regular:        __( 'Standard',       'subtleforms' ),
    conversational: __( 'Conversational', 'subtleforms' ),
    'multi-step':   __( 'Multi-step',     'subtleforms' ),
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

  // Stored timestamps are UTC without a zone suffix.
  const toDate = ( value ) => {
    const raw = String( value || '' );
    return new Date( raw && ! /[zZ]|[+-]\d{2}:?\d{2}$/.test( raw ) ? `${ raw.replace( ' ', 'T' ) }Z` : raw );
  };

  const formatAbsDate = ( iso ) => {
    try {
      return toDate( iso ).toLocaleDateString( undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      } );
    } catch {
      return iso;
    }
  };

  const formatRelDate = ( iso ) => {
    try {
      const diff = Math.max( 0, Math.floor( ( Date.now() - toDate( iso ).getTime() ) / 1000 ) );
      if ( diff < 60 )    return __( 'just now', 'subtleforms' );
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

  const isUnread = parseInt( submission.is_read, 10 ) === 0;
  const canPdf =
    !! window.subtleformsAdmin?.hasProPlugin &&
    !! window.subtleformsAdmin?.capabilities?.[ 'extensions.pdf' ];
  const isFlagged = submission.status === 'flagged';
  const isStarred = parseInt( submission.starred, 10 ) === 1;
  const notes = Array.isArray( meta.notes ) ? meta.notes : [];

  // Field types, so answers can be shown the way they were typed.
  const fieldTypes = {};
  const repeaterNodes = {};
  ( function collect( list ) {
    ( list || [] ).forEach( ( f ) => {
      if ( ! f || typeof f !== 'object' ) return;
      const k = f.config?.key || f.key;
      if ( k ) {
        fieldTypes[ k ] = f.type;
      }
      // A Repeater's children are answered inside its groups.
      if ( f.type === 'repeat_container' ) {
        if ( k ) repeaterNodes[ k ] = f;
        return;
      }
      collect( f.children );
      collect( Array.isArray( f.fields ) ? f.fields : null );
      ( f.columns || [] ).forEach( ( c ) => Array.isArray( c ) && collect( c ) );
    } );
  } )( submission.schema?.fields );

  // Who sent it: a name and/or email pulled from the answers.
  const flatValue = ( v ) => {
    if ( v && typeof v === 'object' && ( v.first_name || v.last_name ) ) {
      return [ v.first_name, v.last_name ].filter( Boolean ).join( ' ' );
    }
    return typeof v === 'string' ? v : '';
  };
  const entries = Object.entries( payload );
  const findBy = ( re ) => {
    const hit = entries.find( ( [ k, v ] ) => re.test( k ) && flatValue( v ).trim() );
    return hit ? flatValue( hit[ 1 ] ).trim() : '';
  };
  const senderEmail = findBy( /e-?mail/i );
  const senderName = findBy( /^(full_?)?name$|name_group|your_name|first_name/i );
  const heading =
    senderName ||
    senderEmail ||
    sprintf( __( 'Submission #%d', 'subtleforms' ), submission.id );

  const pipeline = submissionStatus( submission.status );

  const actions = (
    <div className='sf-sub-toolbar'>
      <div className='sf-sub-toolbar__group' role='group' aria-label={ __( 'Browse submissions', 'subtleforms' ) }>
        { embedded && (
          <Button
            size='compact'
            icon={ <Icon.Close size={ 16 } /> }
            label={ __( 'Close', 'subtleforms' ) }
            showTooltip
            onClick={ onBack }
          />
        ) }
        <Button
          size='compact'
          icon={ <Icon.ChevronLeft size={ 16 } /> }
          label={ __( 'Newer submission', 'subtleforms' ) }
          showTooltip
          disabled={ ! canPrev }
          accessibleWhenDisabled
          onClick={ () => navigate( 'prev' ) }
        />
        <Button
          size='compact'
          icon={ <Icon.ChevronRight size={ 16 } /> }
          label={ __( 'Older submission', 'subtleforms' ) }
          showTooltip
          disabled={ ! canNext }
          accessibleWhenDisabled
          onClick={ () => navigate( 'next' ) }
        />
      </div>
      <div className='sf-sub-toolbar__group' role='group' aria-label={ __( 'Submission actions', 'subtleforms' ) }>
        { canPdf && (
          <Button
            size='compact'
            icon={ <Icon.FileText size={ 16 } /> }
            href={ pdfUrl( submission.id ) }
            target='_blank'
            rel='noopener noreferrer'>
            { __( 'PDF', 'subtleforms' ) }
          </Button>
        ) }
        <Button
          size='compact'
          icon={ isUnread ? <Icon.Eye size={ 16 } /> : <Icon.EyeOff size={ 16 } /> }
          onClick={ handleReadToggle }
          disabled={ updating }>
          { isUnread ? __( 'Mark read', 'subtleforms' ) : __( 'Mark unread', 'subtleforms' ) }
        </Button>
        <Button
          size='compact'
          icon={ <Icon.Star size={ 16 } fill={ isStarred ? 'currentColor' : 'none' } /> }
          isPressed={ isStarred }
          disabled={ updating }
          onClick={ handleStarToggle }>
          { isStarred ? __( 'Starred', 'subtleforms' ) : __( 'Star', 'subtleforms' ) }
        </Button>
        { ! isTrashed && (
          <Button
            size='compact'
            icon={ <Icon.Mail size={ 16 } /> }
            disabled={ updating || resend.busy }
            isBusy={ resend.busy }
            onClick={ () => setConfirmResend( true ) }>
            { __( 'Resend notifications', 'subtleforms' ) }
          </Button>
        ) }
        { ! isTrashed && (
          <Button
            size='compact'
            icon={ <Icon.AlertCircle size={ 16 } /> }
            isPressed={ isFlagged }
            disabled={ updating }
            onClick={ () => handleStatusChange( isFlagged ? 'completed' : 'flagged' ) }>
            { isFlagged ? __( 'Flagged', 'subtleforms' ) : __( 'Flag', 'subtleforms' ) }
          </Button>
        ) }
        { isTrashed && (
          <Button
            size='compact'
            variant='secondary'
            icon={ <Icon.Undo size={ 16 } /> }
            disabled={ updating }
            onClick={ handleRestore }>
            { __( 'Restore', 'subtleforms' ) }
          </Button>
        ) }
        <Button
          size='compact'
          isDestructive
          icon={ <Icon.Trash size={ 16 } /> }
          label={ isTrashed ? __( 'Delete permanently', 'subtleforms' ) : __( 'Move to Trash', 'subtleforms' ) }
          showTooltip
          disabled={ updating }
          onClick={ () => ( isTrashed ? setConfirmDelete( true ) : handleDelete() ) }
        />
      </div>
    </div>
  );

  const answers = Object.entries( filteredPayload );

  // ─── render ──────────────────────────────────────────────────────────────
  const entry = (
    <>

      { confirmResend && (
        <ConfirmDialog
          onConfirm={ handleResend }
          onCancel={ () => setConfirmResend( false ) }
          confirmButtonText={ __( 'Resend', 'subtleforms' ) }>
          { __( 'Send this entry’s email notifications again, with the answers as they were saved? Passwords are never included.', 'subtleforms' ) }
        </ConfirmDialog>
      ) }

      { resend.message && (
        <Notice
          status={ resend.status === 'error' ? 'error' : 'success' }
          onRemove={ () => setResend( { busy: false, message: '', status: '' } ) }
          className='sf-detail__notice'>
          { resend.message }
        </Notice>
      ) }

      { confirmDelete && (
        <ConfirmDialog
          onConfirm={ handleDelete }
          onCancel={ () => setConfirmDelete( false ) }
          confirmButtonText={ __( 'Delete permanently', 'subtleforms' ) }>
          { __( 'Delete this entry permanently? Its uploaded files are deleted too. This cannot be undone.', 'subtleforms' ) }
        </ConfirmDialog>
      ) }

      <div className='sf-detail'>
        <div className='sf-detail__main'>

          {/* ── Answers ── */}
          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>
                { __( 'Answers', 'subtleforms' ) }
                <span className='sf-panel__count'>{ answers.length }</span>
              </h2>
              <div className='sf-detail__toggles'>
                <ToggleControl
                  __nextHasNoMarginBottom
                  label={ __( 'Empty fields', 'subtleforms' ) }
                  checked={ showEmpty }
                  onChange={ setShowEmpty }
                />
                <ToggleControl
                  __nextHasNoMarginBottom
                  label={ __( 'Field keys', 'subtleforms' ) }
                  checked={ showTechnical }
                  onChange={ setShowTechnical }
                />
              </div>
            </header>

            { answers.length > 0 ? (
              <dl className='sf-answers'>
                { answers.map( ( [ key, value ] ) => {
                  const isEmpty =
                    value === '' || value === null || value === undefined ||
                    ( Array.isArray( value ) && value.length === 0 );
                  return (
                    <div key={ key } className={ `sf-answers__row${ isEmpty ? ' is-empty' : '' }` }>
                      <dt className='sf-answers__label'>
                        { getFieldLabel( key ) }
                        { showTechnical && <code className='sf-answers__key'>{ key }</code> }
                      </dt>
                      <dd className='sf-answers__value'>
                        { isEmpty ? (
                          <span className='sf-answers__empty'>{ __( 'No answer', 'subtleforms' ) }</span>
                        ) : repeaterNodes[ key ] && Array.isArray( value ) ? (
                          <RepeaterTable node={ repeaterNodes[ key ] } groups={ value } submissionId={ submission.id } display={ displayRow( submission.display, key ) } />
                        ) : isSignatureImage( value ) ? (
                          <img className='sf-answers__signature' src={ value } alt={ __( 'Signature', 'subtleforms' ) } />
                        ) : isFileList( value ) ? (
                          <FileLinks files={ value } submissionId={ submission.id } />
                        ) : Array.isArray( value ) && displayItems( submission.display, key ) ? (
                          <span className='sf-answers__chips'>
                            { displayItems( submission.display, key ).map( ( text, i ) => (
                              <span key={ i } className='sf-pill sf-pill--outline'>{ text }</span>
                            ) ) }
                          </span>
                        ) : typeof value === 'object' && displayRow( submission.display, key ) ? (
                          // Matrix, name and address answers read as the server
                          // formats them ("Mon: AM, PM", FA-10).
                          <span className='sf-answers__text sf-answers__text--multiline'>{ displayText( submission.display, key, value ) }</span>
                        ) : typeof value === 'object' ? (
                          <div className='sf-answers__object'>{ renderReadableData( value ) }</div>
                        ) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( String( value ) ) ? (
                          <a href={ `mailto:${ value }` }>{ String( value ) }</a>
                        ) : /^https?:\/\//.test( String( value ) ) ? (
                          <a href={ String( value ) } target='_blank' rel='noopener noreferrer'>
                            { String( value ) }
                          </a>
                        ) : fieldTypes[ key ] === 'rich_text' ? (
                          // Stored through a small tag allow-list on the server.
                          <span className='sf-answers__text sf-answers__text--rich' dangerouslySetInnerHTML={ { __html: String( value ) } } />
                        ) : (
                          <span className={ `sf-answers__text${ fieldTypes[ key ] === 'textarea' ? ' sf-answers__text--multiline' : '' }` }>{ displayText( submission.display, key, value ) }</span>
                        ) }
                      </dd>
                    </div>
                  );
                } ) }
              </dl>
            ) : (
              <div className='sf-empty'>
                <span className='sf-empty__icon'><Icon.FileText size={ 20 } /></span>
                <p className='sf-empty__title'>{ __( 'No answers recorded', 'subtleforms' ) }</p>
                <p className='sf-empty__text'>
                  { __( 'The entry was saved without field data. The activity log below usually explains why.', 'subtleforms' ) }
                </p>
              </div>
            ) }

            { showTechnical && (
              <details className='sf-detail__raw'>
                <summary>{ __( 'Raw payload and meta (JSON)', 'subtleforms' ) }</summary>
                <pre>{ JSON.stringify( { payload: submission.payload, meta }, null, 2 ) }</pre>
              </details>
            ) }
          </section>

          {/* ── Activity ── */}
          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>
                { __( 'What happened next', 'subtleforms' ) }
              </h2>
              <span className={ `sf-pill sf-pill--dot ${ pipeline.cls }` }>{ pipeline.label }</span>
            </header>
            <TabPanel
              className='sf-detail__tabs'
              tabs={ [
                { name: 'pipeline', title: sprintf( __( 'Actions (%d)', 'subtleforms' ), timeline.length ) },
                { name: 'general', title: sprintf( __( 'Log (%d)', 'subtleforms' ), generalLogs.length ) },
                { name: 'api', title: sprintf( __( 'API calls (%d)', 'subtleforms' ), apiLogs.length ) },
              ] }>
              { ( tab ) => {
                if ( tab.name === 'pipeline' ) {
                  return timeline.length > 0 ? (
                    <div className='sf-pipeline-timeline'>
                      { timeline.map( ( step ) => (
                        <PipelineStepCard key={ step.stepId } step={ step } />
                      ) ) }
                    </div>
                  ) : (
                    <p className='sf-logs-empty'>{ __( 'No actions ran for this entry.', 'subtleforms' ) }</p>
                  );
                }
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
                              <span className={ `sf-log-level sf-log-level--${ log.level }` }>{ log.level }</span>
                            </td>
                            <td className='sf-log-table__message'>{ log.message }</td>
                          </tr>
                        ) ) }
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className='sf-logs-empty'>{ __( 'Nothing logged.', 'subtleforms' ) }</p>
                );
              } }
            </TabPanel>
          </section>

          {/* SubtleForms Pro: integration log with request and response, retry (2.3.0). */}
          { window.SubtleFormsPro?.EntryIntegrations && ( () => {
            const EntryIntegrations = window.SubtleFormsPro.EntryIntegrations;
            return <EntryIntegrations submissionId={ submission.id } />;
          } )() }
        </div>

        {/* ── Sidebar ── */}
        <aside className='sf-detail__side'>
          <section className='sf-panel sf-notes-panel' aria-labelledby='sf-notes-title'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title' id='sf-notes-title'>
                { __( 'Notes', 'subtleforms' ) }
                { notes.length > 0 && <span className='sf-panel__count'>{ notes.length }</span> }
              </h2>
            </header>
            <div className='sf-panel__body'>
              { notes.length > 0 ? (
                <ul className='sf-notes'>
                  { notes.map( ( note ) => (
                    <li key={ note.id } className='sf-notes__item'>
                      <div className='sf-notes__meta'>
                        <strong>{ note.author_name || __( 'Unknown user', 'subtleforms' ) }</strong>
                        <span>{ formatAbsDate( note.created_at ) }</span>
                        <Button
                          size='small'
                          isDestructive
                          variant='tertiary'
                          icon={ <Icon.Trash size={ 14 } /> }
                          label={ __( 'Delete note', 'subtleforms' ) }
                          onClick={ () => removeNote( note.id ) }
                        />
                      </div>
                      <p className='sf-notes__text'>{ note.text }</p>
                    </li>
                  ) ) }
                </ul>
              ) : (
                <p className='sf-notes__empty'>{ __( 'Private notes for your team. Visitors never see them.', 'subtleforms' ) }</p>
              ) }
              <TextareaControl
                __nextHasNoMarginBottom
                label={ __( 'Add a note', 'subtleforms' ) }
                value={ noteText }
                rows={ 3 }
                onChange={ setNoteText }
              />
              <Button
                variant='secondary'
                size='compact'
                className='sf-notes__add'
                isBusy={ noteBusy }
                disabled={ noteBusy || ! noteText.trim() }
                onClick={ addNote }>
                { __( 'Add note', 'subtleforms' ) }
              </Button>
            </div>
          </section>

          { meta.order && (
            <section className='sf-panel sf-order-panel'>
              <header className='sf-panel__header'>
                <h2 className='sf-panel__title'>{ __( 'Order', 'subtleforms' ) }</h2>
                { ( () => {
                  const st = meta.payment?.status || 'pending';
                  const map = {
                    paid: [ 'sf-pill--success', __( 'Paid', 'subtleforms' ) ],
                    succeeded: [ 'sf-pill--success', __( 'Paid', 'subtleforms' ) ],
                    free: [ 'sf-pill--success', __( 'Free', 'subtleforms' ) ],
                    authorized: [ 'sf-pill--info', __( 'Authorised', 'subtleforms' ) ],
                    failed: [ 'sf-pill--danger', __( 'Failed', 'subtleforms' ) ],
                    refunded: [ 'sf-pill--outline', __( 'Refunded', 'subtleforms' ) ],
                    cancelled: [ 'sf-pill--danger', __( 'Cancelled', 'subtleforms' ) ],
                    pending: [ 'sf-pill--warning', __( 'Payment pending', 'subtleforms' ) ],
                  };
                  const [ cls, label ] = map[ st ] || map.pending;
                  return <span className={ `sf-pill sf-pill--dot ${ cls }` }>{ label }</span>;
                } )() }
              </header>
              <div className='sf-panel__body'>
                <ul className='sf-order-panel__items'>
                  { ( meta.order.items || [] ).map( ( item, i ) => (
                    <li key={ i }>
                      <span>
                        { item.label }
                        { item.qty > 1 && <span className='sf-order-panel__muted'> × { item.qty }</span> }
                      </span>
                      <span>{ formatMoney( item.amount, meta.order.currency ) }</span>
                    </li>
                  ) ) }
                </ul>
                <dl className='sf-order-panel__totals'>
                  { meta.order.discount > 0 && (
                    <>
                      <dt>{ sprintf( __( 'Coupon %s', 'subtleforms' ), meta.order.coupon || '' ) }</dt>
                      <dd>−{ formatMoney( meta.order.discount, meta.order.currency ) }</dd>
                    </>
                  ) }
                  { meta.order.tax > 0 && (
                    <>
                      <dt>{ sprintf( __( 'Tax (%s%%)', 'subtleforms' ), meta.order.tax_rate ) }</dt>
                      <dd>{ formatMoney( meta.order.tax, meta.order.currency ) }</dd>
                    </>
                  ) }
                  <dt className='is-total'>{ __( 'Total', 'subtleforms' ) }</dt>
                  <dd className='is-total'>{ formatMoney( meta.order.total, meta.order.currency ) }</dd>
                  { Number( meta.payment?.refunded ) > 0 && (
                    <>
                      <dt>{ __( 'Refunded', 'subtleforms' ) }</dt>
                      <dd>−{ formatMoney( Number( meta.payment.refunded ), meta.order.currency ) }</dd>
                    </>
                  ) }
                </dl>
                { meta.woocommerce?.order_id && (
                  <p className='sf-order-panel__ref sf-order-panel__woo'>
                    <a href={ meta.woocommerce.edit_url } target='_blank' rel='noopener noreferrer'>
                      { sprintf(
                        /* translators: 1: order number, 2: order status */
                        __( 'WooCommerce order #%1$s (%2$s)', 'subtleforms' ),
                        meta.woocommerce.number || meta.woocommerce.order_id,
                        meta.woocommerce.status_label || meta.woocommerce.status || ''
                      ) }
                      <Icon.ExternalLink size={ 12 } aria-hidden='true' />
                    </a>
                  </p>
                ) }
                { meta.payment?.transaction_id && ! meta.woocommerce?.order_id && (
                  <p className='sf-order-panel__ref'>
                    { meta.payment.gateway === 'stripe' ? (
                      <a
                        href={ `https://dashboard.stripe.com/${ meta.payment.mode === 'live' ? '' : 'test/' }payments/${ meta.payment.transaction_id }` }
                        target='_blank'
                        rel='noopener noreferrer'>
                        { __( 'View in Stripe', 'subtleforms' ) }
                        <Icon.ExternalLink size={ 12 } aria-hidden='true' />
                      </a>
                    ) : (
                      <code>{ meta.payment.transaction_id }</code>
                    ) }
                  </p>
                ) }
              </div>
            </section>
          ) }
          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>{ __( 'Details', 'subtleforms' ) }</h2>
              { isUnread && <span className='sf-pill sf-pill--brand'>{ __( 'Unread', 'subtleforms' ) }</span> }
            </header>
            <div className='sf-panel__body'>
              <dl className='sf-kv'>
                <dt>{ __( 'Entry', 'subtleforms' ) }</dt>
                <dd><code>#{ submission.id }</code></dd>
                <dt>{ __( 'Received', 'subtleforms' ) }</dt>
                <dd title={ submission.created_at }>{ absDate }</dd>
                <dt>{ __( 'Submitted by', 'subtleforms' ) }</dt>
                <dd>
                  { meta.user_id
                    ? sprintf( __( 'User #%d', 'subtleforms' ), meta.user_id )
                    : __( 'Guest', 'subtleforms' ) }
                </dd>
                <dt>{ __( 'Form', 'subtleforms' ) }</dt>
                <dd>
                  <a
                    href={ `admin.php?page=subtleforms-new-form&form_id=${ submission.form_id }` }
                    onClick={ ( e ) => {
                      e.preventDefault();
                      routerNavigate( `/forms/${ submission.form_id }` );
                    } }>
                    { submission.form_title || sprintf( __( 'Form #%d', 'subtleforms' ), submission.form_id ) }
                  </a>
                </dd>
                <dt>{ __( 'Form type', 'subtleforms' ) }</dt>
                <dd>{ formTypeLabel }</dd>
              </dl>
            </div>
          </section>

          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>{ __( 'Visitor', 'subtleforms' ) }</h2>
            </header>
            <div className='sf-panel__body'>
              <dl className='sf-kv'>
                <dt>{ __( 'IP address', 'subtleforms' ) }</dt>
                <dd><code>{ submission.ip_address || __( 'Not stored', 'subtleforms' ) }</code></dd>
                <dt>{ __( 'Browser', 'subtleforms' ) }</dt>
                <dd>{ parsedBrowser }</dd>
                <dt>{ __( 'Device', 'subtleforms' ) }</dt>
                <dd>{ parsedDevice }</dd>
                { meta.source_url && (
                  <>
                    <dt>{ __( 'Page', 'subtleforms' ) }</dt>
                    <dd>
                      <a href={ meta.source_url } target='_blank' rel='noopener noreferrer'>
                        { meta.source_url.replace( /^https?:\/\//, '' ) }
                      </a>
                    </dd>
                  </>
                ) }
              </dl>
            </div>
          </section>
        </aside>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className='sf-inbox-entry'>
        <header className='sf-inbox-entry__bar'>
          <div className='sf-inbox-entry__heading'>
            <h2>{ heading }</h2>
            <p>
              { sprintf(
                /* translators: 1: absolute date, 2: relative time */
                __( 'Received %1$s · %2$s', 'subtleforms' ),
                absDate,
                relDate
              ) }
            </p>
          </div>
          { actions }
        </header>
        <div className='sf-inbox-entry__body'>{ entry }</div>
      </div>
    );
  }

  return (
    <AdminShell
      eyebrow={
        <button type='button' className='sf-breadcrumb' onClick={ onBack }>
          <Icon.ArrowLeft size={ 14 } aria-hidden='true' />
          { submission.form_title || __( 'Submissions', 'subtleforms' ) }
        </button>
      }
      title={ heading }
      description={ sprintf(
        /* translators: 1: absolute date, 2: relative time */
        __( 'Received %1$s · %2$s', 'subtleforms' ),
        absDate,
        relDate
      ) }
      actions={ actions }>
      { entry }
    </AdminShell>
  );
}
