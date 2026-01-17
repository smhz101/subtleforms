import Joi from 'joi';
import { __ } from '@wordpress/i18n';

/**
 * Settings validation schema using Joi
 */
export const settingsSchema = Joi.object({
  // General Settings
  default_form_status: Joi.string()
    .valid('draft', 'published')
    .required()
    .messages({
      'any.only': __('Form status must be either draft or published', 'subtleforms'),
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
      'number.max': __('Autosave interval cannot exceed 60 seconds', 'subtleforms'),
      'any.required': __('Autosave interval is required', 'subtleforms'),
    }),

  delete_behavior: Joi.string()
    .valid('soft', 'hard')
    .required()
    .messages({
      'any.only': __('Delete behavior must be either soft or hard', 'subtleforms'),
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
      'number.max': __('Submission limit cannot exceed 100 submissions', 'subtleforms'),
      'any.required': __('Submission limit is required', 'subtleforms'),
    }),

  // Email Settings
  admin_notification_enabled: Joi.boolean()
    .required()
    .messages({
      'boolean.base': __('Admin notifications setting must be true or false', 'subtleforms'),
      'any.required': __('Admin notifications setting is required', 'subtleforms'),
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

  // Security Settings
  enable_honeypot: Joi.boolean().messages({
    'boolean.base': __('Honeypot protection must be true or false', 'subtleforms'),
  }),

  min_submission_time: Joi.number()
    .integer()
    .min(0)
    .max(60)
    .messages({
      'number.base': __('Minimum submission time must be a number', 'subtleforms'),
      'number.integer': __('Minimum submission time must be a whole number', 'subtleforms'),
      'number.min': __('Minimum submission time cannot be negative', 'subtleforms'),
      'number.max': __('Minimum submission time cannot exceed 60 seconds', 'subtleforms'),
    }),

  captcha_enabled: Joi.boolean()
    .required()
    .messages({
      'boolean.base': __('Captcha enabled must be true or false', 'subtleforms'),
      'any.required': __('Captcha enabled setting is required', 'subtleforms'),
    }),

  captcha_provider: Joi.string()
    .valid('', 'recaptcha', 'hcaptcha', 'turnstile')
    .allow('')
    .messages({
      'any.only': __('Captcha provider must be recaptcha, hcaptcha, or turnstile', 'subtleforms'),
    }),

  // CAPTCHA provider enable flags
  captcha_recaptcha_enabled: Joi.boolean()
    .messages({
      'boolean.base': __('reCAPTCHA enabled must be true or false', 'subtleforms'),
    }),

  captcha_hcaptcha_enabled: Joi.boolean()
    .messages({
      'boolean.base': __('hCaptcha enabled must be true or false', 'subtleforms'),
    }),

  captcha_turnstile_enabled: Joi.boolean()
    .messages({
      'boolean.base': __('Turnstile enabled must be true or false', 'subtleforms'),
    }),

  // reCAPTCHA settings
  captcha_recaptcha_version: Joi.string()
    .valid('v2', 'v3')
    .allow('')
    .messages({
      'any.only': __('reCAPTCHA version must be v2 or v3', 'subtleforms'),
    }),

  captcha_recaptcha_site_key: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': __('reCAPTCHA site key cannot exceed 100 characters', 'subtleforms'),
    }),

  captcha_recaptcha_secret_key: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': __('reCAPTCHA secret key cannot exceed 100 characters', 'subtleforms'),
    }),

  // hCaptcha settings
  captcha_hcaptcha_site_key: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': __('hCaptcha site key cannot exceed 100 characters', 'subtleforms'),
    }),

  captcha_hcaptcha_secret_key: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': __('hCaptcha secret key cannot exceed 100 characters', 'subtleforms'),
    }),

  // Turnstile settings
  captcha_turnstile_site_key: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': __('Turnstile site key cannot exceed 100 characters', 'subtleforms'),
    }),

  captcha_turnstile_secret_key: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': __('Turnstile secret key cannot exceed 100 characters', 'subtleforms'),
    }),
});

/**
 * Validate settings and return formatted error messages
 *
 * @param {Object} settings Settings object to validate
 * @returns {Object} { isValid: boolean, errors: Object }
 */
export function validateSettings(settings) {
  const { error } = settingsSchema.validate(settings, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (!error) {
    return { isValid: true, errors: {} };
  }

  // Format errors by field
  const errors = {};
  error.details.forEach((detail) => {
    const field = detail.path[0];
    if (!errors[field]) {
      errors[field] = [];
    }
    errors[field].push(detail.message);
  });

  return { isValid: false, errors };
}

/**
 * Validate a single field
 *
 * @param {string} field Field name
 * @param {any} value Field value
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateField(field, value) {
  const fieldSchema = settingsSchema.extract(field);
  if (!fieldSchema) {
    return { isValid: true, error: null };
  }

  const { error } = fieldSchema.validate(value);

  return {
    isValid: !error,
    error: error ? error.message : null,
  };
}
