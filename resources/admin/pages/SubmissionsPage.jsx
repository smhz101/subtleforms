import { useState, useRef, useEffect } from '@wordpress/element';
import { SearchControl, SelectControl } from '@wordpress/components';
import { Button } from '../components/navigation';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import SubmissionsTable, { ALL_COLUMNS, DEFAULT_VISIBLE, COLUMN_LABELS } from '../components/SubmissionsTable';
import useRealTimeUpdates from '../hooks/useRealTimeUpdates';
import { isProFeature, requirePro } from '../utils/featureGate';
import { Icon } from '../ui';
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
  const [processingStatus, setProcessingStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const submissionsTableRef = useRef(null);

  // Column visibility — persisted to localStorage (domain-scoped, survives logout)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('sf_visible_cols');
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch {
      return DEFAULT_VISIBLE;
    }
  });
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef(null);

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key];
      try {
        localStorage.setItem('sf_visible_cols', JSON.stringify(next));
      } catch { /* no-op */ }
      return next;
    });
  };

  // Close column picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    const handle = (e) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showColPicker]);

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
    ? __('Form submissions', 'subtleforms')
    : __('Submissions', 'subtleforms');

  const tabs = [
    { key: 'all', label: __('All', 'subtleforms') },
    {
      key: 'unread',
      label: __('New', 'subtleforms'),
      count: unreadCount > 0 ? unreadCount : undefined,
    },
    { key: 'read', label: __('Read', 'subtleforms') },
    { key: 'spam', label: __('Spam', 'subtleforms') },
    { key: 'starred', label: __('Starred', 'subtleforms') },
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
    fieldValue ||
    processingStatus;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSelectedFormId(formId || 'all');
    setDateRange('all');
    setFieldValue('');
    setDebouncedFieldValue('');
    setProcessingStatus('');
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
        // Decode base64 to raw bytes. Passing the atob() string straight to
        // Blob re-encodes every byte as UTF-8, which garbles accents and the BOM.
        const binary = atob(response.csv);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
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
      description={__(
        'Every entry from every form. Open one to read it, reply, or see what happened after it was sent.',
        'subtleforms'
      )}
      actions={
        <Button
          variant='secondary'
          onClick={() => requirePro('submissions.export', exportSubmissions)}
          disabled={exporting}
          icon={!canExport && !exporting ? <Icon.Lock size={14} /> : <Icon.DownloadCloud size={16} />}
          className={!canExport && !exporting ? 'sf-export-btn--locked' : undefined}>
          {exporting
            ? __('Exporting…', 'subtleforms')
            : __('Export CSV', 'subtleforms')}
          {!canExport && !exporting && (
            <span className='sf-pro-tag'>{__('Pro', 'subtleforms')}</span>
          )}
        </Button>
      }
      actionBarLeft={
        <TabBar
          tabs={tabs}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
        />
      }
      actionBarRight={
        <div className='sf-submissions-actions'>
          <div ref={colPickerRef} className='sf-col-picker'>
            <Button
              variant='secondary'
              onClick={() => setShowColPicker((v) => !v)}
              className='sf-button-height sf-col-picker__toggle'
              title={__('Show/hide columns', 'subtleforms')}>
              <Icon.Columns size={16} />
              <span>{__('View', 'subtleforms')}</span>
              <Icon.ChevronDown size={14} />
            </Button>
            {showColPicker && (
              <div className='sf-col-picker__dropdown'>
                {ALL_COLUMNS.filter((k) => k !== 'actions').map((key) => (
                  <label key={key} className='sf-col-picker__item'>
                    <input
                      type='checkbox'
                      checked={visibleColumns.includes(key)}
                      onChange={() => toggleColumn(key)}
                    />
                    <span>{COLUMN_LABELS[key] || key}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {!formId && (
            <Button
              variant='secondary'
              isPressed={showFilters}
              icon={<Icon.Sliders size={16} />}
              onClick={() => setShowFilters(!showFilters)}>
              {__('Filters', 'subtleforms')}
              {hasActiveFilters && <span className='sf-filter-dot' aria-hidden='true' />}
            </Button>
          )}
          <SearchControl
            value={search}
            onChange={handleSearchChange}
            placeholder={__('Search submissions', 'subtleforms')}
            __nextHasNoMarginBottom
            size='compact'
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
          <SelectControl
            label={__('Result', 'subtleforms')}
            value={processingStatus}
            options={[
              { label: __('All results', 'subtleforms'), value: '' },
              { label: __('Completed', 'subtleforms'), value: 'completed' },
              { label: __('Failed', 'subtleforms'), value: 'failed' },
              { label: __('Awaiting Payment', 'subtleforms'), value: 'payment_pending' },
              { label: __('Processing', 'subtleforms'), value: 'processing' },
            ]}
            onChange={setProcessingStatus}
            className='sf-filter-control'
            style={{ minWidth: '180px' }}
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
                {__('Search responses', 'subtleforms')}
              </label>
              <input
                type='text'
                className='sf-filter-field-search__input'
                aria-label={__('Filter by field value', 'subtleforms')}
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
        processingStatus={processingStatus}
        visibleColumns={visibleColumns}
      />


    </AdminShell>
  );
}
