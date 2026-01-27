import React from 'react';
import { useState, useEffect, useCallback } from '@wordpress/element';
import { Modal, TextControl, TextareaControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useCreateForm } from '../data';
import { useNotice } from '../ui/feedback';
import Icon from '../components/ui/Icon';
import clsx from 'clsx';
import TemplateSelector from '../templates/TemplateSelector';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';
import './CreateFormModal.scss';
import '../templates/TemplateSelector.scss';

export default function CreateFormModal({ isOpen, onClose, onFormCreated }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [formType, setFormType] = useState('regular');
  const { error: showError } = useNotice();
  const createFormMutation = useCreateForm();



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
      setSelectedTemplateId(null);
      setFormType('regular');
    }
  }, [isOpen, generateDefaultTitle]);

  const handleRequestClose = useCallback(() => {
    if (!createFormMutation.isPending) {
      onClose();
    }
  }, [createFormMutation.isPending, onClose]);

  const handleCreate = async () => {
    if (createFormMutation.isPending) {
      return;
    }

    const safeTitle = (title || '').trim() || generateDefaultTitle();

    let fields = [];
    let templateMetadata = template;
    let schemaType = formType;

    // Load template schema if preset selected
    if (template === 'preset' && selectedTemplateId) {
      const templateData = selectedTemplateId;
      
      if (templateData && templateData.schema) {
        fields = templateData.schema.fields || [];
        templateMetadata = templateData.id;
        schemaType = templateData.schema.metadata?.type || 'regular';
      }
    } else if (template === 'blank') {
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
      }
    }
    
    const schemaToSend = enrichSchemaWithProMarkers({
      fields,
      metadata: {
        name: 'form_schema',
        title: safeTitle,
        description: description,
        type: schemaType,
        template: templateMetadata,
      },
    });

    try {
      const result = await createFormMutation.mutateAsync({
        title: safeTitle,
        schema: schemaToSend,
      });

      if (result?.id) {
        onFormCreated(result.id);
      }
    } catch (error) {
      showError(error);
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
      description: __('Choose from ready-made templates.', 'subtleforms'),
      icon: Icon.Layers,
      disabled: false,
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
          isHorizontal
            ? 'sf-option-card--horizontal'
            : 'sf-option-card--vertical',
          isSelected
            ? 'sf-option-card--selected'
            : 'sf-option-card--unselected',
          isDisabled && 'sf-option-card--disabled'
        )}>
        <div
          className={clsx(
            'sf-option-card__icon-wrapper',
            isHorizontal
              ? 'sf-option-card__icon-wrapper--horizontal'
              : 'sf-option-card__icon-wrapper--vertical',
            isSelected
              ? 'sf-option-card__icon-wrapper--selected'
              : 'sf-option-card__icon-wrapper--unselected'
          )}>
          {React.createElement(option.icon, {
            className: clsx(
              'sf-option-card__icon',
              isHorizontal
                ? 'sf-option-card__icon--horizontal'
                : 'sf-option-card__icon--vertical'
            ),
          })}
        </div>

        <div
          className={clsx(
            'sf-option-card__content',
            isHorizontal
              ? 'sf-option-card__content--horizontal'
              : 'sf-option-card__content--vertical'
          )}>
          <div
            className={clsx(
              'sf-option-card__title',
              isSelected
                ? 'sf-option-card__title--selected'
                : 'sf-option-card__title--unselected'
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

  const getModalTitle = () => {
    // Correct and predictable modal title logic
    if (step === 1) {
      return __('Create New Form', 'subtleforms');
    }
    if (step === 2 && template === 'preset') {
      return __('Choose a Template', 'subtleforms');
    }
    return __('Choose Form Structure', 'subtleforms');
  };

  return (
    <Modal
      title={null}
      __experimentalHideHeader={true}
      onRequestClose={handleRequestClose}
      className={clsx(
        'subtleforms-create-modal',
        step === 2 && template === 'preset' && 'subtleforms-create-modal--wide'
      )}
      overlayClassName='subtleforms-modal-overlay'
      shouldCloseOnClickOutside={!createFormMutation.isPending}
      shouldCloseOnEsc={!createFormMutation.isPending}>
      <div className='sf-create-form-modal__container subtleforms-admin'>
        {/* Header */}
        <div className='sf-create-form-modal__header'>
          <h2 className='sf-create-form-modal__title'>
            {step === 1
              ? __('Create New Form', 'subtleforms')
              : step === 2 && template === 'preset'
              ? __('Choose a Template', 'subtleforms')
              : __('Choose Form Structure', 'subtleforms')}
          </h2>
          <p className='sf-create-form-modal__subtitle'>
            {step === 1
              ? __(
                  'Provide basic information and choose a starting template.',
                  'subtleforms'
                )
              : step === 2 && template === 'preset'
              ? __(
                  'Select a pre-made template to get started quickly.',
                  'subtleforms'
                )
              : __(
                  'Select the structure that best fits your form requirements.',
                  'subtleforms'
                )}
          </p>
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
                    disabled={createFormMutation.isPending}
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
                    disabled={createFormMutation.isPending}
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

          {step === 2 && template === 'preset' && (
            <div className='sf-create-form-modal__form-section'>
              <TemplateSelector
                onSelectTemplate={setSelectedTemplateId}
                selectedTemplate={selectedTemplateId}
              />
            </div>
          )}

          {step === 2 && template === 'blank' && (
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
            onClick={() => {
              if (step === 1) {
                handleRequestClose();
              } else {
                setStep(step - 1);
              }
            }}
            disabled={createFormMutation.isPending}
            className={
              step === 1
                ? 'sf-create-form-modal__cancel-button'
                : 'sf-create-form-modal__back-button'
            }>
            {step === 1
              ? __('Cancel', 'subtleforms')
              : __('Back', 'subtleforms')}
          </button>

          <button
            type='button'
            onClick={() => {
              if (step === 1) {
                setStep(2);
              } else if (step === 2 && template === 'preset') {
                // Preset templates: create form immediately (skip structure step)
                handleCreate();
              } else {
                // Blank form: create with selected structure
                handleCreate();
              }
            }}
            disabled={
              step === 1
                ? !title.trim()
                : step === 2 && template === 'preset'
                ? !selectedTemplateId
                : createFormMutation.isPending || !formType
            }
            className='sf-create-form-modal__primary-button'>
            {createFormMutation.isPending && (
              <Icon.Loader className='sf-create-form-modal__spinner' />
            )}
            {step === 1
              ? __('Next Step', 'subtleforms')
              : createFormMutation.isPending
              ? __('Creating...', 'subtleforms')
              : __('Create Form', 'subtleforms')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
