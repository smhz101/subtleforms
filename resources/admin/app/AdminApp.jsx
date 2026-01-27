/**
 * Admin Application Root
 *
 * Main application component that handles routing and global providers.
 */

import { useState } from '@wordpress/element';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { NoticeProvider, ErrorBoundary } from '../ui/feedback';
import { ModalProvider } from '../ui/modals';

// Query Client Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// Pages
import DashboardPage from '../pages/DashboardPage';
import SettingsPage from '../pages/SettingsPage';
import FormsPage from '../pages/FormsPage';
import SubmissionsPage from '../pages/SubmissionsPage';
import SubmissionDetailPage from '../pages/SubmissionDetailPage';
import BuilderPage from '../pages/BuilderPage';
import ExtensionsPage from '../pages/ExtensionsPage';

// Modals
import { CreateFormModal } from '../modals';

// Utils
import { ROUTES, getRouteConfig } from './routes';

export default function AdminApp() {
  const config = getRouteConfig();
  const {
    page,
    formId: initialFormId,
    submissionId: initialSubmissionId,
  } = config;

  // Debug: expose mount info to console for troubleshooting
  console.debug('SubtleForms admin mount', {
    page,
    formId: initialFormId,
    submissionId: initialSubmissionId,
  });

  // Modal state - only show create modal if on form-editor page AND no form_id is present
  const [showCreateModal, setShowCreateModal] = useState(
    page === ROUTES.FORM_EDITOR && !initialFormId
  );

  function handleModalClose() {
    setShowCreateModal(false);
    // Redirect to forms list when modal is closed without creating a form
    if (page === ROUTES.FORM_EDITOR && !initialFormId) {
      window.location.href = 'admin.php?page=subtleforms-forms';
    }
  }

  function handleFormCreated(formId) {
    setShowCreateModal(false);
    // Navigate to the builder page with the new form ID
    window.location.href = `admin.php?page=subtleforms-new-form&form_id=${formId}`;
  }

  function handleFormSaved(detail) {
    console.debug('Form saved:', detail);
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <ModalProvider>
            <div>
      <Panel>
        <PanelBody>
          {page === ROUTES.DASHBOARD && <DashboardPage />}

          {page === ROUTES.FORMS_LIST && <FormsPage />}

          {(page === ROUTES.SUBMISSIONS_LIST ||
            page === ROUTES.SUBMISSIONS) && (
            <SubmissionsPage formId={initialFormId || null} />
          )}

          {page === ROUTES.SUBMISSION_DETAIL && initialSubmissionId && (
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

          {page === ROUTES.SETTINGS && <SettingsPage />}

          {page === ROUTES.EXTENSIONS && <ExtensionsPage />}

          {page === ROUTES.FORM_EDITOR && !!initialFormId && (
            <BuilderPage
              formId={initialFormId}
              onSaved={handleFormSaved}
              onClose={() => {
                window.location.href = 'admin.php?page=subtleforms-forms';
              }}
            />
          )}
        </PanelBody>
      </Panel>

      <CreateFormModal
        isOpen={showCreateModal}
        onClose={handleModalClose}
        onFormCreated={handleFormCreated}
      />
            </div>
          </ModalProvider>
        </NoticeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
