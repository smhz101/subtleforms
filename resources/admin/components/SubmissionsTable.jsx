import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  Button,
  SelectControl,
  SearchControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import AdminTable from './AdminTable';

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
  searchTerm,
  statusFilter = 'all',
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
    currentPage,
    perPage,
    sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

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

  const handleRowClick = (submission) => {
    if (onRowClick) {
      onRowClick(submission);
    } else {
      window.location.href = `admin.php?page=subtleforms-submission-detail&submission_id=${
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
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            status === 'unread'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
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
        <Button
          isSecondary
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick(submission);
          }}>
          {__('View', 'subtleforms')}
        </Button>
      ),
    },
  ];

  if (error) {
    return <Notice status='error'>{error}</Notice>;
  }

  return (
    <AdminTable
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
    />
  );
}
