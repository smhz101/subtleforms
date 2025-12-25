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
import {
  FiFile,
  FiColumns,
  FiLayers,
  FiList,
  FiCheckCircle,
  FiLoader,
  FiMessageCircle,
  FiCreditCard,
} from 'react-icons/fi';
import classNames from 'classnames';

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
    return sprintf(__('New Form %d', 'subtleforms'), suffix);
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
      icon: FiFile,
      disabled: false,
    },
    {
      id: 'preset',
      title: __('Preset Template', 'subtleforms'),
      description: __('Coming soon.', 'subtleforms'),
      icon: FiLayers,
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
      icon: FiFile,
    },
    {
      id: 'multistep',
      title: __('Multi-step', 'subtleforms'),
      description: __(
        'Broken into steps. Best for applications, surveys.',
        'subtleforms'
      ),
      icon: FiColumns,
    },
    {
      id: 'sectioned',
      title: __('Sectioned', 'subtleforms'),
      description: __('Grouped fields. Best for long forms.', 'subtleforms'),
      icon: FiList,
    },
    {
      id: 'conversational',
      title: __('Conversational', 'subtleforms'),
      description: __(
        'One question at a time. Best for engaging surveys, quizzes.',
        'subtleforms'
      ),
      icon: FiMessageCircle,
    },
    {
      id: 'payment',
      title: __('Payment', 'subtleforms'),
      description: __(
        'Collect payments. Best for orders, bookings, donations.',
        'subtleforms'
      ),
      icon: FiCreditCard,
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
        className={classNames(
          'group relative flex transition-all duration-150 w-full border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          isHorizontal
            ? 'flex-row items-center gap-3 p-3 text-left'
            : 'flex-col items-center text-center p-4',
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50',
          isDisabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-dashed'
            : 'cursor-pointer'
        )}>
        <div
          className={classNames(
            'flex-shrink-0 transition-colors',
            isHorizontal ? 'p-2' : 'p-3 mb-2',
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
          )}>
          {React.createElement(option.icon, {
            className: isHorizontal ? 'w-[18px] h-[18px]' : 'w-6 h-6',
          })}
        </div>

        <div className={isHorizontal ? 'flex-1 min-w-0' : 'w-full'}>
          <div
            className={classNames(
              'font-semibold text-sm',
              isSelected ? 'text-blue-900' : 'text-gray-900'
            )}>
            {option.title}
          </div>

          <div
            className={`text-gray-500 text-xs leading-snug ${
              isHorizontal ? 'mt-1' : 'mt-1'
            }`}>
            {option.description}
          </div>
        </div>

        {isSelected && (
          <div className='top-2 right-2 absolute text-blue-600'>
            <FiCheckCircle className='w-4 h-4' />
          </div>
        )}

        {isDisabled && (
          <div
            className={`font-medium text-[10px] text-gray-500 uppercase tracking-wider ${
              isHorizontal ? 'mt-1' : 'mt-2'
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
      <div className='flex flex-col h-full min-h-[500px] subtleforms-admin'>
        {/* Header */}
        <div className='mb-6'>
          <h2 className='mb-2 font-semibold text-gray-900 text-lg'>
            {step === 1
              ? __('Create New Form', 'subtleforms')
              : __('Choose Form Structure', 'subtleforms')}
          </h2>
          <p className='text-gray-600 text-sm leading-relaxed'>
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
        <div className='flex justify-center mb-6'>
          <div className='flex items-center space-x-3'>
            <div
              className={`px-3 py-1 text-xs font-medium border transition-colors ${
                step === 1
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-gray-200 text-gray-500'
              }`}>
              {__('Details', 'subtleforms')}
            </div>
            <div className='bg-gray-200 w-8 h-px'></div>
            <div
              className={`px-3 py-1 text-xs font-medium border transition-colors ${
                step === 2
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-gray-200 text-gray-500'
              }`}>
              {__('Structure', 'subtleforms')}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className='flex-1'>
          {step === 1 && (
            <div className='space-y-6'>
              {/* Form Details */}
              <div className='space-y-4'>
                <div>
                  <label className='block mb-2 font-medium text-gray-700 text-sm'>
                    {__('Form Title', 'subtleforms')}
                    <span className='ml-1 text-red-500'>*</span>
                  </label>
                  <TextControl
                    value={title}
                    onChange={setTitle}
                    disabled={creating}
                    placeholder={__('e.g. Contact Form', 'subtleforms')}
                  />
                </div>

                <div>
                  <label className='block mb-2 font-medium text-gray-700 text-sm'>
                    {__('Description', 'subtleforms')}
                    <span className='ml-2 font-normal text-gray-400 text-xs'>
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
                <label className='block mb-3 font-medium text-gray-700 text-sm uppercase tracking-wide'>
                  {__('Starting Template', 'subtleforms')}
                </label>
                <div className='gap-3 grid grid-cols-2'>
                  {templates.map((t) =>
                    renderOptionCard(t, template, setTemplate)
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className='space-y-6'>
              <div>
                <label className='block mb-3 font-medium text-gray-700 text-sm uppercase tracking-wide'>
                  {__('Form Structure', 'subtleforms')}
                </label>
                <div className='space-y-3'>
                  {formTypes.map((t) =>
                    renderOptionCard(t, formType, setFormType, 'horizontal')
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className='flex justify-between items-center mt-6 pt-6 border-gray-200 border-t'>
          <button
            type='button'
            onClick={step === 1 ? handleRequestClose : () => setStep(1)}
            disabled={creating}
            className='px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-600 hover:text-gray-800 text-sm transition-colors'>
            {step === 1
              ? __('Cancel', 'subtleforms')
              : __('Back', 'subtleforms')}
          </button>

          <button
            type='button'
            onClick={step === 1 ? () => setStep(2) : handleCreate}
            disabled={step === 1 ? !title.trim() : creating || !formType}
            className='inline-flex items-center bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-white text-sm transition-colors disabled:cursor-not-allowed'>
            {creating && (
              <FiLoader className='mr-2 -ml-1 w-4 h-4 text-white animate-spin' />
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
