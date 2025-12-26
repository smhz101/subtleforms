/**
 * Admin Application Routes
 *
 * Centralized routing logic for the SubtleForms admin interface.
 */

export const ROUTES = {
  DASHBOARD: 'dashboard',
  FORMS_LIST: 'forms-list',
  FORM_EDITOR: 'form-editor',
  SUBMISSIONS_LIST: 'submissions-list',
  SUBMISSIONS: 'submissions',
  SUBMISSION_DETAIL: 'submission-detail',
  SETTINGS: 'settings',
};

/**
 * Get route configuration from DOM mount point
 */
export function getRouteConfig() {
  const mount = document.getElementById('subtleforms-admin-app');

  if (!mount) {
    return {
      page: ROUTES.DASHBOARD,
      formId: null,
      submissionId: null,
    };
  }

  return {
    page: mount.dataset.page || ROUTES.DASHBOARD,
    formId: mount.dataset.formId ? parseInt(mount.dataset.formId, 10) : null,
    submissionId: mount.dataset.submissionId ? parseInt(mount.dataset.submissionId, 10) : null,
  };
}
