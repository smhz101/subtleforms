/**
 * Pro Payment Templates
 */

import { __ } from '@wordpress/i18n';
import {
  textField,
  emailField,
  phoneField,
  textareaField,
  selectField,
  numberField,
} from '../shared/fields';
import { nameGroup, addressGroup } from '../shared/groups';

export const paymentRequest = {
  id: 'payment-request',
  name: __('Payment Request', 'subtleforms'),
  category: 'payment',
  description: __('Invoice payment request form', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      nameGroup({
        key: 'name_group',
        label: __('Payer Name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      phoneField({
        key: 'phone',
        label: __('Phone Number', 'subtleforms'),
        required: false,
      }),
      textField({
        key: 'invoice_number',
        label: __('Invoice Number', 'subtleforms'),
        placeholder: __('INV-12345', 'subtleforms'),
        required: true,
      }),
      numberField({
        key: 'amount',
        label: __('Payment Amount', 'subtleforms'),
        placeholder: '0.00',
        required: true,
        min: 0.01,
      }),
      selectField({
        key: 'payment_method',
        label: __('Payment Method', 'subtleforms'),
        placeholder: __('Select payment method', 'subtleforms'),
        required: true,
        options: [
          { label: __('Credit Card', 'subtleforms'), value: 'credit_card' },
          { label: __('Debit Card', 'subtleforms'), value: 'debit_card' },
          { label: __('PayPal', 'subtleforms'), value: 'paypal' },
          { label: __('Bank Transfer', 'subtleforms'), value: 'bank_transfer' },
        ],
      }),
      textareaField({
        key: 'notes',
        label: __('Payment Notes (optional)', 'subtleforms'),
        placeholder: __('Any additional information...', 'subtleforms'),
        required: false,
        rows: 3,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Payment Request', 'subtleforms'),
      description: __('Payment request form', 'subtleforms'),
      type: 'regular',
      template: 'payment-request',
    },
  },
};

export const donationForm = {
  id: 'donation-form',
  name: __('Donation Form', 'subtleforms'),
  category: 'payment',
  description: __('Online donation form for nonprofits', 'subtleforms'),
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
        required: true,
      }),
      phoneField({
        key: 'phone',
        label: __('Phone Number', 'subtleforms'),
        required: false,
      }),
      selectField({
        key: 'donation_amount',
        label: __('Donation Amount', 'subtleforms'),
        placeholder: __('Select amount', 'subtleforms'),
        required: true,
        options: [
          { label: __('$25', 'subtleforms'), value: '25' },
          { label: __('$50', 'subtleforms'), value: '50' },
          { label: __('$100', 'subtleforms'), value: '100' },
          { label: __('$250', 'subtleforms'), value: '250' },
          { label: __('$500', 'subtleforms'), value: '500' },
          { label: __('Custom Amount', 'subtleforms'), value: 'custom' },
        ],
      }),
      selectField({
        key: 'donation_type',
        label: __('Donation Type', 'subtleforms'),
        placeholder: __('One-time or recurring?', 'subtleforms'),
        required: true,
        options: [
          { label: __('One-Time Donation', 'subtleforms'), value: 'one_time' },
          { label: __('Monthly Donation', 'subtleforms'), value: 'monthly' },
          { label: __('Annual Donation', 'subtleforms'), value: 'annual' },
        ],
      }),
      checkboxField({
        key: 'anonymous',
        label: __('Make this donation anonymous', 'subtleforms'),
        required: false,
      }),
      textareaField({
        key: 'dedication',
        label: __('Dedication Message (optional)', 'subtleforms'),
        placeholder: __('In honor/memory of...', 'subtleforms'),
        required: false,
        rows: 3,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Donation Form', 'subtleforms'),
      description: __('Donation form', 'subtleforms'),
      type: 'regular',
      template: 'donation-form',
    },
  },
};

