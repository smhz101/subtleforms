/**
 * Pro Registration Templates
 */

import { __ } from '@wordpress/i18n';
import {
  textField,
  emailField,
  phoneField,
  textareaField,
  selectField,
  numberField,
  dateField,
} from '../shared/fields';
import { nameGroup } from '../shared/groups';

export const eventRegistration = {
  id: 'event-registration',
  name: __('Event Registration', 'subtleforms'),
  category: 'registration',
  description: __('Multi-step event registration with attendee details', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      {
        type: 'step',
        key: `step_${Date.now()}`,
        title: __('Personal Information', 'subtleforms'),
        description: __('Tell us about yourself', 'subtleforms'),
        fields: [
          nameGroup({
            key: 'name_group',
            label: __('Full Name', 'subtleforms'),
            required: true,
          }),
          emailField({
            key: 'email',
            label: __('Email', 'subtleforms'),
            required: true,
          }),
          phoneField({
            key: 'phone',
            label: __('Phone Number', 'subtleforms'),
            required: true,
          }),
        ],
      },
      {
        type: 'step',
        key: `step_${Date.now() + 1}`,
        title: __('Event Details', 'subtleforms'),
        description: __('Choose your preferences', 'subtleforms'),
        fields: [
          selectField({
            key: 'ticket_type',
            label: __('Ticket Type', 'subtleforms'),
            required: true,
            options: [
              { label: __('General Admission', 'subtleforms'), value: 'general' },
              { label: __('VIP', 'subtleforms'), value: 'vip' },
            ],
          }),
          numberField({
            key: 'attendees',
            label: __('Number of Attendees', 'subtleforms'),
            required: true,
            min: 1,
            max: 10,
          }),
        ],
      },
    ],
    metadata: {
      name: 'form_schema',
      title: __('Event Registration', 'subtleforms'),
      description: __('Event registration form', 'subtleforms'),
      type: 'multistep',
      template: 'event-registration',
    },
  },
};

export const webinarSignup = {
  id: 'webinar-signup',
  name: __('Webinar Signup', 'subtleforms'),
  category: 'registration',
  description: __('Register attendees for online webinars', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      textField({
        key: 'first_name',
        label: __('First Name', 'subtleforms'),
        placeholder: __('Jane', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'last_name',
        label: __('Last Name', 'subtleforms'),
        placeholder: __('Smith', 'subtleforms'),
        required: true,
      }),
      emailField({
        key: 'email',
        label: __('Work Email', 'subtleforms'),
        placeholder: __('jane@company.com', 'subtleforms'),
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
        placeholder: __('Marketing Director', 'subtleforms'),
        required: false,
      }),
      selectField({
        key: 'industry',
        label: __('Industry', 'subtleforms'),
        placeholder: __('Select your industry', 'subtleforms'),
        required: false,
        options: [
          { label: __('Technology', 'subtleforms'), value: 'technology' },
          { label: __('Healthcare', 'subtleforms'), value: 'healthcare' },
          { label: __('Finance', 'subtleforms'), value: 'finance' },
          { label: __('Education', 'subtleforms'), value: 'education' },
          { label: __('Retail', 'subtleforms'), value: 'retail' },
          { label: __('Other', 'subtleforms'), value: 'other' },
        ],
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Webinar Signup', 'subtleforms'),
      description: __('Webinar registration form', 'subtleforms'),
      type: 'regular',
      template: 'webinar-signup',
    },
  },
};

export const courseEnrollment = {
  id: 'course-enrollment',
  name: __('Course Enrollment', 'subtleforms'),
  category: 'registration',
  description: __('Online course enrollment form', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      nameGroup({
        key: 'name_group',
        label: __('Student Name', 'subtleforms'),
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
        required: true,
      }),
      dateField({
        key: 'date_of_birth',
        label: __('Date of Birth', 'subtleforms'),
        required: false,
      }),
      selectField({
        key: 'course',
        label: __('Select Course', 'subtleforms'),
        placeholder: __('Choose a course', 'subtleforms'),
        required: true,
        options: [
          { label: __('Beginner Course', 'subtleforms'), value: 'beginner' },
          { label: __('Intermediate Course', 'subtleforms'), value: 'intermediate' },
          { label: __('Advanced Course', 'subtleforms'), value: 'advanced' },
        ],
      }),
      selectField({
        key: 'experience_level',
        label: __('Your Experience Level', 'subtleforms'),
        placeholder: __('Select level', 'subtleforms'),
        required: true,
        options: [
          { label: __('No Experience', 'subtleforms'), value: 'none' },
          { label: __('Some Experience', 'subtleforms'), value: 'some' },
          { label: __('Experienced', 'subtleforms'), value: 'experienced' },
        ],
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Course Enrollment', 'subtleforms'),
      description: __('Course enrollment form', 'subtleforms'),
      type: 'regular',
      template: 'course-enrollment',
    },
  },
};

export const membershipApplication = {
  id: 'membership-application',
  name: __('Membership Application', 'subtleforms'),
  category: 'registration',
  description: __('Organization membership application form', 'subtleforms'),
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
        label: __('Email Address', 'subtleforms'),
        required: true,
      }),
      phoneField({
        key: 'phone',
        label: __('Phone Number', 'subtleforms'),
        required: true,
      }),
      textField({
        key: 'occupation',
        label: __('Occupation', 'subtleforms'),
        placeholder: __('Your profession', 'subtleforms'),
        required: false,
      }),
      selectField({
        key: 'membership_type',
        label: __('Membership Type', 'subtleforms'),
        placeholder: __('Select membership level', 'subtleforms'),
        required: true,
        options: [
          { label: __('Individual - $50/year', 'subtleforms'), value: 'individual' },
          { label: __('Family - $90/year', 'subtleforms'), value: 'family' },
          { label: __('Professional - $150/year', 'subtleforms'), value: 'professional' },
        ],
      }),
      textareaField({
        key: 'why_join',
        label: __('Why do you want to join?', 'subtleforms'),
        placeholder: __('Tell us about your interest...', 'subtleforms'),
        required: true,
        rows: 5,
      }),
    ],
    metadata: {
      name: 'form_schema',
      title: __('Membership Application', 'subtleforms'),
      description: __('Organization membership application', 'subtleforms'),
      type: 'regular',
      template: 'membership-application',
    },
  },
};

