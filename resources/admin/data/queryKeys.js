/**
 * Query Keys Registry
 *
 * Centralized query key definitions for TanStack Query.
 * Use factory functions to ensure consistency and type safety.
 */

export const queryKeys = {
  // Forms
  forms: {
    all: ['forms'],
    lists: () => [...queryKeys.forms.all, 'list'],
    list: (filters) => [...queryKeys.forms.lists(), { filters }],
    details: () => [...queryKeys.forms.all, 'detail'],
    detail: (id) => [...queryKeys.forms.details(), id],
    status: (id) => [...queryKeys.forms.detail(id), 'status'],
  },

  // Templates
  templates: {
    all: ['templates'],
    lists: () => [...queryKeys.templates.all, 'list'],
    list: (filters) => [...queryKeys.templates.lists(), { filters }],
  },

  // Submissions
  submissions: {
    all: ['submissions'],
    lists: () => [...queryKeys.submissions.all, 'list'],
    list: (formId, filters) => [
      ...queryKeys.submissions.lists(),
      { formId, filters },
    ],
    details: () => [...queryKeys.submissions.all, 'detail'],
    detail: (id) => [...queryKeys.submissions.details(), id],
  },

  // Settings
  settings: {
    all: ['settings'],
    general: () => [...queryKeys.settings.all, 'general'],
    integrations: () => [...queryKeys.settings.all, 'integrations'],
    license: () => [...queryKeys.settings.all, 'license'],
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'],
    stats: () => [...queryKeys.dashboard.all, 'stats'],
  },

  // Extensions
  extensions: {
    all: ['extensions'],
    list: () => [...queryKeys.extensions.all, 'list'],
  },
};