export const invoicePayment = {
  id: 'invoice-payment',
  name: __('Invoice Payment', 'subtleforms'),
  category: 'payment',
  description: __('Pay outstanding invoices online', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      textField({
        key: 'customer_name',
        label: __('Customer Name', 'subtleforms'),
        placeholder: __('John Doe', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'invoice_number',
        label: __('Invoice Number', 'subtleforms'),
        placeholder: __('INV-2024-001', 'subtleforms'),
        required: true,
      }),
      numberField({
        key: 'amount_due',
        label: __('Amount Due', 'subtleforms'),
        placeholder: '0.00',
        required: true,
        min: 0.01,
      }),
      addressGroup({
        key: 'billing_address',
        label: __('Billing Address', 'subtleforms'),
        required: true,
        enable_street2: true,
      }),
      selectField({
        key: 'payment_method',
        label: __('Payment Method', 'subtleforms'),
        placeholder: __('How would you like to pay?', 'subtleforms'),
        required: true,
        options: [
          { label: __('Credit Card', 'subtleforms'), value: 'credit_card' },
          { label: __('Bank Transfer', 'subtleforms'), value: 'bank_transfer' },
          { label: __('PayPal', 'subtleforms'), value: 'paypal' },
        ],
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Invoice Payment', 'subtleforms'),
      description: __('Invoice payment form', 'subtleforms'),
      type: 'regular',
      template: 'invoice-payment',
    },
  },
};

export const charityDonation = {
  id: 'charity-donation',
  name: __('Charity Donation', 'subtleforms'),
  category: 'payment',
  description: __('Simple donation form with payment processing', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      nameGroup({
        key: 'donor_name',
        label: __('Donor Name', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      numberField({
        key: 'amount',
        label: __('Donation Amount', 'subtleforms'),
        placeholder: '50.00',
        required: true,
        min: 1,
      }),
      selectField({
        key: 'currency',
        label: __('Currency', 'subtleforms'),
        placeholder: __('Select currency', 'subtleforms'),
        required: true,
        options: [
          { label: __('USD ($)', 'subtleforms'), value: 'usd' },
          { label: __('EUR (€)', 'subtleforms'), value: 'eur' },
          { label: __('GBP (£)', 'subtleforms'), value: 'gbp' },
        ],
      }),
      selectField({
        key: 'payment_method',
        label: __('Payment Method', 'subtleforms'),
        placeholder: __('How would you like to pay?', 'subtleforms'),
        required: true,
        options: [
          { label: __('Credit Card', 'subtleforms'), value: 'credit_card' },
          { label: __('PayPal', 'subtleforms'), value: 'paypal' },
          { label: __('Bank Transfer', 'subtleforms'), value: 'bank_transfer' },
        ],
      }),
      textareaField({
        key: 'message',
        label: __('Message (optional)', 'subtleforms'),
        placeholder: __('Leave a message...', 'subtleforms'),
        required: false,
        rows: 3,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Charity Donation', 'subtleforms'),
      description: __('Charity donation form', 'subtleforms'),
      type: 'payment',
      template: 'charity-donation',
    },
  },
};

export const simplePayment = {
  id: 'simple-payment',
  name: __('Simple Payment Request', 'subtleforms'),
  category: 'payment',
  description: __('Quick payment request with invoice reference', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      textField({
        key: 'invoice_id',
        label: __('Invoice ID', 'subtleforms'),
        placeholder: __('INV-2024-001', 'subtleforms'),
        required: true,
      }),
      numberField({
        key: 'amount',
        label: __('Amount Due', 'subtleforms'),
        placeholder: '0.00',
        required: true,
        min: 0.01,
      }),
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      selectField({
        key: 'payment_method',
        label: __('Payment Method', 'subtleforms'),
        placeholder: __('Select payment method', 'subtleforms'),
        required: true,
        options: [
          { label: __('Credit Card', 'subtleforms'), value: 'credit_card' },
          { label: __('Debit Card', 'subtleforms'), value: 'debit_card' },
          { label: __('PayPal', 'subtleforms'), value: 'paypal' },
        ],
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Simple Payment Request', 'subtleforms'),
      description: __('Simple payment request form', 'subtleforms'),
      type: 'payment',
      template: 'simple-payment',
    },
  },
};

// Import checkboxField from fields
import { checkboxField } from '../shared/fields';
