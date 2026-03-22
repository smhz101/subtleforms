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

function createHtmlBlock({ key, label, html = '' } = {}) {
  return {
    type: 'html',
    key,
    label,
    html,
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
    actions: [
      {
        id:       uid(),
        type:     'email',
        enabled:  true,
        settings: {
          to:      '',
          subject: '',
          message: '',
        },
      },
    ],
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
      // Conversational: just the intro block, no pre-populated questions
      base.fields = [intro];
      return base;
    }

    // Minimal: also just the intro block
    base.fields = [intro];
    return base;
  }

  // Multi-step and sectioned forms — start with one empty step
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

  // Regular forms — always start with an empty canvas
  // Users build their form from scratch using the field panel.
  return base;
}
