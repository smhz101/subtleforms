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
import AdminLayout from './AdminLayout';

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
    const field = submission.schema.fields.find((f) => f.id === key);
    return field?.label || key;
  };

  const navigate = (direction) => {
    const targetId = direction === 'next' ? adjacent.next : adjacent.prev;
    if (targetId) {
      window.location.href = `admin.php?page=subtleforms-submission-detail&submission_id=${targetId}${
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

  const headerActions = (
    <>
      <Button isSecondary onClick={onBack}>
        ← {__('Back to Submissions', 'subtleforms')}
      </Button>
      <div className='subtleforms-submission-nav' style={{ display: 'flex', gap: '8px' }}>
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
    <AdminLayout
      title={sprintf(__('Submission #%d', 'subtleforms'), submission.id)}
      headerActions={headerActions}>
      <div className='subtleforms-submission-detail-wrapper'>
        <div className='subtleforms-submission-main'>
          <div className='subtleforms-detail-section'>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 15,
              }}>
              <h2>{__('Submitted Data', 'subtleforms')}</h2>
              <label>
                <input
                  type='checkbox'
                  checked={showEmpty}
                  onChange={(e) => setShowEmpty(e.target.checked)}
                />{' '}
                {__('Show empty fields', 'subtleforms')}
              </label>
            </div>
            <table className='widefat'>
              <tbody>
                {Object.keys(filteredPayload).length > 0 ? (
                  Object.entries(filteredPayload).map(([key, value]) => (
                    <tr key={key}>
                      <th style={{ width: '30%' }}>{getFieldLabel(key)}</th>
                      <td style={{ whiteSpace: 'pre-wrap' }}>
                        {String(value)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan='2'>
                      <em>{__('No data to display', 'subtleforms')}</em>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className='subtleforms-detail-section'>
            <h2>{__('Submission Notes', 'subtleforms')}</h2>
            <TextareaControl
              rows={4}
              placeholder={__(
                'Add notes about this submission (not yet implemented)',
                'subtleforms'
              )}
              disabled
            />
          </div>

          <div className='subtleforms-detail-section'>
            <h2>{__('Execution Logs', 'subtleforms')}</h2>
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
    </AdminLayout>
  );
}
