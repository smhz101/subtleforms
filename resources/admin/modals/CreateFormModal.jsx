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
import './CreateFormModal.scss';

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
          'sf-option-card',
          isHorizontal ? 'sf-option-card--horizontal' : 'sf-option-card--vertical',
          isSelected ? 'sf-option-card--selected' : 'sf-option-card--unselected',
          isDisabled && 'sf-option-card--disabled'
        )}>
        <div
          className={clsx(
            'sf-option-card__icon-wrapper',
            isHorizontal ? 'sf-option-card__icon-wrapper--horizontal' : 'sf-option-card__icon-wrapper--vertical',
            isSelected ? 'sf-option-card__icon-wrapper--selected' : 'sf-option-card__icon-wrapper--unselected'
          )}>
          {React.createElement(option.icon, {
            className: clsx(
              'sf-option-card__icon',
              isHorizontal ? 'sf-option-card__icon--horizontal' : 'sf-option-card__icon--vertical'
            ),
          })}
        </div>

        <div className={clsx(
          'sf-option-card__content',
          isHorizontal ? 'sf-option-card__content--horizontal' : 'sf-option-card__content--vertical'
        )}>
          <div
            className={clsx(
              'sf-option-card__title',
              isSelected ? 'sf-option-card__title--selected' : 'sf-option-card__title--unselected'
            )}>
            {option.title}
          </div>

          <div className='sf-option-card__description'>
            {option.description}
          </div>
        </div>

        {isSelected && (
          <Icon.CheckCircle className='sf-option-card__check-icon' />
        )}

        {isDisabled && (
          <div className='sf-option-card__coming-soon'>
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
      <div className='sf-create-form-modal__container subtleforms-admin'>
        {/* Header */}
        <div className='sf-create-form-modal__header'>
          <h2 className='sf-create-form-modal__title'>
            {step === 1
              ? __('Create New Form', 'subtleforms')
              : __('Choose Form Structure', 'subtleforms')}
          </h2>
          <p className='sf-create-form-modal__subtitle'>
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
        <div className='sf-create-form-modal__step-indicator'>
          <div className='sf-create-form-modal__step-wrapper'>
            <div
              className={clsx(
                'sf-create-form-modal__step',
                step === 1 ? 'sf-create-form-modal__step--active' : 'sf-create-form-modal__step--inactive'
              )}>
              {__('Details', 'subtleforms')}
            </div>
            <div className='sf-create-form-modal__step-divider'></div>
            <div
              className={clsx(
                'sf-create-form-modal__step',
                step === 2 ? 'sf-create-form-modal__step--active' : 'sf-create-form-modal__step--inactive'
              )}>
              {__('Structure', 'subtleforms')}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className='sf-create-form-modal__content'>
          {step === 1 && (
            <div className='sf-create-form-modal__form-section'>
              {/* Form Details */}
              <div className='sf-create-form-modal__form-details'>
                <div>
                  <label className='sf-create-form-modal__label'>
                    {__('Form Title', 'subtleforms')}
                    <span className='sf-create-form-modal__required'>*</span>
                  </label>
                  <TextControl
                    value={title}
                    onChange={setTitle}
                    disabled={creating}
                    placeholder={__('e.g. Contact Form', 'subtleforms')}
                  />
                </div>

                <div>
                  <label className='sf-create-form-modal__label'>
                    {__('Description', 'subtleforms')}
                    <span className='sf-create-form-modal__optional'>
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
                <label className='sf-create-form-modal__label-section'>
                  {__('Starting Template', 'subtleforms')}
                </label>
                <div className='sf-create-form-modal__templates-grid'>
                  {templates.map((t) =>
                    renderOptionCard(t, template, setTemplate)
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className='sf-create-form-modal__form-section'>
              <div>
                <label className='sf-create-form-modal__label-section'>
                  {__('Form Structure', 'subtleforms')}
                </label>
                <div className='sf-create-form-modal__form-types'>
                  {formTypes.map((t) =>
                    renderOptionCard(t, formType, setFormType, 'horizontal')
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className='sf-create-form-modal__footer'>
          <button
            type='button'
            onClick={step === 1 ? handleRequestClose : () => setStep(1)}
            disabled={creating}
            className={step === 1 ? 'sf-create-form-modal__cancel-button' : 'sf-create-form-modal__back-button'}>
            {step === 1
              ? __('Cancel', 'subtleforms')
              : __('Back', 'subtleforms')}
          </button>

          <button
            type='button'
            onClick={step === 1 ? () => setStep(2) : handleCreate}
            disabled={step === 1 ? !title.trim() : creating || !formType}
            className='sf-create-form-modal__primary-button'>
            {creating && (
              <Icon.Loader className='sf-create-form-modal__spinner' />
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