export const sectionedMembership = {
  id: 'sectioned-membership',
  name: __('Sectioned Membership Form', 'subtleforms'),
  category: 'registration',
  description: __('Membership application organized into clear sections', 'subtleforms'),
  is_pro: true,
  schema: {
    fields: [
      {
        type: 'section',
        key: `section_${Date.now()}`,
        title: __('Personal Information', 'subtleforms'),
        fields: [
          nameGroup({
            key: 'name_group',
            label: __('Full Name', 'subtleforms'),
            required: true,
            enable_middle_name: true,
          }),
          emailField({
            key: 'email',
            label: __('Email Address', 'subtleforms'),
            required: true,
          }),
          phoneField({
            key: 'phone',
            label: __('Phone Number', 'subtleforms'),
            required: true,
          }),
        ],
      },
      {
        type: 'section',
        key: `section_${Date.now() + 1}`,
        title: __('Address Details', 'subtleforms'),
        fields: [
          textField({
            key: 'street_address',
            label: __('Street Address', 'subtleforms'),
            placeholder: __('123 Main St', 'subtleforms'),
            required: true,
          }),
          textField({
            key: 'city',
            label: __('City', 'subtleforms'),
            placeholder: __('San Francisco', 'subtleforms'),
            required: true,
          }),
          textField({
            key: 'state',
            label: __('State/Province', 'subtleforms'),
            placeholder: __('CA', 'subtleforms'),
            required: true,
          }),
          textField({
            key: 'postal_code',
            label: __('Postal Code', 'subtleforms'),
            placeholder: __('94102', 'subtleforms'),
            required: true,
          }),
        ],
      },
      {
        type: 'section',
        key: `section_${Date.now() + 2}`,
        title: __('Professional Experience', 'subtleforms'),
        fields: [
          textField({
            key: 'occupation',
            label: __('Current Occupation', 'subtleforms'),
            placeholder: __('Your profession', 'subtleforms'),
            required: true,
          }),
          selectField({
            key: 'experience_level',
            label: __('Years of Experience', 'subtleforms'),
            placeholder: __('Select experience', 'subtleforms'),
            required: true,
            options: [
              { label: __('0-2 years', 'subtleforms'), value: '0-2' },
              { label: __('3-5 years', 'subtleforms'), value: '3-5' },
              { label: __('6-10 years', 'subtleforms'), value: '6-10' },
              { label: __('10+ years', 'subtleforms'), value: '10plus' },
            ],
          }),
          textareaField({
            key: 'bio',
            label: __('Professional Bio', 'subtleforms'),
            placeholder: __('Tell us about your background...', 'subtleforms'),
            required: false,
            rows: 4,
          }),
        ],
      },
    ],
    metadata: {
      name: 'form_schema',
      title: __('Sectioned Membership Form', 'subtleforms'),
      description: __('Sectioned membership application', 'subtleforms'),
      type: 'sectioned',
      template: 'sectioned-membership',
    },
  },
};
