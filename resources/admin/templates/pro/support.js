/**
 * Pro Support Templates
 */

import { __ } from '@wordpress/i18n';
import { textField, emailField, textareaField, selectField, fileField } from '../shared/fields';

export const supportTicket = {
  id: 'support-ticket',
  name: __('Support Ticket', 'subtleforms'),
  category: 'support',
  description: __('Help desk support ticket submission form', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __('Your Name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      selectField({
        key: 'priority',
        label: __('Priority', 'subtleforms'),
        required: true,
        options: [
          { label: __('Low', 'subtleforms'), value: 'low' },
          { label: __('Medium', 'subtleforms'), value: 'medium' },
          { label: __('High', 'subtleforms'), value: 'high' },
          { label: __('Urgent', 'subtleforms'), value: 'urgent' },
        ],
      }),
      textField({
        key: 'subject',
        label: __('Subject', 'subtleforms'),
        required: true,
      }),
      textareaField({
        key: 'description',
        label: __('Issue Description', 'subtleforms'),
        required: true,
        rows: 6,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Support Ticket', 'subtleforms'),
      description: __('Support ticket form', 'subtleforms'),
      type: 'regular',
      template: 'support-ticket',
    },
  },
};

export const bugReport = {
  id: 'bug-report',
  name: __('Bug Report', 'subtleforms'),
  category: 'support',
  description: __('Detailed bug reporting form for developers', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      textField({
        key: 'reporter_name',
        label: __('Your Name', 'subtleforms'),
        placeholder: __('John Doe', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'bug_title',
        label: __('Bug Title', 'subtleforms'),
        placeholder: __('Brief description of the issue', 'subtleforms'),
        required: true,
      }),
      selectField({
        key: 'severity',
        label: __('Severity Level', 'subtleforms'),
        placeholder: __('How severe is this bug?', 'subtleforms'),
        required: true,
        options: [
          { label: __('Critical - System Down', 'subtleforms'), value: 'critical' },
          { label: __('High - Major Feature Broken', 'subtleforms'), value: 'high' },
          { label: __('Medium - Minor Feature Issue', 'subtleforms'), value: 'medium' },
          { label: __('Low - Cosmetic Issue', 'subtleforms'), value: 'low' },
        ],
      }),
      textareaField({
        key: 'steps_to_reproduce',
        label: __('Steps to Reproduce', 'subtleforms'),
        placeholder: __('1. Go to...\n2. Click on...\n3. See error', 'subtleforms'),
        required: true,
        rows: 5,
      }),
      textareaField({
        key: 'expected_behavior',
        label: __('Expected Behavior', 'subtleforms'),
        placeholder: __('What should happen?', 'subtleforms'),
        required: true,
        rows: 3,
      }),
      textareaField({
        key: 'actual_behavior',
        label: __('Actual Behavior', 'subtleforms'),
        placeholder: __('What actually happens?', 'subtleforms'),
        required: true,
        rows: 3,
      }),
      textField({
        key: 'browser',
        label: __('Browser & Version', 'subtleforms'),
        placeholder: __('Chrome 120.0', 'subtleforms'),
        required: false,
      }),
      fileField({
        key: 'screenshot',
        label: __('Screenshot (optional)', 'subtleforms'),
        required: false,
        accept: '.jpg,.jpeg,.png,.gif',
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Bug Report', 'subtleforms'),
      description: __('Bug report form', 'subtleforms'),
      type: 'regular',
      template: 'bug-report',
    },
  },
};

export const featureRequest = {
  id: 'feature-request',
  name: __('Feature Request', 'subtleforms'),
  category: 'support',
  description: __('Product feature request submission form', 'subtleforms'),
  is_pro: true,
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
        required: true,
      }),
      textField({
        key: 'feature_title',
        label: __('Feature Title', 'subtleforms'),
        placeholder: __('What feature do you want?', 'subtleforms'),
        required: true,
      }),
      selectField({
        key: 'category',
        label: __('Feature Category', 'subtleforms'),
        placeholder: __('Select category', 'subtleforms'),
        required: true,
        options: [
          { label: __('User Interface', 'subtleforms'), value: 'ui' },
          { label: __('Performance', 'subtleforms'), value: 'performance' },
          { label: __('Integration', 'subtleforms'), value: 'integration' },
          { label: __('Security', 'subtleforms'), value: 'security' },
          { label: __('Other', 'subtleforms'), value: 'other' },
        ],
      }),
      textareaField({
        key: 'description',
        label: __('Feature Description', 'subtleforms'),
        placeholder: __('Describe the feature in detail...', 'subtleforms'),
        required: true,
        rows: 6,
      }),
      textareaField({
        key: 'use_case',
        label: __('Use Case / Problem It Solves', 'subtleforms'),
        placeholder: __('Why do you need this feature?', 'subtleforms'),
        required: true,
        rows: 4,
      }),
      selectField({
        key: 'priority',
        label: __('How important is this to you?', 'subtleforms'),
        placeholder: __('Select priority', 'subtleforms'),
        required: false,
        options: [
          { label: __('Critical - Need it urgently', 'subtleforms'), value: 'critical' },
          { label: __('High - Would use frequently', 'subtleforms'), value: 'high' },
          { label: __('Medium - Nice to have', 'subtleforms'), value: 'medium' },
          { label: __('Low - Minor improvement', 'subtleforms'), value: 'low' },
        ],
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Feature Request', 'subtleforms'),
      description: __('Feature request form', 'subtleforms'),
      type: 'regular',
      template: 'feature-request',
    },
  },
};

export const technicalSupport = {
  id: 'technical-support',
  name: __('Technical Support', 'subtleforms'),
  category: 'support',
  description: __('Technical support request with system details', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __('Your Name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'account_id',
        label: __('Account ID / License Key', 'subtleforms'),
        placeholder: __('Your account identifier', 'subtleforms'),
        required: false,
      }),
      selectField({
        key: 'issue_type',
        label: __('Issue Type', 'subtleforms'),
        placeholder: __('What kind of issue?', 'subtleforms'),
        required: true,
        options: [
          { label: __('Installation Problem', 'subtleforms'), value: 'installation' },
          { label: __('Configuration Issue', 'subtleforms'), value: 'configuration' },
          { label: __('Performance Problem', 'subtleforms'), value: 'performance' },
          { label: __('Error Message', 'subtleforms'), value: 'error' },
          { label: __('Other Technical Issue', 'subtleforms'), value: 'other' },
        ],
      }),
      textareaField({
        key: 'issue_description',
        label: __('Issue Description', 'subtleforms'),
        placeholder: __('Describe the technical issue...', 'subtleforms'),
        required: true,
        rows: 6,
      }),
      textField({
        key: 'system_info',
        label: __('System Information', 'subtleforms'),
        placeholder: __('OS, Browser, Plugin versions, etc.', 'subtleforms'),
        required: false,
      }),
      fileField({
        key: 'log_file',
        label: __('Log File / Screenshot (optional)', 'subtleforms'),
        required: false,
        accept: '.log,.txt,.jpg,.png,.pdf',
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Technical Support', 'subtleforms'),
      description: __('Technical support request form', 'subtleforms'),
      type: 'regular',
      template: 'technical-support',
    },
  },
};
