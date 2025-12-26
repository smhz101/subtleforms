import Joi from 'joi';
import { __ } from '@wordpress/i18n';

/**
 * Settings validation schema with detailed error messages
 */
export const settingsSchema = Joi.object({
  // General Settings
  default_form_status: Joi.string()
    .valid('draft', 'published')
    .required()
    .messages({
      'any.only': __('Default form status must be either "draft" or "published"', 'subtleforms'),
      'any.required': __('Default form status is required', 'subtleforms'),
    }),

  autosave_enabled: Joi.boolean()
    .required()
    .messages({
      'boolean.base': __('Autosave enabled must be true or false', 'subtleforms'),
      'any.required': __('Autosave enabled setting is required', 'subtleforms'),
    }),

  autosave_interval: Joi.number()
    .integer()
    .min(1)
    .max(60)
    .required()
    .messages({
      'number.base': __('Autosave interval must be a number', 'subtleforms'),
      'number.integer': __('Autosave interval must be a whole number', 'subtleforms'),
      'number.min': __('Autosave interval must be at least 1 second', 'subtleforms'),
      'number.max': __('Autosave interval cannot exceed 60 seconds (1 minute)', 'subtleforms'),
      'any.required': __('Autosave interval is required', 'subtleforms'),
    }),

  delete_behavior: Joi.string()
    .valid('soft', 'hard')
    .required()
    .messages({
      'any.only': __('Delete behavior must be either "soft" or "hard"', 'subtleforms'),
      'any.required': __('Delete behavior is required', 'subtleforms'),
    }),

  // Frontend Settings
  success_message: Joi.string()
    .max(500)
    .allow('')
    .required()
    .messages({
      'string.base': __('Success message must be text', 'subtleforms'),
      'string.max': __('Success message cannot exceed 500 characters', 'subtleforms'),
      'any.required': __('Success message is required', 'subtleforms'),
    }),

  error_message: Joi.string()
    .max(500)
    .allow('')
    .required()
    .messages({
      'string.base': __('Error message must be text', 'subtleforms'),
      'string.max': __('Error message cannot exceed 500 characters', 'subtleforms'),
      'any.required': __('Error message is required', 'subtleforms'),
    }),

  redirect_after_submit: Joi.string()
    .uri({ allowRelative: true })
    .allow('')
    .max(500)
    .messages({
      'string.uri': __('Redirect URL must be a valid URL', 'subtleforms'),
      'string.max': __('Redirect URL cannot exceed 500 characters', 'subtleforms'),
    }),

  submission_limit_enabled: Joi.boolean()
    .required()
    .messages({
      'boolean.base': __('Submission limit enabled must be true or false', 'subtleforms'),
      'any.required': __('Submission limit enabled setting is required', 'subtleforms'),
    }),

  submission_limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .required()
    .messages({
      'number.base': __('Submission limit must be a number', 'subtleforms'),
      'number.integer': __('Submission limit must be a whole number', 'subtleforms'),
      'number.min': __('Submission limit must be at least 1', 'subtleforms'),
      'number.max': __('Submission limit cannot exceed 100', 'subtleforms'),
      'any.required': __('Submission limit is required', 'subtleforms'),
    }),

  // Email Settings
  admin_notification_enabled: Joi.boolean()
    .required()
    .messages({
      'boolean.base': __('Admin notification setting must be true or false', 'subtleforms'),
      'any.required': __('Admin notification setting is required', 'subtleforms'),
    }),

  user_confirmation_enabled: Joi.boolean()
    .required()
    .messages({
      'boolean.base': __('User confirmation setting must be true or false', 'subtleforms'),
      'any.required': __('User confirmation setting is required', 'subtleforms'),
    }),

  sender_name: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.base': __('Sender name must be text', 'subtleforms'),
      'string.max': __('Sender name cannot exceed 100 characters', 'subtleforms'),
    }),

  sender_email: Joi.string()
    .email({ tlds: { allow: false } })
    .allow('')
    .messages({
      'string.email': __('Sender email must be a valid email address', 'subtleforms'),
    }),

  admin_email: Joi.string()
    .email({ tlds: { allow: false } })
    .allow('')
    .messages({
      'string.email': __('Admin email must be a valid email address', 'subtleforms'),
    }),

  // Advanced Settings
  debug_mode: Joi.boolean()
    .required()
    .messages({
      'boolean.base': __('Debug mode must be true or false', 'subtleforms'),
      'any.required': __('Debug mode setting is required', 'subtleforms'),
    }),

  log_retention_days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .required()
    .messages({
      'number.base': __('Log retention must be a number', 'subtleforms'),
      'number.integer': __('Log retention must be a whole number', 'subtleforms'),
      'number.min': __('Log retention must be at least 1 day', 'subtleforms'),
      'number.max': __('Log retention cannot exceed 365 days (1 year)', 'subtleforms'),
      'any.required': __('Log retention setting is required', 'subtleforms'),
    }),
});

/**
 * Validate settings and return user-friendly errors
 *
 * @param {Object} settings - Settings object to validate
 * @returns {Object} - { valid: boolean, errors: Object, value: Object }
 */
export function validateSettings(settings) {
  const { error, value } = settingsSchema.validate(settings, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = {};
    error.details.forEach((detail) => {
      errors[detail.path[0]] = detail.message;
    });

    return {
      valid: false,
      errors,
      value: null,
    };
  }

  return {
    valid: true,
    errors: {},
    value,
  };
}

/**
 * Validate a single field
 *
 * @param {string} fieldName - Field name
 * @param {*} value - Field value
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateField(fieldName, value) {
  const fieldSchema = settingsSchema.extract(fieldName);

  if (!fieldSchema) {
    return { valid: true, error: null };
  }

  const { error } = fieldSchema.validate(value);

  if (error) {
    return {
      valid: false,
      error: error.message,
    };
  }

  return {
    valid: true,
    error: null,
  };
}
