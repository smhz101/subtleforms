import { useState, useEffect, useCallback } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import {
  Modal,
  Button,
  TextControl,
  TextareaControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { Icon, page, layout, columns, listView, check } from '@wordpress/icons';

const restBase =
  window.subtleformsAdmin && window.subtleformsAdmin.restUrl
    ? window.subtleformsAdmin.restUrl.replace(/\/$/, '')
    : '/wp-json/subtleforms/v1';
const restNonce =
  window.subtleformsAdmin && window.subtleformsAdmin.restNonce
    ? window.subtleformsAdmin.restNonce
    : null;

function apiPost(path, payload) {
  return fetch(restBase + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then((r) => r.json().then((j) => ({ ok: r.ok, body: j })));
}

export default function CreateFormModal({ isOpen, onClose, onFormCreated }) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [formType, setFormType] = useState('regular');
  const { createErrorNotice } = useDispatch(noticesStore);

  const generateDefaultTitle = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(__('New Form %d', 'subtleforms'), suffix);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTitle(generateDefaultTitle());
      setDescription('');
      setTemplate('blank');
      setFormType('regular');
      setCreating(false);
    }
  }, [isOpen, generateDefaultTitle]);

  const handleRequestClose = useCallback(() => {
    if (!creating) {
      onClose();
    }
  }, [creating, onClose]);

  const handleCreate = async () => {
    if (creating) {
      return;
    }

    setCreating(true);
    const safeTitle = (title || '').trim() || generateDefaultTitle();

    let fields = [];

    // Initialize fields based on form type
    if (formType === 'multistep') {
      fields = [
        {
          type: 'step',
          key: `step_${Date.now()}`,
          config: {
            title: __('Step 1', 'subtleforms'),
            description: '',
          },
          children: [],
        },
      ];
    } else if (formType === 'sectioned') {
      fields = [
        {
          type: 'section',
          key: `section_${Date.now()}`,
          config: {
            title: __('Section 1', 'subtleforms'),
            description: '',
          },
          children: [],
        },
      ];
    } else {
      // Regular form starts empty
      fields = [];
    }

    const { ok, body } = await apiPost('/forms', {
      title: safeTitle,
      schema: {
        fields,
        metadata: {
          name: 'form_schema',
          title: safeTitle,
          description: description,
          type: formType,
          template,
        },
      },
    });

    setCreating(false);
    if (ok && body?.id) {
      onFormCreated(body.id);
    } else {
      createErrorNotice(
        body?.message || __('Failed to create form', 'subtleforms')
      );
    }
  };

  if (!isOpen) {
    return null;
  }

  const templates = [
    {
      id: 'blank',
      title: __('Blank Form', 'subtleforms'),
      description: __('Start from scratch.', 'subtleforms'),
      icon: page,
      disabled: false,
    },
    {
      id: 'preset',
      title: __('Preset Template', 'subtleforms'),
      description: __('Coming soon.', 'subtleforms'),
      icon: layout,
      disabled: true,
    },
  ];

  const formTypes = [
    {
      id: 'regular',
      title: __('Regular', 'subtleforms'),
      description: __(
        'Single page form. Best for contact forms, leads.',
        'subtleforms'
      ),
      icon: page,
    },
    {
      id: 'multistep',
      title: __('Multi-step', 'subtleforms'),
      description: __(
        'Broken into steps. Best for applications, surveys.',
        'subtleforms'
      ),
      icon: columns,
    },
    {
      id: 'sectioned',
      title: __('Sectioned', 'subtleforms'),
      description: __('Grouped fields. Best for long forms.', 'subtleforms'),
      icon: listView,
    },
  ];

  const renderOptionCard = (option, selected, onSelect, size = 'default') => {
    const isSelected = selected === option.id;
    const isDisabled = option.disabled;
    const isCompact = size === 'compact';

    return (
      <button
        key={option.id}
        type='button'
        onClick={() => !isDisabled && onSelect(option.id)}
        disabled={isDisabled}
        className={`group relative flex ${
          isCompact
            ? 'flex-row items-center gap-3 p-3'
            : 'flex-col items-center text-center p-4'
        } transition-all duration-150 w-full border focus:outline-none focus:ring-1 focus:ring-primary ${
          isSelected
            ? 'border-primary bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
        } ${
          isDisabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-dashed'
            : 'cursor-pointer'
        }`}>
        <div
          className={`${isCompact ? 'flex-shrink-0' : 'mb-2'} ${
            isCompact ? 'p-2' : 'p-2.5'
          } transition-colors ${
            isSelected
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-primary'
          }`}>
          <Icon icon={option.icon} size={isCompact ? 20 : 24} />
        </div>

        <div className={`${isCompact ? 'flex-1 text-left' : 'w-full'}`}>
          <div
            className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold ${
              isSelected ? 'text-primary' : 'text-gray-900'
            }`}>
            {option.title}
          </div>

          {!isCompact && (
            <div className='mt-1 text-gray-500 text-xs leading-snug'>
              {option.description}
            </div>
          )}
        </div>

        {isSelected && (
          <div className='top-2 right-2 absolute text-primary'>
            <Icon icon={check} size={16} />
          </div>
        )}

        {isDisabled && (
          <div className='mt-1 font-medium text-[10px] text-gray-500 uppercase tracking-wider'>
            {__('Coming soon', 'subtleforms')}
          </div>
        )}
      </button>
    );
  };

  return (
    <Modal
      title={null}
      onRequestClose={handleRequestClose}
      className='subtleforms-create-modal'
      overlayClassName='subtleforms-modal-overlay'
      shouldCloseOnClickOutside={!creating}
      shouldCloseOnEsc={!creating}>
      <div className='flex flex-col'>
        {/* Header */}
        <div className='mb-6'>
          <h2 className='mb-2 font-semibold text-base text-gray-900'>
            {__('Create New Form', 'subtleforms')}
          </h2>
          <p className='text-gray-600 text-sm leading-relaxed'>
            {__('Configure your form details and structure.', 'subtleforms')}
          </p>
        </div>

        {/* Form Content */}
        <div className='flex-1 space-y-6'>
          {/* Form Details */}
          <div className='space-y-3'>
            <label className='block font-medium text-gray-700 text-sm uppercase tracking-wide'>
              {__('Form Details', 'subtleforms')}
            </label>
            
            <div className='space-y-3'>
              <div>
                <label className='block mb-1 font-medium text-gray-700 text-xs'>
                  {__('Title', 'subtleforms')} <span className='text-red-500'>*</span>
                </label>
                <TextControl
                  value={title}
                  onChange={setTitle}
                  disabled={creating}
                  placeholder={__('e.g. Contact Form', 'subtleforms')}
                  className='!m-0'
                />
              </div>

              <div>
                <label className='block mb-1 font-medium text-gray-700 text-xs'>
                  {__('Description', 'subtleforms')}{' '}
                  <span className='font-normal text-gray-400'>
                    ({__('Optional', 'subtleforms')})
                  </span>
                </label>
                <TextareaControl
                  value={description}
                  onChange={setDescription}
                  disabled={creating}
                  rows={2}
                  className='!m-0'
                  placeholder={__('Describe the purpose of this form...', 'subtleforms')}
                />
              </div>
            </div>
          </div>

          {/* Templates */}
          <div>
            <label className='block mb-3 font-medium text-gray-700 text-sm uppercase tracking-wide'>
              {__('Template', 'subtleforms')}
            </label>
            <div className='gap-3 grid grid-cols-2'>
              {templates.map((t) => renderOptionCard(t, template, setTemplate))}
            </div>
          </div>

          {/* Form Types */}
          <div>
            <label className='block mb-3 font-medium text-gray-700 text-sm uppercase tracking-wide'>
              {__('Structure', 'subtleforms')}
            </label>
            <div className='gap-3 grid grid-cols-1'>
              {formTypes.map((t) => renderOptionCard(t, formType, setFormType))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className='flex justify-between items-center pt-6 border-gray-200 border-t mt-6'>
          <Button
            variant='tertiary'
            onClick={handleRequestClose}
            disabled={creating}
            className='!px-0 !h-auto !text-gray-600 hover:!text-gray-900 !text-sm'>
            {__('Cancel', 'subtleforms')}
          </Button>

          <Button
            variant='primary'
            onClick={handleCreate}
            isBusy={creating}
            disabled={creating || !title.trim()}
            className='!bg-primary hover:!bg-primary-dark !px-6 !h-9 !font-semibold !text-white !text-sm !shadow-none'>
            {__('Create Form', 'subtleforms')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
