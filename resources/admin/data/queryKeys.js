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
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'],
    stats: () => [...queryKeys.dashboard.all, 'stats'],
  },

  // Spam protection (2.6.0)
  spam: {
    all: ['spam'],
    stats: (days, formId) => ['spam', 'stats', { days, formId }],
    protection: () => ['spam', 'protection'],
  },

  // Fresh-install import offer (2.7.2)
  importOffer: {
    all: ['importOffer'],
    status: () => ['importOffer', 'status'],
  },

  // Email marketing services and their connection state
  emailMarketing: {
    root: ['emailMarketing'],
    all: () => ['emailMarketing', 'all'],
    state: (service) => ['emailMarketing', 'state', service],
    lists: (service) => ['emailMarketing', 'lists', service],
    fields: (service, listId) => ['emailMarketing', 'fields', service, listId || ''],
    templates: () => ['emailMarketing', 'templates'],
  },

  // Settings > Tools and Settings > Logs
  logs: {
    all: ['logs'],
    list: (kind, filters) => ['logs', kind, filters],
  },

  // Extensions
  extensions: {
    all: ['extensions'],
    list: () => [...queryKeys.extensions.all, 'list'],
  },
};
