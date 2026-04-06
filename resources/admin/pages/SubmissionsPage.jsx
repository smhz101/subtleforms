import { useState, useRef } from '@wordpress/element';
import { SearchControl, SelectControl } from '@wordpress/components';
import { Button } from '../components/navigation';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import SubmissionsTable from '../components/SubmissionsTable';
import useRealTimeUpdates from '../hooks/useRealTimeUpdates';
import { isProFeature, requirePro } from '../utils/featureGate';
import { Icon } from '../components/ui';
import apiFetch from '@wordpress/api-fetch';
import { useForms } from '../data';
import './SubmissionsPage.scss';

export default function SubmissionsPage({ formId }) {
  const canExport = isProFeature('submissions.export');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedFormId, setSelectedFormId] = useState(formId || 'all');
  const [dateRange, setDateRange] = useState('all');
  const [fieldValue, setFieldValue] = useState('');
  const [debouncedFieldValue, setDebouncedFieldValue] = useState('');
  const fieldValueTimerRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const submissionsTableRef = useRef(null);

  const { data: formsData = [] } = useForms({}, { enabled: !formId });

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

  const forms = Array.isArray(formsData) ? formsData : [];

  const handleSearchChange = (value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const handleFieldValueChange = (value) => {
    setFieldValue(value);
    clearTimeout(fieldValueTimerRef.current);
    fieldValueTimerRef.current = setTimeout(() => {
      setDebouncedFieldValue(value);
    }, 400);
  };

  const title = formId
    ? __('Form Submissions', 'subtleforms')
    : __('All Submissions', 'subtleforms');

  const tabs = [
    { key: 'all', label: __('All', 'subtleforms') },
    {
      key: 'unread',
      label: __('Unread', 'subtleforms'),
      count: unreadCount > 0 ? unreadCount : undefined,
    },
    { key: 'read', label: __('Read', 'subtleforms') },
    { key: 'spam', label: __('Spam', 'subtleforms') },
    { key: 'flagged', label: __('Flagged', 'subtleforms') },
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
    dateRange !== 'all' ||
    fieldValue;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSelectedFormId(formId || 'all');
    setDateRange('all');
    setFieldValue('');
    setDebouncedFieldValue('');
  };

  const getExportAfterDate = (range) => {
    const now = new Date();
    switch (range) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate())
          .toISOString()
          .split('T')[0];
      case '7days':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
      case '3months':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
      default:
        return null;
    }
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
          after: getExportAfterDate(dateRange),
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
            onClick={() => requirePro('submissions.export', exportSubmissions)}
            disabled={exporting}
            title={!canExport && !exporting ? __('Export all submissions to CSV instantly', 'subtleforms') : undefined}
            className={`sf-button-height${!canExport && !exporting ? ' sf-export-btn--locked' : ''}`}>
            {exporting ? (
              __('Exporting...', 'subtleforms')
            ) : !canExport ? (
              <>
                <Icon.Lock size={13} className='sf-export-btn__icon' />
                {__('Export CSV (Pro)', 'subtleforms')}
              </>
            ) : __('Export CSV', 'subtleforms')}
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
            onChange={handleSearchChange}
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
          {showFilters && (
            <div className='sf-filter-field-search'>
              <label className='sf-filter-field-search__label'>
                {__('Payload contains', 'subtleforms')}
              </label>
              <input
                type='text'
                className='sf-filter-field-search__input'
                value={fieldValue}
                onChange={(e) => handleFieldValueChange(e.target.value)}
                placeholder={__('e.g. john@example.com', 'subtleforms')}
              />
            </div>
          )}
        </div>
      )}

      <SubmissionsTable
        ref={submissionsTableRef}
        formId={selectedFormId !== 'all' ? parseInt(selectedFormId) : formId}
        showFormColumn={!formId && selectedFormId === 'all'}
        searchTerm={debouncedSearch}
        statusFilter={statusFilter}
        dateRange={dateRange}
        fieldValue={debouncedFieldValue}
      />


    </AdminShell>
  );
}
