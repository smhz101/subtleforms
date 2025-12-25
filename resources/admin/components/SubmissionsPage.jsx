import { useState, useEffect } from '@wordpress/element';
import { SearchControl, SelectControl, Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import AdminShell from './AdminShell';
import TabBar from './TabBar';
import SubmissionsTable from './SubmissionsTable';

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
      label: form.title || sprintf(__('Form #%d', 'subtleforms'), form.id),
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

  return (
    <AdminShell
      title={title}
      noScroll={true}
      actionBarLeft={
        <TabBar
          tabs={tabs}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
        />
      }
      actionBarRight={
        <div className='flex items-center gap-2'>
          {!formId && (
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
              className='h-9'>
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
        <div className='flex items-center gap-4 bg-gray-50 px-6 py-4 border-gray-200 border-b'>
          <SelectControl
            label={__('Form', 'subtleforms')}
            value={selectedFormId}
            options={formOptions}
            onChange={setSelectedFormId}
            className='m-0'
            style={{ minWidth: '200px' }}
          />
          <SelectControl
            label={__('Date Range', 'subtleforms')}
            value={dateRange}
            options={dateRangeOptions}
            onChange={setDateRange}
            className='m-0'
            style={{ minWidth: '200px' }}
          />
          {hasActiveFilters && (
            <Button
              variant='link'
              onClick={clearFilters}
              className='text-sm'
              style={{ marginTop: '22px' }}>
              {__('Clear all filters', 'subtleforms')}
            </Button>
          )}
        </div>
      )}

      <SubmissionsTable
        formId={selectedFormId !== 'all' ? parseInt(selectedFormId) : formId}
        showFormColumn={!formId && selectedFormId === 'all'}
        searchTerm={search}
        statusFilter={statusFilter}
        dateRange={dateRange}
      />
    </AdminShell>
  );
}
