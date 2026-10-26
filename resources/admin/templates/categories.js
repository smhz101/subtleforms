/**
 * Template Categories
 */

import { __ } from '@wordpress/i18n';

export const TEMPLATE_CATEGORIES = [
  { id: 'all', label: __('All Templates', 'subtleforms') },
  { id: 'contact', label: __('Contact', 'subtleforms') },
  { id: 'lead', label: __('Lead Generation', 'subtleforms') },
  { id: 'events', label: __('Events & Webinars', 'subtleforms') },
  { id: 'feedback', label: __('Feedback', 'subtleforms') },
  { id: 'survey', label: __('Surveys & Research', 'subtleforms') },
  { id: 'registration', label: __('Registration', 'subtleforms') },
  { id: 'hr', label: __('HR & Recruitment', 'subtleforms') },
  { id: 'ecommerce', label: __('E-Commerce', 'subtleforms') },
  { id: 'support', label: __('Support', 'subtleforms') },
  { id: 'healthcare', label: __('Healthcare', 'subtleforms') },
  { id: 'legal', label: __('Legal & Compliance', 'subtleforms') },
];

/**
 * The categories to list for a set of templates: the ones above, then any
 * category an add-on's templates use, named by their `category_label`.
 *
 * @param {Array} templates Templates.
 * @return {Array<{id: string, label: string}>} Categories.
 */
export function templateCategories(templates = []) {
  const known = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
  const extra = [];
  (Array.isArray(templates) ? templates : []).forEach((t) => {
    const id = t && typeof t.category === 'string' ? t.category : '';
    if (!id || known.has(id)) return;
    known.add(id);
    const label = typeof t.category_label === 'string' && t.category_label ? t.category_label : id.charAt(0).toUpperCase() + id.slice(1);
    extra.push({ id, label });
  });
  return [...TEMPLATE_CATEGORIES, ...extra];
}
