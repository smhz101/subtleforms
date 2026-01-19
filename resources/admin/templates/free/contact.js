/**
 * Free Contact Templates
 */

import { __ } from '@wordpress/i18n';
import { textField, emailField, textareaField, selectField, fileField } from '../shared/fields';

export const simpleContact = {
  id: 'simple-contact',
  name: __('Simple Contact Form', 'subtleforms'),
  category: 'contact',
  description: __('Basic contact form with name, email, and message fields', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __('Name', 'subtleforms'),
        placeholder: __('Your name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email', 'subtleforms'),
        placeholder: __('your@email.com', 'subtleforms'),
        required: true,
      }),
      textareaField({
        key: 'message',
        label: __('Message', 'subtleforms'),
        placeholder: __('Your message here...', 'subtleforms'),
        required: true,
        rows: 5,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Simple Contact Form', 'subtleforms'),
      description: __('A simple contact form', 'subtleforms'),
      type: 'regular',
      template: 'simple-contact',
    },
  },
};

export const contactWithSubject = {
  id: 'contact-subject',
  name: __('Contact Form + Subject', 'subtleforms'),
  category: 'contact',
  description: __('Contact form with subject line for categorizing inquiries', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __('Your Name', 'subtleforms'),
        placeholder: __('John Doe', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        placeholder: __('john@example.com', 'subtleforms'),
        required: true,
      }),
      selectField({
        key: 'subject',
        label: __('Subject', 'subtleforms'),
        placeholder: __('What is this about?', 'subtleforms'),
        required: true,
        options: [
          { label: __('General Inquiry', 'subtleforms'), value: 'general' },
          { label: __('Sales Question', 'subtleforms'), value: 'sales' },
          { label: __('Technical Support', 'subtleforms'), value: 'support' },
          { label: __('Other', 'subtleforms'), value: 'other' },
        ],
      }),
      textareaField({
        key: 'message',
        label: __('Message', 'subtleforms'),
        placeholder: __('Tell us more...', 'subtleforms'),
        required: true,
        rows: 6,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Contact Form + Subject', 'subtleforms'),
      description: __('Contact form with subject categorization', 'subtleforms'),
      type: 'regular',
      template: 'contact-subject',
    },
  },
};

export const contactWithFile = {
  id: 'contact-file-upload',
  name: __('Contact + File Upload', 'subtleforms'),
  category: 'contact',
  description: __('Contact form allowing file attachments', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __('Name', 'subtleforms'),
        placeholder: __('Your name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email', 'subtleforms'),
        placeholder: __('your@email.com', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'subject',
        label: __('Subject', 'subtleforms'),
        placeholder: __('What is this regarding?', 'subtleforms'),
        required: true,
      }),
      textareaField({
        key: 'message',
        label: __('Message', 'subtleforms'),
        placeholder: __('Your message...', 'subtleforms'),
        required: true,
        rows: 4,
      }),
      fileField({
        key: 'attachment',
        label: __('Attachment (optional)', 'subtleforms'),
        required: false,
        accept: '.pdf,.doc,.docx,.jpg,.png',
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Contact + File Upload', 'subtleforms'),
      description: __('Contact form with file upload', 'subtleforms'),
      type: 'regular',
      template: 'contact-file-upload',
    },
  },
};

export const conversationalContact = {
  id: 'conversational-contact',
  name: __('Conversational Contact', 'subtleforms'),
  category: 'contact',
  description: __('One question at a time conversational contact form', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __("What's your name?", 'subtleforms'),
        placeholder: __('Your name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __("What's your email address?", 'subtleforms'),
        placeholder: __('your@email.com', 'subtleforms'),
        required: true,
      }),
      textareaField({
        key: 'message',
        label: __('What would you like to tell us?', 'subtleforms'),
        placeholder: __('Your message...', 'subtleforms'),
        required: true,
        rows: 5,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Conversational Contact', 'subtleforms'),
      description: __('Conversational contact form', 'subtleforms'),
      type: 'conversational',
      template: 'conversational-contact',
    },
  },
};
