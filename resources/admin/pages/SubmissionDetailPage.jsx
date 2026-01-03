import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  Button,
  SelectControl,
  TabPanel,
  TextareaControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';

const restBase =
  window.subtleformsAdmin && window.subtleformsAdmin.restUrl
    ? window.subtleformsAdmin.restUrl.replace(/\/$/, '')
    : '/wp-json/subtleforms/v1';
const restNonce =
  window.subtleformsAdmin && window.subtleformsAdmin.restNonce
    ? window.subtleformsAdmin.restNonce
    : null;

async function apiGet(path) {
  const response = await fetch(restBase + path, {
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('API request failed');
  }
  return response.json();
}

async function apiPut(path, payload) {
  const response = await fetch(restBase + path, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('API request failed');
  }
  return response.json();
}

export default function SubmissionDetailPage({ submissionId, onBack, formId }) {
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
        apiGet(`/submissions/${submissionId}`),
        apiGet(`/submissions/${submissionId}/logs`),
        apiGet(
          `/submissions/${submissionId}/adjacent${
            formId ? `?form_id=${formId}` : ''
          }`
        ),
      ]);

      setSubmission(subData);
      setLogs(logsData);
      setAdjacent(adjData);
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
      await apiPut(`/submissions/${submission.id}`, { status: newStatus });
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
      window.location.href = `admin.php?page=subtleforms-submissions&submission_id=${targetId}${
        formId ? `&form_id=${formId}` : ''
      }`;
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

  const generalLogs = logs.filter(
    (log) => !log.context || log.context !== 'api'
  );
  const apiLogs = logs.filter((log) => log.context === 'api');

  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;
  if (!submission)
    return (
      <Notice status='warning'>
        {__('Submission not found', 'subtleforms')}
      </Notice>
    );

  // Enhanced actions section with status badge and submission info
  const actions = (
    <>
      <Button isSecondary onClick={onBack}>
        ← {__('Back to Submissions', 'subtleforms')}
      </Button>
      <div className='sf-flex sf-items-center sf-gap-3'>
        {/* Status Badge */}
        <span
          className={`sf-inline-flex sf-items-center sf-gap-1 sf-px-3 sf-py-1 sf-text-xs sf-font-medium sf-rounded-full ${
            submission.status === 'unread'
              ? 'sf-bg-blue-500 sf-text-white'
              : 'sf-bg-gray-100 sf-text-gray-600'
          }`}>
          {submission.status === 'unread' && (
            <span className='sf-bg-white sf-rounded-full sf-w-2 sf-h-2 sf-animate-pulse'></span>
          )}
          {submission.status === 'unread'
            ? __('New', 'subtleforms')
            : __('Read', 'subtleforms')}
        </span>

        {/* Form Link */}
        <span className='sf-text-gray-600 sf-text-sm'>
          {submission.form_title && (
            <a
              href={`admin.php?page=subtleforms-forms&form_id=${submission.form_id}`}
              className='sf-text-blue-600 hover:sf-text-blue-700 sf-no-underline'>
              {submission.form_title}
            </a>
          )}
        </span>

        {/* Created Date */}
        <span className='sf-text-gray-500 sf-text-sm'>
          {(() => {
            const date = new Date(submission.created_at);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          })()}
        </span>
      </div>

      <div
        className='subtleforms-submission-nav'
        style={{ display: 'flex', gap: '8px' }}>
        <Button
          disabled={!adjacent.prev}
          onClick={() => navigate('prev')}
          isSecondary>
          {__('← Previous', 'subtleforms')}
        </Button>
        <Button
          disabled={!adjacent.next}
          onClick={() => navigate('next')}
          isSecondary>
          {__('Next →', 'subtleforms')}
        </Button>
      </div>
    </>
  );

  return (
    <AdminShell
      title={sprintf(__('Submission #%d', 'subtleforms'), submission.id)}
      actions={actions}>
      <div className='sf-space-y-8'>
        <div className='subtleforms-card'>
          <div className='subtleforms-card-header'>
            <div className='sf-flex sf-justify-between sf-items-center'>
              <h2 className='sf-m-0 sf-font-semibold sf-text-gray-900 sf-text-lg'>
                {__('Submitted Data', 'subtleforms')}
              </h2>
              <div className='sf-flex sf-items-center sf-gap-4'>
                <label className='sf-flex sf-items-center sf-gap-2 sf-text-gray-600 sf-text-sm'>
                  <input
                    type='checkbox'
                    checked={showEmpty}
                    onChange={(e) => setShowEmpty(e.target.checked)}
                    className='sf-border-gray-300 sf-rounded sf-focus:ring-2 sf-focus:ring-blue-500 sf-text-blue-600'
                  />
                  {__('Show empty fields', 'subtleforms')}
                </label>
                <label className='sf-flex sf-items-center sf-gap-2 sf-text-gray-600 sf-text-sm'>
                  <input
                    type='checkbox'
                    checked={showTechnical}
                    onChange={(e) => setShowTechnical(e.target.checked)}
                    className='sf-border-gray-300 sf-rounded sf-focus:ring-2 sf-focus:ring-blue-500 sf-text-blue-600'
                  />
                  {__('Show technical fields', 'subtleforms')}
                </label>
              </div>
            </div>
          </div>
          <div className='subtleforms-card-content'>
            {Object.keys(filteredPayload).length > 0 ? (
              <div className='sf-space-y-3'>
                {Object.entries(filteredPayload).map(([key, value], index) => (
                  <div
                    key={key}
                    className='sf-bg-white sf-shadow-sm sf-border sf-border-gray-200 sf-rounded-lg sf-overflow-hidden'>
                    <div className='sf-px-6 sf-py-4'>
                      <div className='sf-flex sf-justify-between sf-items-start sf-gap-4'>
                        <div className='sf-flex-shrink-0'>
                          <h3 className='sf-font-semibold sf-text-gray-900 sf-text-sm sf-leading-6'>
                            {getFieldLabel(key)}
                          </h3>
                          {showTechnical && (
                            <p className='sf-mt-1 sf-font-mono sf-text-gray-500 sf-text-xs'>
                              {key}
                            </p>
                          )}
                        </div>
                        <div className='sf-flex-1 sf-min-w-0'>
                          <div className='sf-text-gray-900 sf-text-sm sf-break-words sf-whitespace-pre-wrap'>
                            {value && typeof value === 'object' ? (
                              <div className='sf-bg-gray-50 sf-mt-2 sf-p-3 sf-border sf-border-gray-200 sf-rounded'>
                                <div className='sf-mb-2 sf-font-medium sf-text-gray-600 sf-text-xs'>
                                  {__('JSON Data:', 'subtleforms')}
                                </div>
                                <pre className='sf-max-h-40 sf-overflow-auto sf-font-mono sf-text-gray-800 sf-text-xs'>
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              </div>
                            ) : (
                              <div className='sf-mt-2'>
                                {value ? (
                                  <span className='sf-font-medium'>
                                    {String(value)}
                                  </span>
                                ) : (
                                  <span className='sf-text-gray-400 sf-italic'>
                                    ({__('empty', 'subtleforms')})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                \n{' '}
              </div>
            ) : (
              <div className='sf-py-12 sf-text-center'>
                <div className='sf-inline-flex sf-justify-center sf-items-center sf-bg-gray-100 sf-mb-4 sf-rounded-full sf-w-16 sf-h-16'>
                  <svg
                    className='sf-w-8 sf-h-8 sf-text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    />
                  </svg>
                </div>
                <h3 className='sf-mb-2 sf-font-medium sf-text-gray-900 sf-text-lg'>
                  {__('No Data Submitted', 'subtleforms')}
                </h3>
                <p className='sf-mb-4 sf-text-gray-500 sf-text-sm'>
                  {__(
                    'This submission was recorded but contains no field data.',
                    'subtleforms'
                  )}
                </p>
                <div className='sf-bg-blue-50 sf-mx-auto sf-p-4 sf-border sf-border-blue-200 sf-rounded-lg sf-max-w-2xl sf-text-left'>
                  <p className='sf-mb-2 sf-font-semibold sf-text-blue-800 sf-text-sm'>
                    {__('Possible causes:', 'subtleforms')}
                  </p>
                  <ul className='sf-space-y-1 sf-text-blue-700 sf-text-sm sf-list-disc sf-list-inside'>
                    <li>
                      {__(
                        'Form fields were not properly configured with keys',
                        'subtleforms'
                      )}
                    </li>
                    <li>
                      {__(
                        'JavaScript error prevented data collection',
                        'subtleforms'
                      )}
                    </li>
                    <li>
                      {__(
                        'Multi-step form field paths not correctly collected',
                        'subtleforms'
                      )}
                    </li>
                    <li>
                      {__(
                        'Browser console may show errors during submission',
                        'subtleforms'
                      )}
                    </li>
                  </ul>
                  <p className='sf-mt-3 sf-text-blue-600 sf-text-xs'>
                    <strong>{__('Debug tip:', 'subtleforms')}</strong>{' '}
                    {__(
                      'Check the Execution Logs below for clues.',
                      'subtleforms'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {showTechnical && (
          <div className='subtleforms-card'>
            <div className='subtleforms-card-header'>
              <h2 className='sf-m-0 sf-font-semibold sf-text-gray-900 sf-text-lg'>
                {__('Technical Information', 'subtleforms')}
              </h2>
            </div>
            <div className='subtleforms-card-content'>
              <TabPanel
                tabs={[
                  {
                    name: 'raw',
                    title: __('Raw Payload', 'subtleforms'),
                  },
                  {
                    name: 'meta',
                    title: __('Meta Data', 'subtleforms'),
                  },
                  {
                    name: 'schema',
                    title: __('Form Schema', 'subtleforms'),
                  },
                ]}>
                <div className='sf-space-y-4'>
                  <div data-tab='raw'>
                    <div className='sf-bg-gray-50 sf-p-4 sf-border sf-rounded'>
                      <pre className='sf-max-h-96 sf-overflow-y-auto sf-font-mono sf-text-gray-700 sf-text-xs sf-whitespace-pre-wrap'>
                        {JSON.stringify(submission.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div data-tab='meta'>
                    <div className='sf-gap-4 sf-grid sf-grid-cols-2'>
                      <div className='sf-bg-gray-50 sf-p-4 sf-border sf-rounded'>
                        <h4 className='sf-mb-2 sf-font-semibold sf-text-gray-900 sf-text-sm'>
                          {__('Request Info', 'subtleforms')}
                        </h4>
                        <dl className='sf-space-y-2'>
                          <div>
                            <dt className='sf-font-semibold sf-text-gray-500 sf-text-xs'>
                              {__('IP Address', 'subtleforms')}
                            </dt>
                            <dd className='sf-font-mono sf-text-sm'>
                              {submission.ip || __('N/A', 'subtleforms')}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-font-semibold sf-text-gray-500 sf-text-xs'>
                              {__('User Agent', 'subtleforms')}
                            </dt>
                            <dd className='sf-font-mono sf-text-sm sf-break-all'>
                              {submission.user_agent ||
                                __('N/A', 'subtleforms')}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-font-semibold sf-text-gray-500 sf-text-xs'>
                              {__('Referrer', 'subtleforms')}
                            </dt>
                            <dd className='sf-font-mono sf-text-sm sf-break-all'>
                              {submission.referrer || __('N/A', 'subtleforms')}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className='sf-bg-gray-50 sf-p-4 sf-border sf-rounded'>
                        <h4 className='sf-mb-2 sf-font-semibold sf-text-gray-900 sf-text-sm'>
                          {__('Database Info', 'subtleforms')}
                        </h4>
                        <dl className='sf-space-y-2'>
                          <div>
                            <dt className='sf-font-semibold sf-text-gray-500 sf-text-xs'>
                              {__('Submission ID', 'subtleforms')}
                            </dt>
                            <dd className='sf-font-mono sf-text-sm'>
                              {submission.id}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-font-semibold sf-text-gray-500 sf-text-xs'>
                              {__('Form ID', 'subtleforms')}
                            </dt>
                            <dd className='sf-font-mono sf-text-sm'>
                              {submission.form_id}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-font-semibold sf-text-gray-500 sf-text-xs'>
                              {__('Created', 'subtleforms')}
                            </dt>
                            <dd className='sf-font-mono sf-text-sm'>
                              {submission.created_at}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-font-semibold sf-text-gray-500 sf-text-xs'>
                              {__('Status', 'subtleforms')}
                            </dt>
                            <dd className='sf-font-mono sf-text-sm'>
                              {submission.status}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div data-tab='schema'>
                    <div className='sf-bg-gray-50 sf-p-4 sf-border sf-rounded'>
                      <pre className='sf-max-h-96 sf-overflow-y-auto sf-font-mono sf-text-gray-700 sf-text-xs sf-whitespace-pre-wrap'>
                        {JSON.stringify(form?.attributes || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </TabPanel>
            </div>
          </div>
        )}

        <div className='subtleforms-card'>
          <div className='subtleforms-card-header'>
            <h2 className='sf-m-0 sf-font-semibold sf-text-gray-900 sf-text-lg'>
              {__('Submission Notes', 'subtleforms')}
            </h2>
          </div>
          <div className='subtleforms-card-content'>
            <TextareaControl
              rows={4}
              placeholder={__(
                'Add notes about this submission (not yet implemented)',
                'subtleforms'
              )}
              disabled
            />
          </div>
        </div>

        <div className='subtleforms-card'>
          <div className='subtleforms-card-header'>
            <h2 className='sf-m-0 sf-font-semibold sf-text-gray-900 sf-text-lg'>
              {__('Execution Logs', 'subtleforms')}
            </h2>
          </div>
          <div className='subtleforms-card-content'>
            <TabPanel
              tabs={[
                {
                  name: 'general',
                  title: sprintf(
                    __('General (%d)', 'subtleforms'),
                    generalLogs.length
                  ),
                },
                {
                  name: 'api',
                  title: sprintf(
                    __('API Calls (%d)', 'subtleforms'),
                    apiLogs.length
                  ),
                },
              ]}>
              {(tab) => {
                const displayLogs =
                  tab.name === 'general' ? generalLogs : apiLogs;
                return displayLogs.length > 0 ? (
                  <table className='widefat'>
                    <thead>
                      <tr>
                        <th>{__('Time', 'subtleforms')}</th>
                        <th>{__('Level', 'subtleforms')}</th>
                        <th>{__('Message', 'subtleforms')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {log.created_at}
                          </td>
                          <td>
                            <span
                              className={`subtleforms-log-level subtleforms-log-level--${log.level}`}>
                              {log.level}
                            </span>
                          </td>
                          <td>{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>
                    <em>{__('No logs', 'subtleforms')}</em>
                  </p>
                );
              }}
            </TabPanel>
          </div>
        </div>

        <div className='subtleforms-submission-sidebar'>
          <div className='subtleforms-detail-section'>
            <h3>{__('Submission Info', 'subtleforms')}</h3>
            <table className='widefat'>
              <tbody>
                <tr>
                  <th>{__('ID', 'subtleforms')}</th>
                  <td>
                    <code>{submission.id}</code>
                  </td>
                </tr>
                <tr>
                  <th>{__('Form', 'subtleforms')}</th>
                  <td>{submission.form_title || submission.form_id}</td>
                </tr>
                <tr>
                  <th>{__('Status', 'subtleforms')}</th>
                  <td>
                    <SelectControl
                      value={submission.status}
                      onChange={handleStatusChange}
                      disabled={updating}
                      options={[
                        { label: __('Unread', 'subtleforms'), value: 'unread' },
                        { label: __('Read', 'subtleforms'), value: 'read' },
                      ]}
                    />
                  </td>
                </tr>
                <tr>
                  <th>{__('IP Address', 'subtleforms')}</th>
                  <td>
                    <code>
                      {submission.ip_address || __('N/A', 'subtleforms')}
                    </code>
                  </td>
                </tr>
                <tr>
                  <th>{__('Browser', 'subtleforms')}</th>
                  <td style={{ fontSize: '0.9em', wordBreak: 'break-word' }}>
                    {submission.user_agent
                      ? (() => {
                          const ua = submission.user_agent;
                          const browser =
                            ua.match(
                              /(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/
                            )?.[0] || 'Unknown';
                          return browser;
                        })()
                      : __('N/A', 'subtleforms')}
                  </td>
                </tr>
                <tr>
                  <th>{__('Device', 'subtleforms')}</th>
                  <td>
                    {submission.user_agent
                      ? submission.user_agent.match(
                          /Mobile|Android|iPhone|iPad/
                        )
                        ? __('Mobile', 'subtleforms')
                        : __('Desktop', 'subtleforms')
                      : __('N/A', 'subtleforms')}
                  </td>
                </tr>
                <tr>
                  <th>{__('Source URL', 'subtleforms')}</th>
                  <td style={{ wordBreak: 'break-all', fontSize: '0.85em' }}>
                    {meta.source_url ? (
                      <a
                        href={meta.source_url}
                        target='_blank'
                        rel='noopener noreferrer'>
                        {meta.source_url}
                      </a>
                    ) : (
                      __('N/A', 'subtleforms')
                    )}
                  </td>
                </tr>
                <tr>
                  <th>{__('User', 'subtleforms')}</th>
                  <td>
                    {meta.user_id
                      ? sprintf(__('User #%d', 'subtleforms'), meta.user_id)
                      : __('Guest', 'subtleforms')}
                  </td>
                </tr>
                <tr>
                  <th>{__('Submitted', 'subtleforms')}</th>
                  <td title={submission.created_at}>
                    {(() => {
                      const date = new Date(submission.created_at);
                      const now = new Date();
                      const diff = Math.floor((now - date) / 1000);
                      if (diff < 60)
                        return sprintf(
                          __('%d seconds ago', 'subtleforms'),
                          diff
                        );
                      if (diff < 3600)
                        return sprintf(
                          __('%d minutes ago', 'subtleforms'),
                          Math.floor(diff / 60)
                        );
                      if (diff < 86400)
                        return sprintf(
                          __('%d hours ago', 'subtleforms'),
                          Math.floor(diff / 3600)
                        );
                      return sprintf(
                        __('%d days ago', 'subtleforms'),
                        Math.floor(diff / 86400)
                      );
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
