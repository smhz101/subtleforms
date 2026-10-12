/**
 * Single source of truth for a form's type and status (admin JS).
 *
 * The Dashboard, All Forms, builder header and block picker each used to
 * derive type/status from different fields, so the same form showed
 * different values on different screens. This module centralises that.
 *
 * The server (src/Support/FormMeta.php) now attaches canonical `type`,
 * `status` and `has_unpublished_changes` to every form payload. These
 * selectors prefer those canonical fields and fall back to legacy fields
 * (form_type, metadata.type) for cached/older responses.
 */

import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';

export const FORM_TYPE_STANDARD = 'regular';
export const FORM_TYPE_MULTI_STEP = 'multi-step';
export const FORM_TYPE_CONVERSATIONAL = 'conversational';

export const FORM_STATUS_DRAFT = 'draft';
export const FORM_STATUS_PUBLISHED = 'published';
export const FORM_STATUS_ARCHIVED = 'archived';
export const FORM_STATUS_TRASH = 'trash';

/**
 * Normalise a raw type string to a canonical value.
 *
 * @param {string|null} raw Raw type.
 * @return {string} Canonical type constant.
 */
export function normalizeFormType(raw) {
  if (!raw || typeof raw !== 'string') {
    return FORM_TYPE_STANDARD;
  }
  const v = raw.toLowerCase();
  if (v === 'multistep' || v === 'sectioned' || v === 'multi-step' || v === 'multi_step') {
    return FORM_TYPE_MULTI_STEP;
  }
  if (v === 'conversational') {
    return FORM_TYPE_CONVERSATIONAL;
  }
  return FORM_TYPE_STANDARD;
}

/**
 * Normalise a raw status string to a canonical value.
 *
 * @param {string|null} raw Raw status.
 * @return {string} Canonical status constant.
 */
export function normalizeFormStatus(raw) {
  if (!raw || typeof raw !== 'string') {
    return FORM_STATUS_DRAFT;
  }
  const v = raw.toLowerCase();
  if (v === FORM_STATUS_PUBLISHED) return FORM_STATUS_PUBLISHED;
  if (v === FORM_STATUS_ARCHIVED) return FORM_STATUS_ARCHIVED;
  if (v === FORM_STATUS_TRASH) return FORM_STATUS_TRASH;
  return FORM_STATUS_DRAFT;
}

/**
 * Resolve the canonical type for a form object.
 *
 * Prefers the server's canonical `type`, then `form_type`, then
 * `metadata.type` (legacy), then the published config metadata.
 *
 * @param {object} form Form object from the API.
 * @return {string} Canonical type constant.
 */
export function getFormType(form) {
  if (!form) return FORM_TYPE_STANDARD;
  const raw = form.type || form.form_type || form.metadata?.type || form.config?.metadata?.type;
  return normalizeFormType(raw);
}

/**
 * Resolve the canonical status for a form object.
 *
 * @param {object} form Form object from the API.
 * @return {string} Canonical status constant.
 */
export function getFormStatus(form) {
  if (!form) return FORM_STATUS_DRAFT;
  return normalizeFormStatus(form.status);
}

/**
 * Whether a published form has unpublished draft changes.
 *
 * @param {object} form Form object from the API.
 * @return {boolean}
 */
export function hasUnpublishedChanges(form) {
  return !!(form && form.has_unpublished_changes);
}

/**
 * Badge config for a form type.
 *
 * @param {string} type Canonical type.
 * @return {{label: string, icon: object, classes: string, color: string}} Badge config.
 */
export function getFormTypeBadgeConfig(type) {
  const canonical = normalizeFormType(type);
  const map = {
    [FORM_TYPE_STANDARD]: {
      label: __('Standard', 'subtleforms'),
      icon: Icon.FileText,
      classes: 'sf-form-type-badge--regular',
      color: 'gray',
    },
    [FORM_TYPE_MULTI_STEP]: {
      label: __('Multi-step', 'subtleforms'),
      icon: Icon.Layers,
      classes: 'sf-form-type-badge--multistep',
      color: 'purple',
    },
    [FORM_TYPE_CONVERSATIONAL]: {
      label: __('Conversational', 'subtleforms'),
      icon: Icon.MessageCircle,
      classes: 'sf-form-type-badge--conversational',
      color: 'blue',
    },
  };
  return map[canonical] || map[FORM_TYPE_STANDARD];
}

/**
 * Badge config for a form status.
 *
 * A published form with unpublished draft changes renders as
 * "Published · unpublished changes" (warning style) rather than "Draft",
 * so the builder header and listings agree on what the label means.
 *
 * @param {string}   status                   Canonical status.
 * @param {boolean}  unpublishedChanges       Whether the form has unpublished draft changes.
 * @return {{label: string, icon: object, classes: string, color: string}} Badge config.
 */
export function getFormStatusBadgeConfig(status, unpublishedChanges = false) {
  const canonical = normalizeFormStatus(status);

  if (canonical === FORM_STATUS_TRASH) {
    return {
      label: __('Trashed', 'subtleforms'),
      icon: Icon.Trash,
      classes: 'sf-status-badge--trash',
      color: 'gray',
    };
  }

  if (canonical === FORM_STATUS_PUBLISHED && unpublishedChanges) {
    return {
      label: __('Published, changes not live', 'subtleforms'),
      icon: Icon.Edit,
      classes: 'sf-status-badge--unpublished',
      color: 'yellow',
    };
  }

  const map = {
    [FORM_STATUS_DRAFT]: {
      label: __('Draft', 'subtleforms'),
      icon: Icon.Edit,
      classes: 'sf-status-badge--draft',
      color: 'yellow',
    },
    [FORM_STATUS_PUBLISHED]: {
      label: __('Published', 'subtleforms'),
      icon: Icon.CheckCircle,
      classes: 'sf-status-badge--published',
      color: 'green',
    },
    [FORM_STATUS_ARCHIVED]: {
      label: __('Archived', 'subtleforms'),
      icon: Icon.Package,
      classes: 'sf-status-badge--archived',
      color: 'gray',
    },
  };
  return map[canonical] || map[FORM_STATUS_DRAFT];
}

/**
 * Convenience: type badge config for a form object.
 *
 * @param {object} form Form object.
 * @return {object} Badge config.
 */
export function getFormTypeBadge(form) {
  return getFormTypeBadgeConfig(getFormType(form));
}

/**
 * Convenience: status badge config for a form object.
 *
 * @param {object} form Form object.
 * @return {object} Badge config.
 */
export function getFormStatusBadge(form) {
  return getFormStatusBadgeConfig(getFormStatus(form), hasUnpublishedChanges(form));
}
