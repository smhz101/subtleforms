import { __ } from '@wordpress/i18n';

function createKey(value) {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'field';
}

function createTextField({ key, label, required = false, placeholder = '' } = {}) {
  return {
    type: 'text',
    key,
    label,
    required,
    placeholder,
  };
}

function createEmailField({ key, label, required = false, placeholder = '' } = {}) {
  return {
    type: 'email',
    key,
    label,
    required,
    placeholder,
  };
}

function createTextareaField({ key, label, required = false, placeholder = '' } = {}) {
  return {
    type: 'textarea',
    key,
    label,
    required,
    placeholder,
  };
}

function createHtmlBlock({ key, label, html = '' } = {}) {
  return {
    type: 'html',
    key,
    label,
    html,
  };
}

function createOneColumnContainer({ key, label, fields = [] } = {}) {
  return {
    type: 'one_column_container',
    key,
    label,
    fields,
  };
}

function createStep({ key, title, description = '', fields = [] }) {
  return {
    type: 'step',
    key,
    title,
    description,
    fields,
  };
}

export function createInitialSchema({
  title,
  description = '',
  formType = 'regular',
  startingPoint = 'blank',
} = {}) {
  const resolvedType =
    formType === 'multi-step'
      ? 'multi-step'
      : formType === 'sectioned'
      ? 'sectioned'
      : formType === 'conversational'
      ? 'conversational'
      : 'regular';

  const base = {
    schema_version: 1,
    metadata: {
      name: 'form_schema',
      title: title || __('Untitled Form', 'subtleforms'),
      description: description || '',
      type: resolvedType,
    },
    fields: [],
  };

  const mode = startingPoint === 'minimal' ? 'minimal' : 'blank';

  // Conversational forms
  if (resolvedType === 'conversational') {
    const intro = createHtmlBlock({
      key: createKey('intro'),
      label: __('Intro', 'subtleforms'),
      html: __(
        'Welcome! This is the start of your conversational form. Edit this block or remove it.',
        'subtleforms'
      ),
    });

    if (mode === 'blank') {
      base.fields = [
        intro,
        createTextField({
          key: createKey('question_1'),
          label: __('First question', 'subtleforms'),
          required: false,
          placeholder: __('Type your answer…', 'subtleforms'),
        }),
      ];
      return base;
    }

    base.fields = [
      intro,
      createTextField({
        key: createKey('name'),
        label: __('Your name', 'subtleforms'),
        required: true,
        placeholder: __('Jane Doe', 'subtleforms'),
      }),
      createEmailField({
        key: createKey('email'),
        label: __('Email address', 'subtleforms'),
        required: true,
        placeholder: __('name@example.com', 'subtleforms'),
      }),
    ];
    return base;
  }

  // Multi-step and sectioned forms
  if (resolvedType === 'multi-step' || resolvedType === 'sectioned') {
    const stepTitle =
      resolvedType === 'sectioned' ? __('Section 1', 'subtleforms') : __('Step 1', 'subtleforms');

    const blankStepFields = [
      createTextField({
        key: createKey('question_1'),
        label: __('Question', 'subtleforms'),
        required: false,
        placeholder: __('Type your answer…', 'subtleforms'),
      }),
    ];

    const minimalStepFields = [
      createTextField({
        key: createKey('name'),
        label: __('Name', 'subtleforms'),
        required: true,
        placeholder: __('Jane Doe', 'subtleforms'),
      }),
      createEmailField({
        key: createKey('email'),
        label: __('Email', 'subtleforms'),
        required: true,
        placeholder: __('name@example.com', 'subtleforms'),
      }),
    ];

    base.fields = [
      createStep({
        key: createKey('step_1'),
        title: stepTitle,
        description: '',
        fields: mode === 'minimal' ? minimalStepFields : blankStepFields,
      }),
    ];
    return base;
  }

  // Regular forms
  if (mode === 'blank') {
    base.fields = [
      createOneColumnContainer({
        key: createKey('layout_1'),
        label: __('Layout', 'subtleforms'),
        fields: [
          createTextField({
            key: createKey('text_1'),
            label: __('Text field', 'subtleforms'),
            required: false,
            placeholder: __('Type your answer…', 'subtleforms'),
          }),
        ],
      }),
    ];
    return base;
  }

  base.fields = [
    createOneColumnContainer({
      key: createKey('layout_1'),
      label: __('Layout', 'subtleforms'),
      fields: [
        createTextField({
          key: createKey('name'),
          label: __('Name', 'subtleforms'),
          required: true,
          placeholder: __('Jane Doe', 'subtleforms'),
        }),
        createEmailField({
          key: createKey('email'),
          label: __('Email', 'subtleforms'),
          required: true,
          placeholder: __('name@example.com', 'subtleforms'),
        }),
      ],
    }),
  ];
  return base;
}
