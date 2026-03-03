import { useState, useEffect, useRef } from '@wordpress/element';
import { SearchControl, SelectControl } from '@wordpress/components';
import { Button } from '../components/navigation';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import SubmissionsTable from '../components/SubmissionsTable';
import useRealTimeUpdates from '../hooks/useRealTimeUpdates';
import './SubmissionsPage.scss';

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

export default function SubmissionsPage({ formId }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(formId || 'all');
  const [dateRange, setDateRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const submissionsTableRef = useRef(null);

  // Real-time updates for live badge and table refresh
  const { unreadCount, lastUpdate, isPolling } = useRealTimeUpdates({
    pollInterval: 30000, // Poll every 30 seconds
    enabled: true,
    onUnreadCountChange: (newCount, previousCount) => {
      // Update browser title badge if on submissions page
      if (document.title.includes('Submissions')) {
        document.title = document.title.replace(/\(\d+\)/, '');
        if (newCount > 0) {
          document.title = `(${newCount}) ${document.title}`;
        }
      }
    },
    onSubmissionsUpdate: () => {
      // Refresh the submissions table when changes detected
      if (
        submissionsTableRef.current &&
        submissionsTableRef.current.refreshData
      ) {
        submissionsTableRef.current.refreshData();
      }
    },
  });

  useEffect(() => {
    if (!formId) {
      // Load forms for filter dropdown
      apiGet('/forms')
        .then((data) => {
          if (Array.isArray(data)) {
            setForms(data);
          }
        })
        .catch(() => {});
    }
  }, [formId]);

  const title = formId
    ? __('Form Submissions', 'subtleforms')
    : __('All Submissions', 'subtleforms');

  const tabs = [
    { key: 'all', label: __('All', 'subtleforms') },
    { key: 'unread', label: __('Unread', 'subtleforms') },
    { key: 'read', label: __('Read', 'subtleforms') },
  ];

  const dateRangeOptions = [
    { label: __('All time', 'subtleforms'), value: 'all' },
    { label: __('Today', 'subtleforms'), value: 'today' },
    { label: __('Last 7 days', 'subtleforms'), value: '7days' },
    { label: __('Last 30 days', 'subtleforms'), value: '30days' },
    { label: __('Last 3 months', 'subtleforms'), value: '3months' },
  ];

  const formOptions = [
    { label: __('All forms', 'subtleforms'), value: 'all' },
    ...forms.map((form) => ({
      label:
        form.title ||
        sprintf(
          /* translators: %1$d: form id */ __('Form #%1$d', 'subtleforms'),
          form.id
        ),
      value: String(form.id),
    })),
  ];

  const hasActiveFilters =
    search ||
    statusFilter !== 'all' ||
    selectedFormId !== 'all' ||
    dateRange !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSelectedFormId(formId || 'all');
    setDateRange('all');
  };

  const exportSubmissions = async () => {
    setExporting(true);

    try {
      const response = await apiFetch({
        path: '/subtleforms/v1/submissions/export',
        method: 'POST',
        data: {
          form_id: selectedFormId !== 'all' ? parseInt(selectedFormId) : null,
          status: statusFilter !== 'all' ? statusFilter : null,
          search: search || null,
        },
      });

      if (response.success && response.csv) {
        // Decode base64 CSV
        const csvData = atob(response.csv);
        const blob = new Blob([csvData], {
          type: 'text/csv;charset=utf-8;',
        });

        // Create download link
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', response.filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(
          response.message || __('Failed to export submissions', 'subtleforms')
        );
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(__('Failed to export submissions', 'subtleforms'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminShell
      title={title}
      actionBarLeft={
        <TabBar
          tabs={tabs}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
        />
      }
      actionBarRight={
        <div className='sf-submissions-actions'>
          <Button
            variant='secondary'
            onClick={exportSubmissions}
            disabled={exporting}
            className='sf-button-height'>
            {exporting
              ? __('Exporting...', 'subtleforms')
              : __('Export CSV', 'subtleforms')}
          </Button>
          {!formId && (
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
              className='sf-button-height'>
              {showFilters
                ? __('Hide Filters', 'subtleforms')
                : __('Filters', 'subtleforms')}
            </Button>
          )}
          <SearchControl
            value={search}
            onChange={setSearch}
            placeholder={__('Search submissions...', 'subtleforms')}
          />
        </div>
      }>
      {/* Filter Bar */}
      {!formId && showFilters && (
        <div className='sf-filter-bar'>
          <SelectControl
            label={__('Form', 'subtleforms')}
            value={selectedFormId}
            options={formOptions}
            onChange={setSelectedFormId}
            className='sf-filter-control'
            style={{ minWidth: '200px' }}
          />
          <SelectControl
            label={__('Date Range', 'subtleforms')}
            value={dateRange}
            options={dateRangeOptions}
            onChange={setDateRange}
            className='sf-filter-control'
            style={{ minWidth: '200px' }}
          />
          {hasActiveFilters && (
            <Button
              variant='link'
              onClick={clearFilters}
              className='sf-filter-clear-link'
              style={{ marginTop: '22px' }}>
              {__('Clear all filters', 'subtleforms')}
            </Button>
          )}
        </div>
      )}

      <SubmissionsTable
        ref={submissionsTableRef}
        formId={selectedFormId !== 'all' ? parseInt(selectedFormId) : formId}
        showFormColumn={!formId && selectedFormId === 'all'}
        searchTerm={search}
        statusFilter={statusFilter}
        dateRange={dateRange}
      />
    </AdminShell>
  );
}
