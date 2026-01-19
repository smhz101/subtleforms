/**
 * Free Lead Generation Templates
 */

import { __ } from '@wordpress/i18n';
import { textField, emailField, textareaField, checkboxField, selectField } from '../shared/fields';
import { nameGroup } from '../shared/groups';

export const newsletterSignup = {
  id: 'newsletter-signup',
  name: __('Newsletter Signup', 'subtleforms'),
  category: 'lead',
  description: __('Collect email addresses for your newsletter', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'first_name',
        label: __('First Name', 'subtleforms'),
        placeholder: __('John', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        placeholder: __('your@email.com', 'subtleforms'),
        required: true,
      }),
      checkboxField({
        key: 'consent',
        label: __('I agree to receive email updates', 'subtleforms'),
        required: true,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Newsletter Signup', 'subtleforms'),
      description: __('Newsletter subscription form', 'subtleforms'),
      type: 'regular',
      template: 'newsletter-signup',
    },
  },
};

export const leadCapture = {
  id: 'lead-capture',
  name: __('Lead Capture Form', 'subtleforms'),
  category: 'lead',
  description: __('Capture leads with name, email, and company information', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'full_name',
        label: __('Full Name', 'subtleforms'),
        placeholder: __('John Doe', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Work Email', 'subtleforms'),
        placeholder: __('john@company.com', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'company',
        label: __('Company Name', 'subtleforms'),
        placeholder: __('Acme Inc.', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'job_title',
        label: __('Job Title', 'subtleforms'),
        placeholder: __('Marketing Manager', 'subtleforms'),
        required: false,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Lead Capture Form', 'subtleforms'),
      description: __('Business lead capture form', 'subtleforms'),
      type: 'regular',
      template: 'lead-capture',
    },
  },
};

export const ebookDownload = {
  id: 'ebook-download',
  name: __('Ebook Download', 'subtleforms'),
  category: 'lead',
  description: __('Gate content downloads with email capture', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __('Your Name', 'subtleforms'),
        placeholder: __('Jane Smith', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        placeholder: __('jane@example.com', 'subtleforms'),
        required: true,
      }),
      checkboxField({
        key: 'marketing_consent',
        label: __('Send me updates about similar resources', 'subtleforms'),
        required: false,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Ebook Download', 'subtleforms'),
      description: __('Content download lead magnet', 'subtleforms'),
      type: 'regular',
      template: 'ebook-download',
    },
  },
};

export const multiStepLeadCapture = {
  id: 'multistep-lead-capture',
  name: __('Multi-Step Lead Capture', 'subtleforms'),
  category: 'lead',
  description: __('Progressive lead capture form across multiple steps', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      {
        type: 'step',
        key: `step_${Date.now()}`,
        title: __('Contact Information', 'subtleforms'),
        description: __("Let's start with your details", 'subtleforms'),
        fields: [
          nameGroup({
            key: 'name_group',
            label: __('Your Name', 'subtleforms'),
            required: true,
          }),
          emailField({
            key: 'email',
            label: __('Email Address', 'subtleforms'),
            required: true,
          }),
        ],
      },
      {
        type: 'step',
        key: `step_${Date.now() + 1}`,
        title: __('Company Details', 'subtleforms'),
        description: __('Tell us about your organization', 'subtleforms'),
        fields: [
          textField({
            key: 'company',
            label: __('Company Name', 'subtleforms'),
            placeholder: __('Acme Inc.', 'subtleforms'),
            required: true,
          }),
          selectField({
            key: 'role',
            label: __('Your Role', 'subtleforms'),
            placeholder: __('Select your role', 'subtleforms'),
            required: true,
            options: [
              { label: __('Executive', 'subtleforms'), value: 'executive' },
              { label: __('Manager', 'subtleforms'), value: 'manager' },
              { label: __('Individual Contributor', 'subtleforms'), value: 'contributor' },
              { label: __('Other', 'subtleforms'), value: 'other' },
            ],
          }),
        ],
      },
      {
        type: 'step',
        key: `step_${Date.now() + 2}`,
        title: __('Your Goals', 'subtleforms'),
        description: __('How can we help you?', 'subtleforms'),
        fields: [
          textareaField({
            key: 'goals',
            label: __('What are you looking to achieve?', 'subtleforms'),
            placeholder: __('Tell us about your goals...', 'subtleforms'),
            required: true,
            rows: 5,
          }),
        ],
      },
    ],
    metadata: {
      name: 'form_schema',
      title: __('Multi-Step Lead Capture', 'subtleforms'),
      description: __('Progressive lead capture form', 'subtleforms'),
      type: 'multistep',
      template: 'multistep-lead-capture',
    },
  },
};
