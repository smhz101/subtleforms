/**
 * Data Layer Index
 *
 * Central export point for all queries and mutations.
 */

// Query Keys
export { queryKeys } from './queryKeys';

// API Client
export { apiClient } from './apiClient';

// Queries
export {
  useForms,
  useForm,
  useFormStatus,
} from './queries/forms';

export { useTemplates } from './queries/templates';

export {
  useSubmissions,
  useSubmission,
} from './queries/submissions';

export {
  useSettings,
  useLicense,
} from './queries/settings';

export { useDashboardStats } from './queries/dashboard';

export { useSpamStats, useSpamProtection } from './queries/spam';
export { useSpamProtectionAction } from './mutations/spam';

export { useImportOffer } from './queries/importOffer';
export { useImportOfferAction } from './mutations/importOffer';

// Mutations
export {
  useCreateForm,
  useUpdateForm,
  useDeleteForm,
  useDuplicateForm,
  useUpdateFormStatus,
} from './mutations/forms';

export {
  useDeleteSubmission,
  useMarkSubmissionRead,
} from './mutations/submissions';

export {
  useUpdateSettings,
  useActivateLicense,
  useDeactivateLicense,
  useValidateLicense,
} from './mutations/settings';
