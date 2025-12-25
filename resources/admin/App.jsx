import { useState } from '@wordpress/element';
import { Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FormsList from './components/FormsList';
import FormsPage from './components/FormsPage';
import SubmissionsPage from './components/SubmissionsPage';
import SubmissionDetailPage from './components/SubmissionDetailPage';
import ExecutionLog from './components/ExecutionLog';
import FormBuilder from './components/FormBuilder';
import CreateFormModal from './components/CreateFormModal';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';

export default function App() {
  const mount = document.getElementById('subtleforms-admin-app');
  const page = mount ? mount.dataset.page : 'dashboard';
  const initialFormId =
    mount && mount.dataset.formId ? parseInt(mount.dataset.formId, 10) : null;
  const initialSubmissionId =
    mount && mount.dataset.submissionId
      ? parseInt(mount.dataset.submissionId, 10)
      : null;

  // Debug: expose mount info to console for troubleshooting
  // Remove or silence after debugging
  // eslint-disable-next-line no-console
  console.debug('SubtleForms admin mount', {
    page,
    formId: initialFormId,
    submissionId: initialSubmissionId,
  });

  const [selectedForm, setSelectedForm] = useState(initialFormId);
  const [selectedSubmission, setSelectedSubmission] =
    useState(initialSubmissionId);
  const [view, setView] = useState('list');
  // Only show create modal if on form-editor page AND no form_id is present
  const [showCreateModal, setShowCreateModal] = useState(
    page === 'form-editor' && !initialFormId
  );

  function handleFormSaved(detail) {
    if (detail?.id) {
      setSelectedForm(detail.id);
    }
  }

  function handleModalClose() {
    setShowCreateModal(false);
    // Redirect to forms list when modal is closed without creating a form
    if (page === 'form-editor' && !initialFormId) {
      window.location.href = 'admin.php?page=subtleforms-forms';
    }
  }

  function handleFormCreated(formId) {
    setShowCreateModal(false);
    // Navigate to the builder page with the new form ID
    window.location.href = `admin.php?page=subtleforms-new-form&form_id=${formId}`;
  }

  return (
    <div>
      <Panel>
        <PanelBody>
          {page === 'forms-list' && <FormsPage />}
          {page === 'submissions-list' && (
            <SubmissionsPage formId={initialFormId || null} />
          )}
          {page === 'submissions' && (
            <SubmissionsPage formId={initialFormId || null} />
          )}
          {page === 'submission-detail' && initialSubmissionId && (
            <SubmissionDetailPage
              submissionId={initialSubmissionId}
              formId={initialFormId}
              onBack={() => {
                window.location.href = initialFormId
                  ? `admin.php?page=subtleforms-submissions&form_id=${initialFormId}`
                  : 'admin.php?page=subtleforms-submissions';
              }}
            />
          )}
          {page === 'dashboard' && <Dashboard />}
          {page === 'settings' && <Settings />}
          {page === 'form-editor' && !!initialFormId && (
            <FormBuilder
              formId={initialFormId}
              onSaved={handleFormSaved}
              onClose={() => {
                window.location.href = 'admin.php?page=subtleforms-forms';
              }}
            />
          )}
          {selectedSubmission && (
            <ExecutionLog submissionId={selectedSubmission} />
          )}
        </PanelBody>
      </Panel>
      <CreateFormModal
        isOpen={showCreateModal}
        onClose={handleModalClose}
        onFormCreated={handleFormCreated}
      />
    </div>
  );
}
