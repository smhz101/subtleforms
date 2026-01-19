/**
 * Pro Contact Templates
 */

import { __ } from '@wordpress/i18n';
import { textField, emailField, phoneField, textareaField, selectField } from '../shared/fields';
import { nameGroup, addressGroup } from '../shared/groups';

export const advancedContact = {
  id: 'advanced-contact',
  name: __('Advanced Contact Form', 'subtleforms'),
  category: 'contact',
  description: __('Contact form with name group, address, phone, and message', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      nameGroup({
        key: 'name_group',
        label: __('Full Name', 'subtleforms'),
        required: true,
        enable_middle_name: true,
      }),
      emailField({
        key: 'email',
        label: __('Email', 'subtleforms'),
        placeholder: __('your@email.com', 'subtleforms'),
        required: true,
      }),
      phoneField({
        key: 'phone',
        label: __('Phone Number', 'subtleforms'),
        placeholder: __('+1 (555) 123-4567', 'subtleforms'),
        required: false,
      }),
      addressGroup({
        key: 'address_group',
        label: __('Address', 'subtleforms'),
        required: false,
        enable_street2: true,
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
      title: __('Advanced Contact Form', 'subtleforms'),
      description: __('Advanced contact form with full details', 'subtleforms'),
      type: 'regular',
      template: 'advanced-contact',
    },
  },
};

export const salesInquiry = {
  id: 'sales-inquiry',
  name: __('Sales Inquiry', 'subtleforms'),
  category: 'contact',
  description: __('Detailed sales inquiry form with budget and timeline', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      nameGroup({
        key: 'name_group',
        label: __('Your Name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        placeholder: __('you@company.com', 'subtleforms'),
        required: true,
      }),
      phoneField({
        key: 'phone',
        label: __('Phone Number', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'company',
        label: __('Company Name', 'subtleforms'),
        placeholder: __('Acme Inc.', 'subtleforms'),
        required: true,
      }),
      selectField({
        key: 'budget',
        label: __('Estimated Budget', 'subtleforms'),
        placeholder: __('Select budget range', 'subtleforms'),
        required: false,
        options: [
          { label: __('Under $5,000', 'subtleforms'), value: 'under-5k' },
          { label: __('$5,000 - $10,000', 'subtleforms'), value: '5k-10k' },
          { label: __('$10,000 - $25,000', 'subtleforms'), value: '10k-25k' },
          { label: __('$25,000 - $50,000', 'subtleforms'), value: '25k-50k' },
          { label: __('Over $50,000', 'subtleforms'), value: 'over-50k' },
        ],
      }),
      selectField({
        key: 'timeline',
        label: __('Project Timeline', 'subtleforms'),
        placeholder: __('When do you need this?', 'subtleforms'),
        required: false,
        options: [
          { label: __('Urgent (Within 1 month)', 'subtleforms'), value: 'urgent' },
          { label: __('1-3 months', 'subtleforms'), value: '1-3-months' },
          { label: __('3-6 months', 'subtleforms'), value: '3-6-months' },
          { label: __('6+ months', 'subtleforms'), value: '6plus-months' },
        ],
      }),
      textareaField({
        key: 'requirements',
        label: __('Project Requirements', 'subtleforms'),
        placeholder: __('Describe your needs...', 'subtleforms'),
        required: true,
        rows: 6,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Sales Inquiry', 'subtleforms'),
      description: __('Sales inquiry form', 'subtleforms'),
      type: 'regular',
      template: 'sales-inquiry',
    },
  },
};

export const partnershipRequest = {
  id: 'partnership-request',
  name: __('Partnership Request', 'subtleforms'),
  category: 'contact',
  description: __('Business partnership inquiry form', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      textField({
        key: 'contact_name',
        label: __('Your Name', 'subtleforms'),
        placeholder: __('John Doe', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'company_name',
        label: __('Company Name', 'subtleforms'),
        placeholder: __('Acme Corporation', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Business Email', 'subtleforms'),
        placeholder: __('john@acme.com', 'subtleforms'),
        required: true,
      }),
      phoneField({
        key: 'phone',
        label: __('Phone Number', 'subtleforms'),
        required: true,
      }),
      selectField({
        key: 'partnership_type',
        label: __('Type of Partnership', 'subtleforms'),
        placeholder: __('Select partnership type', 'subtleforms'),
        required: true,
        options: [
          { label: __('Strategic Partnership', 'subtleforms'), value: 'strategic' },
          { label: __('Reseller/Distributor', 'subtleforms'), value: 'reseller' },
          { label: __('Technology Integration', 'subtleforms'), value: 'integration' },
          { label: __('Affiliate/Referral', 'subtleforms'), value: 'affiliate' },
          { label: __('Other', 'subtleforms'), value: 'other' },
        ],
      }),
      textareaField({
        key: 'proposal',
        label: __('Partnership Proposal', 'subtleforms'),
        placeholder: __('Describe the partnership opportunity...', 'subtleforms'),
        required: true,
        rows: 8,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Partnership Request', 'subtleforms'),
      description: __('Business partnership request form', 'subtleforms'),
      type: 'regular',
      template: 'partnership-request',
    },
  },
};
