import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  Button,
  SelectControl,
  SearchControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

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

export default function SubmissionsTable({
  formId,
  showFormColumn = true,
  onRowClick,
}) {
  const [submissions, setSubmissions] = useState(null);
  const [forms, setForms] = useState([]);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    formId: formId || '',
    status: 'all',
    search: '',
  });
  const [pagination, setPagination] = useState({
    perPage: 20,
    offset: 0,
  });

  useEffect(() => {
    if (!formId) {
      apiGet('/forms')
        .then((data) => {
          if (Array.isArray(data)) {
            setForms(data);
          }
        })
        .catch(() => {});
    }
  }, [formId]);

  useEffect(() => {
    loadSubmissions();
  }, [
    filters.formId,
    filters.status,
    filters.search,
    pagination.perPage,
    pagination.offset,
  ]);

  const loadSubmissions = () => {
    setError(null);
    setSubmissions(null);

    const params = [];
    const targetFormId = formId || filters.formId;

    if (targetFormId) {
      params.push(`form_id=${targetFormId}`);
    }

    if (filters.status && filters.status !== 'all') {
      params.push(`status=${filters.status}`);
    }

    if (filters.search) {
      params.push(`search=${encodeURIComponent(filters.search)}`);
    }

    params.push(`per_page=${pagination.perPage}`);
    params.push(`offset=${pagination.offset}`);

    const path = '/submissions?' + params.join('&');

    apiGet(path)
      .then((data) => {
        if (data && data.submissions) {
          setSubmissions(data.submissions);
          setTotal(data.total || 0);
        } else if (Array.isArray(data)) {
          setSubmissions(data);
          setTotal(data.length);
        } else {
          setError(__('Invalid response format', 'subtleforms'));
        }
      })
      .catch(() => {
        setError(__('Failed to load submissions', 'subtleforms'));
      });
  };

  const handleRowClick = (submission) => {
    if (onRowClick) {
      onRowClick(submission);
    } else {
      window.location.href = `admin.php?page=subtleforms-submission-detail&submission_id=${
        submission.id
      }${formId ? `&form_id=${formId}` : ''}`;
    }
  };

  const handlePageChange = (newOffset) => {
    setPagination({ ...pagination, offset: newOffset });
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return sprintf(__('%d seconds ago', 'subtleforms'), diff);
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
    return sprintf(__('%d days ago', 'subtleforms'), Math.floor(diff / 86400));
  };

  const getBrowserDevice = (userAgent) => {
    if (!userAgent) return { browser: 'N/A', device: 'N/A' };
    const browser =
      userAgent
        .match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0]
        ?.split('/')[0] || 'Other';
    const device = userAgent.match(/Mobile|Android|iPhone|iPad/)
      ? 'Mobile'
      : 'Desktop';
    return { browser, device };
  };

  if (error) return <Notice status='error'>{error}</Notice>;
  if (submissions === null) return <Spinner />;

  const totalPages = Math.ceil(total / pagination.perPage);
  const currentPage = Math.floor(pagination.offset / pagination.perPage) + 1;

  return (
    <div className='wrap subtleforms-submissions-wrapper'>
      <div className='subtleforms-filters'>
        <div className='subtleforms-status-tabs'>
          <button
            className={`subtleforms-status-tab ${
              filters.status === 'all' ? 'active' : ''
            }`}
            onClick={() => setFilters({ ...filters, status: 'all' })}>
            {sprintf(__('All (%d)', 'subtleforms'), total)}
          </button>
          <button
            className={`subtleforms-status-tab ${
              filters.status === 'unread' ? 'active' : ''
            }`}
            onClick={() => setFilters({ ...filters, status: 'unread' })}>
            {sprintf(
              __('Unread (%d)', 'subtleforms'),
              submissions.filter((s) => s.status === 'unread').length
            )}
          </button>
          <button
            className={`subtleforms-status-tab ${
              filters.status === 'read' ? 'active' : ''
            }`}
            onClick={() => setFilters({ ...filters, status: 'read' })}>
            {sprintf(
              __('Read (%d)', 'subtleforms'),
              submissions.filter((s) => s.status === 'read').length
            )}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 15, alignItems: 'flex-end' }}>
          {!formId && (
            <SelectControl
              label={__('Filter by Form', 'subtleforms')}
              value={filters.formId}
              onChange={(value) => setFilters({ ...filters, formId: value })}
              options={[
                { label: __('All Forms', 'subtleforms'), value: '' },
                ...forms.map((form) => ({
                  label: form.title,
                  value: form.id,
                })),
              ]}
            />
          )}
          <SearchControl
            value={filters.search}
            onChange={(value) => setFilters({ ...filters, search: value })}
            placeholder={__('Search submissions...', 'subtleforms')}
          />
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className='subtleforms-empty-state'>
          <p>{__('No submissions found.', 'subtleforms')}</p>
        </div>
      ) : (
        <>
          <table className='wp-list-table fixed widefat striped'>
            <thead>
              <tr>
                <th style={{ width: '8%' }}>{__('ID', 'subtleforms')}</th>
                {showFormColumn && (
                  <th style={{ width: '20%' }}>{__('Form', 'subtleforms')}</th>
                )}
                <th style={{ width: '10%' }}>{__('Status', 'subtleforms')}</th>
                <th style={{ width: '15%' }}>{__('Browser', 'subtleforms')}</th>
                <th style={{ width: '10%' }}>{__('Device', 'subtleforms')}</th>
                <th style={{ width: '20%' }}>
                  {__('Submitted', 'subtleforms')}
                </th>
                <th style={{ width: '15%' }}>{__('Actions', 'subtleforms')}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const { browser, device } = getBrowserDevice(sub.user_agent);
                return (
                  <tr
                    key={sub.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(sub)}>
                    <td>
                      <strong>#{sub.id}</strong>
                    </td>
                    {showFormColumn && <td>{sub.form_title || sub.form_id}</td>}
                    <td>
                      <span
                        className={`subtleforms-status-badge subtleforms-status-badge--${sub.status}`}>
                        {sub.status === 'unread'
                          ? __('Unread', 'subtleforms')
                          : __('Read', 'subtleforms')}
                      </span>
                    </td>
                    <td>{browser}</td>
                    <td>{device}</td>
                    <td title={sub.created_at}>
                      {getRelativeTime(sub.created_at)}
                    </td>
                    <td>
                      <Button
                        isSecondary
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(sub);
                        }}>
                        {__('View', 'subtleforms')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className='subtleforms-pagination'>
              <Button
                disabled={currentPage === 1}
                onClick={() =>
                  handlePageChange(pagination.offset - pagination.perPage)
                }
                isSecondary>
                {__('← Previous', 'subtleforms')}
              </Button>
              <span>
                {sprintf(
                  __('Page %d of %d', 'subtleforms'),
                  currentPage,
                  totalPages
                )}
              </span>
              <Button
                disabled={currentPage === totalPages}
                onClick={() =>
                  handlePageChange(pagination.offset + pagination.perPage)
                }
                isSecondary>
                {__('Next →', 'subtleforms')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
