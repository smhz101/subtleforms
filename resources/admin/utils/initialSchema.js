import { __ } from '@wordpress/i18n';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function createKey(value) {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'field';
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
  // eslint-disable-next-line no-unused-vars -- kept for callers; every start is blank now.
  startingPoint = 'blank',
} = {}) {
  const resolvedType =
    formType === 'multi-step'
      ? 'multi-step'
      : formType === 'sectioned'
      ? 'sectioned'
      : formType === 'conversational'
      ? 'conversational'
      : formType === 'payment'
      ? 'payment'
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
    actions: [
      {
        id:       uid(),
        type:     'email',
        enabled:  true,
        // Ready to use: the site admin gets every answer (QA-02). The
        // message stays empty, which sends {all_fields}.
        settings: {
          to:      '{admin_email}',
          subject: __('New entry: {form_title}', 'subtleforms'),
          message: '',
          format:  'html',
        },
      },
    ],
  };

  // Conversational forms start empty: the builder shows "Add your first
  // question" (2.3.2). The intro block used before stored its text under a
  // key nothing read, so it looked locked and could not be edited.
  if (resolvedType === 'conversational') {
    base.fields = [];
    return base;
  }

  // Multi-step and sectioned forms, start with one empty step
  if (resolvedType === 'multi-step' || resolvedType === 'sectioned') {
    const stepTitle =
      resolvedType === 'sectioned' ? __('Section 1', 'subtleforms') : __('Step 1', 'subtleforms');

    base.fields = [
      createStep({
        key: createKey('step_1'),
        title: stepTitle,
        description: '',
        fields: [],
      }),
    ];
    return base;
  }

  // Regular forms, always start with an empty canvas
  // Users build their form from scratch using the field panel.
  return base;
}
