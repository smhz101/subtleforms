import React from 'react';
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
import Icon from '../components/ui/Icon';
import clsx from 'clsx';

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
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [formType, setFormType] = useState('regular');
  const { createErrorNotice } = useDispatch(noticesStore);

  const generateDefaultTitle = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(
      /* translators: %1$d: numeric suffix used to create a unique title */
      __('New Form %1$d', 'subtleforms'),
      suffix
    );
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
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
    } else if (formType === 'conversational') {
      // Conversational forms start empty - fields will be displayed one at a time
      fields = [];
    } else if (formType === 'payment') {
      // Payment forms start empty - payment fields will be added by user
      fields = [];
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
      icon: Icon.File,
      disabled: false,
    },
    {
      id: 'preset',
      title: __('Preset Template', 'subtleforms'),
      description: __('Coming soon.', 'subtleforms'),
      icon: Icon.Layers,
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
      icon: Icon.File,
    },
    {
      id: 'multistep',
      title: __('Multi-step', 'subtleforms'),
      description: __(
        'Broken into steps. Best for applications, surveys.',
        'subtleforms'
      ),
      icon: Icon.Columns,
    },
    {
      id: 'sectioned',
      title: __('Sectioned', 'subtleforms'),
      description: __('Grouped fields. Best for long forms.', 'subtleforms'),
      icon: Icon.List,
    },
    {
      id: 'conversational',
      title: __('Conversational', 'subtleforms'),
      description: __(
        'One question at a time. Best for engaging surveys, quizzes.',
        'subtleforms'
      ),
      icon: Icon.MessageCircle,
    },
    {
      id: 'payment',
      title: __('Payment', 'subtleforms'),
      description: __(
        'Collect payments. Best for orders, bookings, donations.',
        'subtleforms'
      ),
      icon: Icon.CreditCard,
    },
  ];

  const renderOptionCard = (option, selected, onSelect, size = 'default') => {
    const isSelected = selected === option.id;
    const isDisabled = option.disabled;
    const isHorizontal = size === 'horizontal';

    return (
      <button
        key={option.id}
        type='button'
        onClick={() => !isDisabled && onSelect(option.id)}
        disabled={isDisabled}
        className={clsx(
          'sf-group sf-relative sf-flex sf-border sf-focus:outline-none sf-focus:ring-2 sf-focus:ring-blue-500 sf-focus:ring-offset-2 sf-w-full sf-transition-all sf-duration-150',
          isHorizontal
            ? 'sf-flex-row sf-items-center sf-gap-3 sf-p-3 sf-text-left'
            : 'sf-flex-col sf-items-center sf-text-center sf-p-4',
          isSelected
            ? 'sf-border-blue-500 sf-bg-blue-50'
            : 'sf-border-gray-300 sf-bg-white hover:sf-border-gray-400 hover:sf-bg-gray-50',
          isDisabled
            ? 'sf-opacity-50 sf-cursor-not-allowed sf-bg-gray-50 sf-border-dashed'
            : 'sf-cursor-pointer'
        )}>
        <div
          className={clsx(
            'sf-transition-colors sf-shrink-0',
            isHorizontal ? 'sf-p-2' : 'sf-p-3 sf-mb-2',
            isSelected
              ? 'sf-bg-blue-600 sf-text-white'
              : 'sf-bg-gray-100 sf-text-gray-600 sf-group-hover:sf-bg-gray-200'
          )}>
          {React.createElement(option.icon, {
            className: isHorizontal
              ? 'sf-w-[18px] sf-h-[18px]'
              : 'sf-w-6 sf-h-6',
          })}
        </div>

        <div className={isHorizontal ? 'sf-flex-1 sf-min-w-0' : 'sf-w-full'}>
          <div
            className={clsx(
              'sf-font-semibold sf-text-sm',
              isSelected ? 'sf-text-blue-900' : 'sf-text-gray-900'
            )}>
            {option.title}
          </div>

          <div
            className={`sf-text-gray-500 sf-text-xs sf-leading-snug ${
              isHorizontal ? 'sf-mt-1' : 'sf-mt-1'
            }`}>
            {option.description}
          </div>
        </div>

        {isSelected && (
          <div className='sf-top-2 sf-right-2 sf-absolute sf-text-blue-600'>
            <Icon.CheckCircle className='sf-w-4 sf-h-4' />
          </div>
        )}

        {isDisabled && (
          <div
            className={`sf-font-medium sf-text-[10px] sf-text-gray-500 sf-uppercase sf-tracking-wider ${
              isHorizontal ? 'sf-mt-1' : 'sf-mt-2'
            }`}>
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
      <div className='sf-flex sf-flex-col sf-h-full sf-min-h-[500px] subtleforms-admin'>
        {/* Header */}
        <div className='sf-mb-6'>
          <h2 className='sf-mb-2 sf-font-semibold sf-text-gray-900 sf-text-lg'>
            {step === 1
              ? __('Create New Form', 'subtleforms')
              : __('Choose Form Structure', 'subtleforms')}
          </h2>
          <p className='sf-text-gray-600 sf-text-sm sf-leading-relaxed'>
            {step === 1
              ? __(
                  'Provide basic information and choose a starting template.',
                  'subtleforms'
                )
              : __(
                  'Select the structure that best fits your form requirements.',
                  'subtleforms'
                )}
          </p>
        </div>

        {/* Step Indicator */}
        <div className='sf-flex sf-justify-center sf-mb-6'>
          <div className='sf-flex sf-items-center sf-space-x-3'>
            <div
              className={`sf-px-3 sf-py-1 sf-text-xs sf-font-medium sf-border sf-transition-colors ${
                step === 1
                  ? 'sf-bg-blue-50 sf-border-blue-300 sf-text-blue-800'
                  : 'sf-bg-white sf-border-gray-200 sf-text-gray-500'
              }`}>
              {__('Details', 'subtleforms')}
            </div>
            <div className='sf-bg-gray-200 sf-w-8 sf-h-px'></div>
            <div
              className={`sf-px-3 sf-py-1 sf-text-xs sf-font-medium sf-border sf-transition-colors ${
                step === 2
                  ? 'sf-bg-blue-50 sf-border-blue-300 sf-text-blue-800'
                  : 'sf-bg-white sf-border-gray-200 sf-text-gray-500'
              }`}>
              {__('Structure', 'subtleforms')}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className='sf-flex-1'>
          {step === 1 && (
            <div className='sf-space-y-6'>
              {/* Form Details */}
              <div className='sf-space-y-4'>
                <div>
                  <label className='sf-block sf-mb-2 sf-font-medium sf-text-gray-700 sf-text-sm'>
                    {__('Form Title', 'subtleforms')}
                    <span className='sf-ml-1 sf-text-red-500'>*</span>
                  </label>
                  <TextControl
                    value={title}
                    onChange={setTitle}
                    disabled={creating}
                    placeholder={__('e.g. Contact Form', 'subtleforms')}
                  />
                </div>

                <div>
                  <label className='sf-block sf-mb-2 sf-font-medium sf-text-gray-700 sf-text-sm'>
                    {__('Description', 'subtleforms')}
                    <span className='sf-ml-2 sf-font-normal sf-text-gray-400 sf-text-xs'>
                      ({__('Optional', 'subtleforms')})
                    </span>
                  </label>
                  <TextareaControl
                    value={description}
                    onChange={setDescription}
                    disabled={creating}
                    rows={3}
                    placeholder={__(
                      'Describe the purpose of this form...',
                      'subtleforms'
                    )}
                  />
                </div>
              </div>

              {/* Templates */}
              <div>
                <label className='sf-block sf-mb-3 sf-font-medium sf-text-gray-700 sf-text-sm sf-uppercase sf-tracking-wide'>
                  {__('Starting Template', 'subtleforms')}
                </label>
                <div className='sf-gap-3 sf-grid sf-grid-cols-2'>
                  {templates.map((t) =>
                    renderOptionCard(t, template, setTemplate)
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className='sf-space-y-6'>
              <div>
                <label className='sf-block sf-mb-3 sf-font-medium sf-text-gray-700 sf-text-sm sf-uppercase sf-tracking-wide'>
                  {__('Form Structure', 'subtleforms')}
                </label>
                <div className='sf-space-y-3'>
                  {formTypes.map((t) =>
                    renderOptionCard(t, formType, setFormType, 'horizontal')
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className='sf-flex sf-justify-between sf-items-center sf-mt-6 sf-pt-6 sf-border-gray-200 sf-border-t'>
          <button
            type='button'
            onClick={step === 1 ? handleRequestClose : () => setStep(1)}
            disabled={creating}
            className='sf-px-3 sf-py-1 focus:sf-outline-none focus:sf-ring-2 focus:sf-ring-blue-500 focus:sf-ring-offset-2 sf-text-gray-600 hover:sf-text-gray-800 sf-text-sm sf-transition-colors'>
            {step === 1
              ? __('Cancel', 'subtleforms')
              : __('Back', 'subtleforms')}
          </button>

          <button
            type='button'
            onClick={step === 1 ? () => setStep(2) : handleCreate}
            disabled={step === 1 ? !title.trim() : creating || !formType}
            className='sf-inline-flex sf-items-center sf-bg-blue-600 hover:sf-bg-blue-700 disabled:sf-opacity-50 sf-px-4 sf-py-2 focus:sf-outline-none focus:sf-ring-2 focus:sf-ring-blue-500 focus:sf-ring-offset-2 sf-font-medium sf-text-white sf-text-sm sf-transition-colors disabled:sf-cursor-not-allowed'>
            {creating && (
              <Icon.Loader className='sf-mr-2 -ml-1 sf-w-4 sf-h-4 sf-text-white sf-animate-spin' />
            )}
            {step === 1
              ? __('Next Step', 'subtleforms')
              : creating
              ? __('Creating...', 'subtleforms')
              : __('Create Form', 'subtleforms')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
