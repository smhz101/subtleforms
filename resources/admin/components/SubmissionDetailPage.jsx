import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  Button,
  SelectControl,
  TextareaControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { arrowLeft, chevronLeft, chevronRight } from '@wordpress/icons';
import AdminShell from './AdminShell';

const restBase =
  window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
  '/wp-json/subtleforms/v1';
const restNonce = window.subtleformsAdmin?.restNonce || '';

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
  const [activeLogTab, setActiveLogTab] = useState('general');
  const { createSuccessNotice, createErrorNotice } = useDispatch(noticesStore);

  useEffect(() => {
    if (!submissionId) {
      setError(__('Invalid submission ID', 'subtleforms'));
      setLoading(false);
      return;
    }
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    setLoading(true);
    setError(null);

    try {
      const [subData, logsData, adjData] = await Promise.all([
        apiGet(`/submissions/${submissionId}`),
        apiGet(`/submissions/${submissionId}/logs`).catch(() => []),
        apiGet(
          `/submissions/${submissionId}/adjacent${
            formId ? `?form_id=${formId}` : ''
          }`
        ).catch(() => ({ next: null, prev: null })),
      ]);

      setSubmission(subData);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setAdjacent(adjData);

      // Auto-mark as read
      if (subData.status === 'unread') {
        apiPut(`/submissions/${submissionId}`, { status: 'read' }).then(() => {
          setSubmission((prev) => ({ ...prev, status: 'read' }));
        });
      }
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
      createSuccessNotice(__('Status updated', 'subtleforms'), {
        type: 'snackbar',
      });
    } catch (err) {
      createErrorNotice(__('Failed to update status', 'subtleforms'), {
        type: 'snackbar',
      });
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

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return sprintf(__('%d seconds ago', 'subtleforms'), diff);
    if (diff < 3600)
      return sprintf(__('%d minutes ago', 'subtleforms'), Math.floor(diff / 60));
    if (diff < 86400)
      return sprintf(__('%d hours ago', 'subtleforms'), Math.floor(diff / 3600));
    return sprintf(__('%d days ago', 'subtleforms'), Math.floor(diff / 86400));
  };

  const getBrowserInfo = (userAgent) => {
    if (!userAgent) return __('Unknown', 'subtleforms');
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    return match ? match[0] : __('Unknown', 'subtleforms');
  };

  const getDeviceType = (userAgent) => {
    if (!userAgent) return __('Unknown', 'subtleforms');
    return userAgent.match(/Mobile|Android|iPhone|iPad/)
      ? __('Mobile', 'subtleforms')
      : __('Desktop', 'subtleforms');
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <Spinner />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className='flex flex-col justify-center items-center gap-4 h-screen'>
        <Notice status='error' isDismissible={false}>
          {error || __('Submission not found', 'subtleforms')}
        </Notice>
        <Button isPrimary onClick={onBack}>
          {__('Back to Submissions', 'subtleforms')}
        </Button>
      </div>
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

  const generalLogs = logs.filter((log) => !log.context || log.context !== 'api');
  const apiLogs = logs.filter((log) => log.context === 'api');

  const actions = (
    <div className='flex items-center gap-2'>
      <Button isSecondary icon={arrowLeft} onClick={onBack}>
        {__('Submissions', 'subtleforms')}
      </Button>
      <Button
        isSecondary
        icon={chevronLeft}
        disabled={!adjacent.prev}
        onClick={() => navigate('prev')}
        iconPosition='left'>
        {__('Previous', 'subtleforms')}
      </Button>
      <Button
        isSecondary
        icon={chevronRight}
        disabled={!adjacent.next}
        onClick={() => navigate('next')}
        iconPosition='right'>
        {__('Next', 'subtleforms')}
      </Button>
    </div>
  );

  return (
    <AdminShell
      title={sprintf(__('Submission #%d', 'subtleforms'), submission.id)}
      actions={actions}
      noScroll={true}>
      <div className='h-full overflow-y-auto'>
        <div className='gap-6 grid grid-cols-1 lg:grid-cols-3 p-6'>
          {/* LEFT COLUMN - 2/3 width */}
          <div className='space-y-6 lg:col-span-2'>
            {/* Form Entry Data */}
            <div className='bg-white border border-gray-300'>
              <div className='flex justify-between items-center bg-gray-50 px-6 py-4 border-gray-300 border-b'>
                <h2 className='m-0 font-semibold text-gray-900 text-base'>
                  {__('Form Entry Data', 'subtleforms')}
                </h2>
                <label className='flex items-center gap-2 text-gray-600 text-sm cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showEmpty}
                    onChange={(e) => setShowEmpty(e.target.checked)}
                    className='border-gray-300 text-blue-600'
                  />
                  {__('Show empty fields', 'subtleforms')}
                </label>
              </div>
            <div>
              {Object.keys(filteredPayload).length > 0 ? (
                <table className='w-full'>
                  <tbody className='divide-y divide-gray-200'>
                    {Object.entries(filteredPayload).map(([key, value]) => (
                      <tr
                        key={key}
                        className='hover:bg-gray-50 transition-colors'>
                        <td className='px-6 py-3 w-1/3 font-medium text-gray-900 text-sm align-top'>
                          {getFieldLabel(key)}
                        </td>
                        <td className='px-6 py-3 text-gray-700 text-sm whitespace-pre-wrap'>
                          {String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className='px-6 py-8 text-center'>
                  <p className='text-gray-500 text-sm'>
                    {__('No data to display', 'subtleforms')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submission Notes */}
          <div className='bg-white border border-gray-300'>
            <div className='bg-gray-50 px-6 py-4 border-gray-300 border-b'>
              <h2 className='m-0 font-semibold text-gray-900 text-base'>
                {__('Submission Notes', 'subtleforms')}
              </h2>
            </div>
            <div className='p-6'>
              <TextareaControl
                rows={4}
                placeholder={__(
                  'Add notes about this submission (coming soon)',
                  'subtleforms'
                )}
                disabled
                className='w-full'
              />
            </div>
          </div>

          {/* Execution Logs */}
          <div className='bg-white border border-gray-300'>
            <div className='bg-gray-50 px-6 py-4 border-gray-300 border-b'>
              <h2 className='m-0 font-semibold text-gray-900 text-base'>
                {__('Execution Logs', 'subtleforms')}
              </h2>
            </div>
            <div className='border-gray-300 border-b'>
              <div className='flex'>
                <button
                  onClick={() => setActiveLogTab('general')}
                  className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeLogTab === 'general'
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}>
                  {sprintf(__('General (%d)', 'subtleforms'), generalLogs.length)}
                </button>
                <button
                  onClick={() => setActiveLogTab('api')}
                  className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeLogTab === 'api'
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}>
                  {sprintf(__('API Calls (%d)', 'subtleforms'), apiLogs.length)}
                </button>
              </div>
            </div>
            <div className='p-6'>
              {(() => {
                const displayLogs =
                  activeLogTab === 'general' ? generalLogs : apiLogs;
                return displayLogs.length > 0 ? (
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='bg-gray-50 border-gray-300 border-b'>
                        <th className='px-3 py-2 font-semibold text-gray-700 text-xs text-left uppercase'>
                          {__('Time', 'subtleforms')}
                        </th>
                        <th className='px-3 py-2 font-semibold text-gray-700 text-xs text-left uppercase'>
                          {__('Level', 'subtleforms')}
                        </th>
                        <th className='px-3 py-2 font-semibold text-gray-700 text-xs text-left uppercase'>
                          {__('Message', 'subtleforms')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200'>
                      {displayLogs.map((log, idx) => (
                        <tr key={idx} className='hover:bg-gray-50'>
                          <td className='px-3 py-2 text-gray-600 whitespace-nowrap'>
                            {log.created_at}
                          </td>
                          <td className='px-3 py-2'>
                            <span
                              className={`inline-block px-2 py-0.5 text-xs font-medium ${
                                log.level === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : log.level === 'warning'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                              {log.level}
                            </span>
                          </td>
                          <td className='px-3 py-2 text-gray-900'>
                            {log.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className='text-gray-500 text-sm text-center'>
                    {__('No logs available', 'subtleforms')}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - 1/3 width */}
        <div className='lg:col-span-1'>
          <div className='top-6 sticky bg-white border border-gray-300'>
            <div className='bg-gray-50 px-6 py-4 border-gray-300 border-b'>
              <h3 className='m-0 font-semibold text-gray-900 text-base'>
                {__('Submission Info', 'subtleforms')}
              </h3>
            </div>
            <div className='p-6'>
              <table className='w-full text-sm'>
                <tbody className='space-y-3'>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('ID', 'subtleforms')}
                    </td>
                    <td className='py-2 text-gray-900'>
                      <code className='bg-gray-100 px-2 py-1 text-xs'>
                        #{submission.id}
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('Form', 'subtleforms')}
                    </td>
                    <td className='py-2 text-gray-900'>
                      {submission.form_title || submission.form_id}
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('Status', 'subtleforms')}
                    </td>
                    <td className='py-2'>
                      <SelectControl
                        value={submission.status}
                        onChange={handleStatusChange}
                        disabled={updating}
                        options={[
                          { label: __('Unread', 'subtleforms'), value: 'unread' },
                          { label: __('Read', 'subtleforms'), value: 'read' },
                        ]}
                        className='m-0'
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('IP Address', 'subtleforms')}
                    </td>
                    <td className='py-2 text-gray-900'>
                      <code className='text-xs'>
                        {submission.ip_address || __('N/A', 'subtleforms')}
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('Browser', 'subtleforms')}
                    </td>
                    <td className='py-2 text-gray-900 text-xs break-words'>
                      {getBrowserInfo(submission.user_agent)}
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('Device', 'subtleforms')}
                    </td>
                    <td className='py-2 text-gray-900'>
                      {getDeviceType(submission.user_agent)}
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('Source URL', 'subtleforms')}
                    </td>
                    <td className='py-2 text-xs break-all'>
                      {meta.source_url ? (
                        <a
                          href={meta.source_url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 hover:text-blue-800'>
                          {meta.source_url}
                        </a>
                      ) : (
                        <span className='text-gray-500'>
                          {__('N/A', 'subtleforms')}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('User', 'subtleforms')}
                    </td>
                    <td className='py-2 text-gray-900'>
                      {meta.user_id
                        ? sprintf(__('User #%d', 'subtleforms'), meta.user_id)
                        : __('Guest', 'subtleforms')}
                    </td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-4 font-medium text-gray-600 align-top'>
                      {__('Submitted', 'subtleforms')}
                    </td>
                    <td className='py-2 text-gray-900' title={submission.created_at}>
                      {getRelativeTime(submission.created_at)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

