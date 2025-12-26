import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  Button,
  SelectControl,
  SearchControl,
  Modal,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import classNames from 'classnames';
import DataTable from './DataTable';
import { ConfirmModal } from '../modals';

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

async function apiRequest(path, options = {}) {
  return fetch(restBase + path, {
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }).then(async (response) => {
    let body = null;
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : null;
    } catch (err) {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  });
}

export default function SubmissionsTable({
  formId,
  showFormColumn = true,
  onRowClick,
  searchTerm,
  statusFilter = 'all',
  dateRange = 'all',
}) {
  const [submissions, setSubmissions] = useState([]);
  const [forms, setForms] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [deleteModal, setDeleteModal] = useState(null);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);
  const { createSuccessNotice, createErrorNotice } = useDispatch(noticesStore);

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
    formId,
    statusFilter,
    searchTerm,
    dateRange,
    currentPage,
    perPage,
    sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [statusFilter, searchTerm, dateRange]);

  const getDateRangeParams = (range) => {
    const now = new Date();
    let startDate = null;

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return {};
    }

    return startDate ? { after: startDate.toISOString().split('T')[0] } : {};
  };

  const loadSubmissions = async () => {
    setError(null);
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        orderby: sortBy,
        order: sortDirection,
      });

      if (formId) {
        params.append('form_id', formId);
      }

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      // Add date range filter
      const dateParams = getDateRangeParams(dateRange);
      if (dateParams.after) {
        params.append('after', dateParams.after);
      }

      const response = await fetch(`${restBase}/submissions?${params}`, {
        credentials: 'same-origin',
        headers: {
          'X-WP-Nonce': restNonce,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const total = parseInt(response.headers.get('X-WP-Total') || '0');

        if (data && data.submissions) {
          setSubmissions(data.submissions);
          setTotalItems(data.total || 0);
        } else if (Array.isArray(data)) {
          setSubmissions(data);
          setTotalItems(total);
        } else {
          setError(__('Invalid response format', 'subtleforms'));
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      setError(__('Failed to load submissions', 'subtleforms'));
      setSubmissions([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (submissionId) => {
    setDeleteModal(null);
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));

    try {
      const response = await fetch(`${restBase}/submissions/${submissionId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'X-WP-Nonce': restNonce,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      createSuccessNotice(__('Submission deleted', 'subtleforms'), {
        type: 'snackbar',
      });
    } catch (err) {
      loadSubmissions(); // Revert on failure
      createErrorNotice(__('Failed to delete submission', 'subtleforms'), {
        type: 'snackbar',
      });
    }
  };

  const handleBulkDelete = async (ids) => {
    if (
      !window.confirm(
        sprintf(
          __('Are you sure you want to delete %d submissions?', 'subtleforms'),
          ids.length
        )
      )
    ) {
      return;
    }

    setSubmissions((prev) => prev.filter((s) => !ids.includes(s.id)));
    setSelectedSubmissions([]);

    let successCount = 0;
    for (const id of ids) {
      const { ok } = await apiRequest(`/submissions/${id}`, {
        method: 'DELETE',
      });
      if (ok) successCount++;
    }

    if (successCount === ids.length) {
      createSuccessNotice(
        sprintf(__('%d submissions deleted', 'subtleforms'), successCount),
        { type: 'snackbar' }
      );
    } else {
      createErrorNotice(
        sprintf(
          __(
            'Failed to delete some submissions (%d/%d deleted)',
            'subtleforms'
          ),
          successCount,
          ids.length
        ),
        { type: 'snackbar' }
      );
      loadSubmissions(); // Reload to sync state
    }
  };

  const handleBulkMarkStatus = async (ids, status) => {
    setSubmissions((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, status } : s))
    );
    setSelectedSubmissions([]);

    let successCount = 0;
    for (const id of ids) {
      const { ok } = await apiRequest(`/submissions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (ok) successCount++;
    }

    if (successCount === ids.length) {
      createSuccessNotice(
        sprintf(__('%d submissions updated', 'subtleforms'), successCount),
        { type: 'snackbar' }
      );
    } else {
      createErrorNotice(
        sprintf(
          __(
            'Failed to update some submissions (%d/%d updated)',
            'subtleforms'
          ),
          successCount,
          ids.length
        ),
        { type: 'snackbar' }
      );
      loadSubmissions(); // Reload to sync state
    }
  };

  const handleRowClick = (submission) => {
    if (onRowClick) {
      onRowClick(submission);
    } else {
      window.location.href = `admin.php?page=subtleforms-submissions&submission_id=${
        submission.id
      }${formId ? `&form_id=${formId}` : ''}`;
    }
  };

  const handleSort = (column, direction) => {
    setSortBy(column);
    setSortDirection(direction);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(parseInt(newPerPage));
    setCurrentPage(1);
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

  // Define table columns
  const columns = [
    {
      key: 'id',
      title: __('ID', 'subtleforms'),
      sortable: true,
      width: '8%',
      render: (id) => <strong>#{id}</strong>,
    },
    ...(showFormColumn
      ? [
          {
            key: 'form_title',
            title: __('Form', 'subtleforms'),
            width: '20%',
            render: (formTitle, submission) => formTitle || submission.form_id,
          },
        ]
      : []),
    {
      key: 'status',
      title: __('Status', 'subtleforms'),
      sortable: true,
      width: '10%',
      render: (status) => (
        <span
          className={classNames(
            'inline-flex items-center px-2.5 py-0.5 text-xs font-medium',
            {
              'bg-blue-100 text-blue-800': status === 'unread',
              'bg-gray-100 text-gray-800': status !== 'unread',
            }
          )}>
          {status === 'unread'
            ? __('Unread', 'subtleforms')
            : __('Read', 'subtleforms')}
        </span>
      ),
    },
    {
      key: 'user_agent',
      title: __('Browser', 'subtleforms'),
      width: '15%',
      render: (userAgent) => getBrowserDevice(userAgent).browser,
    },
    {
      key: 'user_agent',
      title: __('Device', 'subtleforms'),
      width: '10%',
      render: (userAgent) => getBrowserDevice(userAgent).device,
    },
    {
      key: 'created_at',
      title: __('Submitted', 'subtleforms'),
      sortable: true,
      width: '20%',
      render: (createdAt) => (
        <span title={createdAt}>{getRelativeTime(createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      title: __('Actions', 'subtleforms'),
      width: '15%',
      render: (_, submission) => (
        <div className='flex gap-2'>
          <Button
            isSecondary
            isSmall
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(submission);
            }}>
            {__('View', 'subtleforms')}
          </Button>
          <Button
            isDestructive
            isSmall
            onClick={(e) => {
              e.stopPropagation();
              setDeleteModal(submission.id);
            }}>
            {__('Delete', 'subtleforms')}
          </Button>
        </div>
      ),
    },
  ];

  if (error) {
    return <Notice status='error'>{error}</Notice>;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={submissions}
        totalItems={totalItems}
        currentPage={currentPage}
        perPage={perPage}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onPerPageChange={handlePerPageChange}
        loading={loading}
        emptyMessage={__('No submissions found.', 'subtleforms')}
        onRowClick={handleRowClick}
        selectable={true}
        selectedItems={selectedSubmissions}
        onSelectionChange={setSelectedSubmissions}
        bulkActions={[
          {
            label: __('Mark as Read', 'subtleforms'),
            onClick: (ids) => handleBulkMarkStatus(ids, 'read'),
          },
          {
            label: __('Mark as Unread', 'subtleforms'),
            onClick: (ids) => handleBulkMarkStatus(ids, 'unread'),
          },
          {
            label: __('Delete', 'subtleforms'),
            onClick: handleBulkDelete,
            isDestructive: true,
          },
        ]}
      />
      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={__('Delete Submission', 'subtleforms')}
        message={__(
          'Are you sure you want to delete this submission? This action cannot be undone.',
          'subtleforms'
        )}
        onConfirm={() => handleDelete(deleteModal)}
        confirmText={__('Delete Submission', 'subtleforms')}
        confirmVariant='destructive'
      />
    </>
  );
}
