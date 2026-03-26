/**
 * Template Registry Index
 * Aggregates all templates and provides API
 *
 * @deprecated The TEMPLATES array and helper functions below (getTemplatesByCategory,
 * searchTemplates, getTemplateById) are not consumed by any UI component. Template
 * data is served from the REST API (GET /subtleforms/v1/templates) via useTemplates().
 * The only active export used outside this file is TEMPLATE_CATEGORIES (re-exported
 * from ./categories), which is still imported by CreateFormPage.jsx and TemplateSelector.jsx.
 */

// Re-export categories
export { TEMPLATE_CATEGORIES } from './categories';

// Import free templates
import {
  simpleContact,
  contactWithSubject,
  contactWithFile,
  conversationalContact,
} from './free/contact';

import { newsletterSignup, leadCapture, ebookDownload, multiStepLeadCapture } from './free/lead';

import { feedbackSurvey, npsSurvey, productReview } from './free/feedback';

// Import pro templates
import { advancedContact, salesInquiry, partnershipRequest } from './pro/contact';

import {
  eventRegistration,
  webinarSignup,
  courseEnrollment,
  membershipApplication,
  sectionedMembership,
} from './pro/registration';

import { supportTicket, bugReport, featureRequest, technicalSupport } from './pro/support';

import {
  paymentRequest,
  donationForm,
  invoicePayment,
  charityDonation,
  simplePayment,
} from './pro/payment';

/**
 * Aggregated template registry
 * Maintains exact same structure as before
 */
export const TEMPLATES = [
  // Free templates (11 total)
  simpleContact,
  contactWithSubject,
  contactWithFile,
  conversationalContact,
  newsletterSignup,
  leadCapture,
  ebookDownload,
  multiStepLeadCapture,
  feedbackSurvey,
  npsSurvey,
  productReview,

  // Pro templates (19 total)
  advancedContact,
  salesInquiry,
  partnershipRequest,
  eventRegistration,
  webinarSignup,
  courseEnrollment,
  membershipApplication,
  sectionedMembership,
  supportTicket,
  bugReport,
  featureRequest,
  technicalSupport,
  paymentRequest,
  donationForm,
  invoicePayment,
  charityDonation,
  simplePayment,
];

/**
 * Get templates by category
 * EXACT SAME API as before
 */
export function getTemplatesByCategory(categoryId) {
  if (categoryId === 'all') {
    return TEMPLATES;
  }
  return TEMPLATES.filter((t) => t.category === categoryId);
}

/**
 * Search templates by query
 * EXACT SAME API as before
 */
export function searchTemplates(query, categoryId = 'all') {
  let templates = getTemplatesByCategory(categoryId);

  if (!query || query.trim() === '') {
    return templates;
  }

  const lowerQuery = query.toLowerCase();
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get template by ID
 * EXACT SAME API as before
 */
export function getTemplateById(id) {
  return TEMPLATES.find((t) => t.id === id);
}
