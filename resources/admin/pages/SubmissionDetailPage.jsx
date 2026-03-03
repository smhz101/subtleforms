import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  SelectControl,
  TabPanel,
  TextareaControl,
} from '@wordpress/components';
import { Button } from '../components/navigation';
import { useNavigate } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import './SubmissionDetailPage.scss';

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
        apiGet(`/submissions/${submissionId}`),
        apiGet(`/submissions/${submissionId}/logs`),
        apiGet(
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
      <div className='sf-submission-header-actions'>
        {/* Status Badge */}
        <span
          className={`sf-submission-badge ${
            submission.status === 'unread'
              ? 'sf-submission-badge--unread'
              : 'sf-submission-badge--read'
          }`}>
          {submission.status === 'unread' && (
            <span className='sf-submission-badge__pulse'></span>
          )}
          {submission.status === 'unread'
            ? __('New', 'subtleforms')
            : __('Read', 'subtleforms')}
        </span>

        {/* Form Link */}
        <span className='sf-submission-header__form-link'>
          {submission.form_title && (
            <a
              href={`admin.php?page=subtleforms-forms&form_id=${submission.form_id}`}
              className='sf-submission-header__link'>
              {submission.form_title}
            </a>
          )}
        </span>

        {/* Created Date */}
        <span className='sf-submission-header__date'>
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
      title={(() => {
        /* translators: %1$d: submission id */ return sprintf(
          __('Submission #%1$d', 'subtleforms'),
          submission.id
        );
      })()}
      actions={actions}>
      <div className='sf-dashboard-page__content sf-submission-detail__content'>
        <div className='subtleforms-card'>
          <div className='subtleforms-card-header'>
            <div className='sf-submission-card__header'>
              <h2 className='sf-submission-card__title'>
                {__('Submitted Data', 'subtleforms')}
              </h2>
              <div className='sf-submission-card__controls'>
                <label className='sf-submission-card__control-label'>
                  <input
                    type='checkbox'
                    checked={showEmpty}
                    onChange={(e) => setShowEmpty(e.target.checked)}
                    className='sf-submission-card__checkbox'
                  />
                  {__('Show empty fields', 'subtleforms')}
                </label>
                <label className='sf-submission-card__control-label'>
                  <input
                    type='checkbox'
                    checked={showTechnical}
                    onChange={(e) => setShowTechnical(e.target.checked)}
                    className='sf-submission-card__checkbox'
                  />
                  {__('Show technical fields', 'subtleforms')}
                </label>
              </div>
            </div>
          </div>
          <div className='subtleforms-card-content'>
            {Object.keys(filteredPayload).length > 0 ? (
              <div className='sf-submission-fields'>
                {Object.entries(filteredPayload).map(([key, value]) => (
                  <div key={key} className='sf-submission-field'>
                    <div className='sf-submission-field__content'>
                      <div className='sf-submission-field__layout'>
                        <div className='sf-submission-field__label-section'>
                          <h3 className='sf-submission-field__label'>
                            {getFieldLabel(key)}
                          </h3>
                          {showTechnical && (
                            <p className='sf-submission-field__tech-name'>
                              {key}
                            </p>
                          )}
                        </div>
                        <div className='sf-submission-field__value-section'>
                          <div className='sf-submission-field__value'>
                            {value && typeof value === 'object' ? (
                              <div className='sf-submission-field__json'>
                                <div className='sf-submission-field__json-label'>
                                  {__('JSON Data:', 'subtleforms')}
                                </div>
                                <pre className='sf-submission-field__json-code'>
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              </div>
                            ) : (
                              <div className='sf-submission-field__value-text'>
                                {value ? (
                                  <span className='sf-submission-field__value-filled'>
                                    {String(value)
                                      .split('\n')
                                      .map((line, i, arr) => (
                                        <span key={i}>
                                          {line}
                                          {i < arr.length - 1 && <br />}
                                        </span>
                                      ))}
                                  </span>
                                ) : (
                                  <span className='sf-submission-field__value-empty'>
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
              </div>
            ) : (
              <div className='sf-submission-empty'>
                <div className='sf-submission-empty__icon'>
                  <svg
                    className='sf-submission-empty__icon-svg'
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
                <h3 className='sf-submission-empty__title'>
                  {__('No Data Submitted', 'subtleforms')}
                </h3>
                <p className='sf-submission-empty__description'>
                  {__(
                    'This submission was recorded but contains no field data.',
                    'subtleforms'
                  )}
                </p>
                <div className='sf-submission-empty__info'>
                  <p className='sf-submission-empty__info-title'>
                    {__('Possible causes:', 'subtleforms')}
                  </p>
                  <ul className='sf-submission-empty__info-list'>
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
                  <p className='sf-submission-empty__info-tip'>
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
              <h2 className='sf-submission-card__title'>
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
                <div className='sf-submission-tech__tabs'>
                  <div data-tab='raw'>
                    <div className='sf-submission-tech__code-block'>
                      <pre className='sf-submission-tech__code'>
                        {JSON.stringify(submission.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div data-tab='meta'>
                    <div className='sf-submission-tech__grid'>
                      <div className='sf-submission-tech__section'>
                        <h4 className='sf-submission-tech__section-title'>
                          {__('Request Info', 'subtleforms')}
                        </h4>
                        <dl className='sf-submission-tech__list'>
                          <div>
                            <dt className='sf-submission-tech__label'>
                              {__('IP Address', 'subtleforms')}
                            </dt>
                            <dd className='sf-submission-tech__value'>
                              {submission.ip_address || __('N/A', 'subtleforms')}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-submission-tech__label'>
                              {__('User Agent', 'subtleforms')}
                            </dt>
                            <dd className='sf-submission-tech__value sf-submission-tech__value--break'>
                              {submission.user_agent || __('N/A', 'subtleforms')}
                            </dd>
                          </div>
                          {/* Referrer is not available in backend, so always show N/A */}
                          <div>
                            <dt className='sf-submission-tech__label'>
                              {__('Referrer', 'subtleforms')}
                            </dt>
                            <dd className='sf-submission-tech__value sf-submission-tech__value--break'>
                              {__('N/A', 'subtleforms')}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className='sf-submission-tech__section'>
                        <h4 className='sf-submission-tech__section-title'>
                          {__('Database Info', 'subtleforms')}
                        </h4>
                        <dl className='sf-submission-tech__list'>
                          <div>
                            <dt className='sf-submission-tech__label'>
                              {__('Submission ID', 'subtleforms')}
                            </dt>
                            <dd className='sf-submission-tech__value'>
                              {submission.id}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-submission-tech__label'>
                              {__('Form ID', 'subtleforms')}
                            </dt>
                            <dd className='sf-submission-tech__value'>
                              {submission.form_id}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-submission-tech__label'>
                              {__('Created', 'subtleforms')}
                            </dt>
                            <dd className='sf-submission-tech__value'>
                              {submission.created_at}
                            </dd>
                          </div>
                          <div>
                            <dt className='sf-submission-tech__label'>
                              {__('Status', 'subtleforms')}
                            </dt>
                            <dd className='sf-submission-tech__value'>
                              {submission.status}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div data-tab='schema'>
                    <div className='sf-submission-tech__section'>
                      <pre className='sf-submission-tech__code'>
                        {JSON.stringify(submission.schema || {}, null, 2)}
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
            <h2 className='sf-submission-card__title'>
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
            <h2 className='sf-submission-card__title'>
              {__('Execution Logs', 'subtleforms')}
            </h2>
          </div>
          <div className='subtleforms-card-content'>
            <TabPanel
              tabs={[
                {
                  name: 'general',
                  title: sprintf(
                    /* translators: %1$d: number of general log entries */
                    __('General (%1$d)', 'subtleforms'),
                    generalLogs.length
                  ),
                },
                {
                  name: 'api',
                  title: sprintf(
                    /* translators: %1$d: number of API call logs */
                    __('API Calls (%1$d)', 'subtleforms'),
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
                      ? sprintf(
                          /* translators: %1$d: user id */ __(
                            'User #%1$d',
                            'subtleforms'
                          ),
                          meta.user_id
                        )
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
                        return (() => {
                          /* translators: %1$d: number of seconds */ return sprintf(
                            __('%1$d seconds ago', 'subtleforms'),
                            diff
                          );
                        })();
                      if (diff < 3600)
                        return (() => {
                          /* translators: %1$d: number of minutes */ return sprintf(
                            __('%1$d minutes ago', 'subtleforms'),
                            Math.floor(diff / 60)
                          );
                        })();
                      if (diff < 86400)
                        return (() => {
                          /* translators: %1$d: number of hours ago */ return sprintf(
                            __('%1$d hours ago', 'subtleforms'),
                            Math.floor(diff / 3600)
                          );
                        })();
                      return (() => {
                        /* translators: %1$d: number of days */ return sprintf(
                          __('%1$d days ago', 'subtleforms'),
                          Math.floor(diff / 86400)
                        );
                      })();
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
