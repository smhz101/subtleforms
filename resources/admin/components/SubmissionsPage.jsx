import SubmissionsTable from './SubmissionsTable';

export default function SubmissionsPage({ formId }) {
  return (
    <div className='wrap subtleforms-admin'>
      <SubmissionsTable formId={formId} showFormColumn={!formId} />
    </div>
  );
}
