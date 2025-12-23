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
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [formType, setFormType] = useState('');
  const { createErrorNotice } = useDispatch(noticesStore);

  const generateDefaultTitle = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(__('New Form %d', 'subtleforms'), suffix);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTitle(generateDefaultTitle());
      setDescription('');
      setStep(1);
      setTemplate('blank');
      setFormType('');
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

  const renderOptionCard = (option, selected, onSelect) => {
    const isSelected = selected === option.id;
    const isDisabled = option.disabled;

    return (
      <button
        key={option.id}
        type='button'
        onClick={() => !isDisabled && onSelect(option.id)}
        disabled={isDisabled}
        className={`group relative flex flex-col items-center text-center p-5 transition-all duration-200 w-full rounded-sm border focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
          isSelected
            ? 'border-primary bg-gray-50'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        } ${
          isDisabled
            ? 'opacity-60 cursor-not-allowed bg-gray-50 border-dashed'
            : 'cursor-pointer'
        }`}>
        <div
          className={`mb-3 p-2.5 rounded-sm transition-colors ${
            isSelected
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 group-hover:bg-white group-hover:text-primary'
          }`}>
          <Icon icon={option.icon} size={28} />
        </div>

        <div
          className={`mb-1 font-semibold text-sm ${
            isSelected ? 'text-primary' : 'text-gray-900'
          }`}>
          {option.title}
        </div>

        <div className='text-gray-500 text-xs leading-snug'>
          {option.description}
        </div>

        {isSelected && (
          <div className='top-3 right-3 absolute text-primary'>
            <Icon icon={check} size={20} />
          </div>
        )}

        {isDisabled && (
          <div className='mt-2 font-semibold text-[11px] text-gray-500 uppercase tracking-wide'>
            {__('Coming soon', 'subtleforms')}
          </div>
        )}
      </button>
    );
  };

  const StepIndicator = () => (
    <div className='flex justify-center items-center mb-6 px-6'>
      <div className='flex items-center gap-3 font-medium text-gray-600 text-xs'>
        <div
          className={`px-3 py-1 rounded-sm border ${
            step === 1
              ? 'border-primary bg-gray-50 text-gray-900'
              : 'border-gray-200 bg-white text-gray-500'
          }`}>
          {__('Details', 'subtleforms')}
        </div>
        <div className='bg-gray-200 w-10 h-px' aria-hidden />
        <div
          className={`px-3 py-1 rounded-sm border ${
            step === 2
              ? 'border-primary bg-gray-50 text-gray-900'
              : 'border-gray-200 bg-white text-gray-500'
          }`}>
          {__('Structure', 'subtleforms')}
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      title={null}
      onRequestClose={handleRequestClose}
      className='subtleforms-create-modal'
      overlayClassName='subtleforms-modal-overlay'
      shouldCloseOnClickOutside={!creating}
      shouldCloseOnEsc={!creating}>
      <div className='flex flex-col h-full'>
        <div className='mb-6 text-left'>
          <h2 className='m-0 font-semibold text-gray-900 text-xl tracking-tight'>
            {step === 1
              ? __('Create New Form', 'subtleforms')
              : __('Select Form Type', 'subtleforms')}
          </h2>
          <p className='mt-1 text-gray-600 text-sm'>
            {step === 1
              ? __('Provide the basics and starting point.', 'subtleforms')
              : __('Choose how this form should be structured.', 'subtleforms')}
          </p>
        </div>

        <StepIndicator />

        <div className='flex-1 px-1 py-1 overflow-y-auto'>
          {step === 1 && (
            <div className='slide-in-from-right-4 max-w-xl animate-in duration-200 fade-in'>
              <div className='flex flex-col gap-5'>
                <div className='space-y-2'>
                  <label className='block font-semibold text-gray-800 text-sm'>
                    {__('Form Title', 'subtleforms')}{' '}
                    <span className='text-red-500'>*</span>
                  </label>
                  <TextControl
                    value={title}
                    onChange={setTitle}
                    disabled={creating}
                    placeholder={__('e.g. Contact Us', 'subtleforms')}
                    className='!m-0 !h-10 !text-base'
                  />
                </div>

                <div className='space-y-2'>
                  <label className='block font-semibold text-gray-800 text-sm'>
                    {__('Description', 'subtleforms')}{' '}
                    <span className='ml-1 font-normal text-gray-400 text-xs'>
                      ({__('Optional', 'subtleforms')})
                    </span>
                  </label>
                  <TextareaControl
                    value={description}
                    onChange={setDescription}
                    disabled={creating}
                    rows={3}
                    className='!m-0 !text-base'
                    placeholder={__(
                      'Briefly describe the purpose of this form...',
                      'subtleforms'
                    )}
                  />
                </div>

                <div className='pt-1'>
                  <label className='block mb-3 font-semibold text-gray-800 text-xs uppercase tracking-wide'>
                    {__('Template', 'subtleforms')}
                  </label>
                  <div className='gap-3 grid grid-cols-2'>
                    {templates.map((t) =>
                      renderOptionCard(t, template, setTemplate)
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className='slide-in-from-right-4 animate-in duration-200 fade-in'>
              <div className='mb-4'>
                <p className='text-gray-600 text-sm'>
                  {__(
                    'Pick the structure that matches your flow.',
                    'subtleforms'
                  )}
                </p>
              </div>
              <div className='gap-3 grid grid-cols-1 md:grid-cols-3'>
                {formTypes.map((t) =>
                  renderOptionCard(t, formType, setFormType)
                )}
              </div>
            </div>
          )}
        </div>

        <div className='flex justify-end items-center gap-3 bg-white mt-6 pt-5 border-gray-100 border-t'>
          {step === 1 ? (
            <Button
              variant='secondary'
              onClick={handleRequestClose}
              disabled={creating}
              className='!px-4 !h-10 !text-sm'>
              {__('Cancel', 'subtleforms')}
            </Button>
          ) : (
            <Button
              variant='secondary'
              onClick={() => setStep(1)}
              disabled={creating}
              className='!px-4 !h-10 !text-sm'>
              {__('Back', 'subtleforms')}
            </Button>
          )}

          {step === 1 ? (
            <Button
              variant='primary'
              onClick={() => setStep(2)}
              disabled={!title.trim()}
              className='!bg-primary hover:!bg-primary-dark !px-6 !border-none !rounded-sm !h-10 !font-semibold !text-white !text-sm'>
              {__('Next Step', 'subtleforms')}
            </Button>
          ) : (
            <Button
              variant='primary'
              onClick={handleCreate}
              isBusy={creating}
              disabled={creating || !formType}
              className='!bg-primary hover:!bg-primary-dark !px-6 !border-none !rounded-sm !h-10 !font-semibold !text-white !text-sm'>
              {__('Create Form', 'subtleforms')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
