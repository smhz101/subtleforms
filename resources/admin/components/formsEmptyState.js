import { __ } from '@wordpress/i18n';

/**
 * Empty-state copy for the forms table.
 *
 * Search wins over the tab. The first-install message is only for an empty
 * All list; Trash, Draft and Published each say what that view is missing.
 *
 * @param {string} searchTerm
 * @param {string} statusFilter
 * @return {{ title: string, text: string, showCreate: boolean }}
 */
export function formsEmptyState(searchTerm, statusFilter = 'all') {
  if (searchTerm) {
    return {
      title: __('No forms match your search', 'subtleforms'),
      text: __('Try a different name, or clear the search.', 'subtleforms'),
      showCreate: false,
    };
  }

  switch (statusFilter) {
    case 'trash':
      return {
        title: __('The trash is empty', 'subtleforms'),
        text: __(
          'Forms you move to the trash show up here until you restore or delete them.',
          'subtleforms'
        ),
        showCreate: false,
      };
    case 'draft':
      return {
        title: __('No draft forms', 'subtleforms'),
        text: __('Drafts you are still editing will show up here.', 'subtleforms'),
        showCreate: false,
      };
    case 'published':
      return {
        title: __('No published forms', 'subtleforms'),
        text: __('Forms you publish will show up here.', 'subtleforms'),
        showCreate: false,
      };
    case 'all':
      return {
        title: __('Create your first form', 'subtleforms'),
        text: __(
          'Start from a template or a blank canvas. You can switch layouts any time.',
          'subtleforms'
        ),
        showCreate: true,
      };
    default:
      return {
        title: __('No forms here', 'subtleforms'),
        text: __('Nothing in this view yet.', 'subtleforms'),
        showCreate: false,
      };
  }
}

