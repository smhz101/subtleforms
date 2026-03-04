/**
 * DataTable Stories
 */
import { useState } from '@wordpress/element';
import DataTable from '../components/DataTable';

export default {
  title: 'Components/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

const columns = [
  { key: 'title', title: 'Form Title', sortable: true, width: '40%' },
  { key: 'status', title: 'Status', sortable: true, width: '15%' },
  { key: 'submissions', title: 'Submissions', sortable: true, width: '15%' },
  { key: 'created', title: 'Created', sortable: true, width: '20%' },
];

const sampleData = [
  { id: 1, title: 'Contact Form', status: 'Published', submissions: 142, created: '2024-01-15' },
  { id: 2, title: 'Newsletter Signup', status: 'Published', submissions: 398, created: '2024-02-01' },
  { id: 3, title: 'Job Application', status: 'Draft', submissions: 0, created: '2024-03-10' },
  { id: 4, title: 'Feedback Survey', status: 'Published', submissions: 57, created: '2024-03-22' },
  { id: 5, title: 'Event Registration', status: 'Draft', submissions: 0, created: '2024-04-05' },
];

function ControlledTable(props) {
  const [sortBy, setSortBy] = useState('created');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);

  return (
    <div style={{ padding: 24 }}>
      <DataTable
        {...props}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={(col, dir) => { setSortBy(col); setSortDirection(dir); }}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
  );
}

export const Default = {
  render: () => (
    <ControlledTable
      columns={columns}
      data={sampleData}
      totalItems={sampleData.length}
      perPage={10}
    />
  ),
};

export const Loading = {
  render: () => (
    <div style={{ padding: 24 }}>
      <DataTable
        columns={columns}
        data={[]}
        totalItems={0}
        perPage={10}
        loading={true}
        sortBy="created"
        sortDirection="desc"
        currentPage={1}
        onSort={() => {}}
        onPageChange={() => {}}
      />
    </div>
  ),
};

export const Empty = {
  render: () => (
    <div style={{ padding: 24 }}>
      <DataTable
        columns={columns}
        data={[]}
        totalItems={0}
        perPage={10}
        loading={false}
        sortBy="created"
        sortDirection="desc"
        currentPage={1}
        onSort={() => {}}
        onPageChange={() => {}}
        emptyMessage="No forms found. Create your first form to get started."
      />
    </div>
  ),
};

export const WithBulkActions = {
  render: () => {
    const [selected, setSelected] = useState([]);
    return (
      <div style={{ padding: 24 }}>
        <DataTable
          columns={columns}
          data={sampleData}
          totalItems={sampleData.length}
          perPage={10}
          loading={false}
          sortBy="created"
          sortDirection="desc"
          currentPage={1}
          onSort={() => {}}
          onPageChange={() => {}}
          selectable={true}
          selectedItems={selected}
          onSelectionChange={setSelected}
          bulkActions={[
            { label: 'Delete Selected', isDestructive: true, onClick: (ids) => alert(`Delete: ${ids.join(', ')}`) },
            { label: 'Publish Selected', onClick: (ids) => alert(`Publish: ${ids.join(', ')}`) },
          ]}
        />
      </div>
    );
  },
};

export const WithRowActions = {
  render: () => (
    <ControlledTable
      columns={columns}
      data={sampleData}
      totalItems={sampleData.length}
      perPage={10}
      rowActions={(row) => [
        { label: 'Edit', onClick: () => alert(`Edit: ${row.title}`) },
        { label: 'Delete', isDestructive: true, onClick: () => alert(`Delete: ${row.title}`) },
      ]}
    />
  ),
};
