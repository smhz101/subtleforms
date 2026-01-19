/**
 * Free Feedback Templates
 */

import { __ } from '@wordpress/i18n';
import { textField, emailField, textareaField, selectField, numberField } from '../shared/fields';

export const feedbackSurvey = {
  id: 'feedback-survey',
  name: __('Customer Feedback', 'subtleforms'),
  category: 'feedback',
  description: __('Gather customer feedback and satisfaction ratings', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'name',
        label: __('Name', 'subtleforms'),
        placeholder: __('Your name', 'subtleforms'),
        required: false,
      }),
      emailField({
        key: 'email',
        label: __('Email', 'subtleforms'),
        placeholder: __('your@email.com', 'subtleforms'),
        required: false,
      }),
      selectField({
        key: 'rating',
        label: __('How satisfied are you with our service?', 'subtleforms'),
        placeholder: __('Select rating', 'subtleforms'),
        required: true,
        options: [
          { label: __('Very Satisfied', 'subtleforms'), value: '5' },
          { label: __('Satisfied', 'subtleforms'), value: '4' },
          { label: __('Neutral', 'subtleforms'), value: '3' },
          { label: __('Dissatisfied', 'subtleforms'), value: '2' },
          { label: __('Very Dissatisfied', 'subtleforms'), value: '1' },
        ],
      }),
      textareaField({
        key: 'feedback',
        label: __('Additional Comments', 'subtleforms'),
        placeholder: __('Tell us more...', 'subtleforms'),
        required: false,
        rows: 4,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Customer Feedback', 'subtleforms'),
      description: __('Customer feedback survey', 'subtleforms'),
      type: 'regular',
      template: 'feedback-survey',
    },
  },
};

export const npsSurvey = {
  id: 'nps-survey',
  name: __('NPS Survey', 'subtleforms'),
  category: 'feedback',
  description: __('Net Promoter Score survey to measure customer loyalty', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      emailField({
        key: 'email',
        label: __('Email Address', 'subtleforms'),
        placeholder: __('your@email.com', 'subtleforms'),
        required: false,
      }),
      numberField({
        key: 'nps_score',
        label: __('How likely are you to recommend us to a friend? (0-10)', 'subtleforms'),
        placeholder: '10',
        required: true,
        min: 0,
        max: 10,
      }),
      textareaField({
        key: 'reason',
        label: __('What is the main reason for your score?', 'subtleforms'),
        placeholder: __('Please explain...', 'subtleforms'),
        required: false,
        rows: 4,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('NPS Survey', 'subtleforms'),
      description: __('Net Promoter Score survey', 'subtleforms'),
      type: 'regular',
      template: 'nps-survey',
    },
  },
};

export const productReview = {
  id: 'product-review',
  name: __('Product Review', 'subtleforms'),
  category: 'feedback',
  description: __('Collect product reviews and ratings from customers', 'subtleforms'),
  is_pro: false,
  schema: {
    fields: [
      textField({
        key: 'reviewer_name',
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
        key: 'rating',
        label: __('Product Rating', 'subtleforms'),
        placeholder: __('Select rating', 'subtleforms'),
        required: true,
        options: [
          { label: __('5 Stars - Excellent', 'subtleforms'), value: '5' },
          { label: __('4 Stars - Good', 'subtleforms'), value: '4' },
          { label: __('3 Stars - Average', 'subtleforms'), value: '3' },
          { label: __('2 Stars - Poor', 'subtleforms'), value: '2' },
          { label: __('1 Star - Terrible', 'subtleforms'), value: '1' },
        ],
      }),
      textField({
        key: 'review_title',
        label: __('Review Title', 'subtleforms'),
        placeholder: __('Sum up your experience', 'subtleforms'),
        required: true,
      }),
      textareaField({
        key: 'review_text',
        label: __('Your Review', 'subtleforms'),
        placeholder: __('Share your experience with this product...', 'subtleforms'),
        required: true,
        rows: 6,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Product Review', 'subtleforms'),
      description: __('Product review form', 'subtleforms'),
      type: 'regular',
      template: 'product-review',
    },
  },
};
