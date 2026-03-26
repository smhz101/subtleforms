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
import { createInitialSchema } from '../utils/initialSchema';

import './CreateFormModal.scss';
import '../templates/TemplateSelector.scss';

export default function CreateFormModal({ isOpen, onClose, onFormCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [formType, setFormType] = useState('standard');
  const [isMultiStep, setIsMultiStep] = useState(false);
  const { error: showError } = useNotice();
  const createFormMutation = useCreateForm();

  const generateDefaultTitle = useCallback(() => {
    try {
      const next = parseInt( localStorage.getItem( 'sf_form_seq' ) || '0', 10 ) + 1;
      localStorage.setItem( 'sf_form_seq', String( next ) );
      return sprintf(
        /* translators: %1$d: sequential form number */
        __( 'New Form %1$d', 'subtleforms' ),
        next
      );
    } catch ( _e ) {
      return sprintf(
        /* translators: %1$d: numeric suffix used to create a unique title */
        __( 'New Form %1$d', 'subtleforms' ),
        Date.now() % 10000
      );
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTitle(generateDefaultTitle());
      setDescription('');
      setTemplate('blank');
      setSelectedTemplateId(null);
      setFormType('standard');
      setIsMultiStep(false);
    }
  }, [isOpen, generateDefaultTitle]);

  const handleRequestClose = useCallback(() => {
    if (!createFormMutation.isPending) {
      onClose();
    }
  }, [createFormMutation.isPending, onClose]);

  const handleCreate = async () => {
    if (createFormMutation.isPending) {
      return; // Prevent duplicate submissions
    }

    const safeTitle = title.trim() || generateDefaultTitle();
    let schemaToSend;
    // Map UI selection to canonical schema type
    let schemaType = formType === 'conversational'
      ? 'conversational'
      : isMultiStep
      ? 'multi-step'
      : 'regular';

    // Load template schema if preset selected
    if (template === 'preset' && selectedTemplateId) {
      const templateData = selectedTemplateId;
      if (templateData && templateData.schema) {
        const fields = templateData.schema.fields || [];
        schemaType = templateData.schema.metadata?.type || 'regular';
        schemaToSend = enrichSchemaWithProMarkers({
          fields,
          metadata: {
            name: 'form_schema',
            title: safeTitle,
            description: description,
            type: schemaType,
            template: templateData.id,
          },
        });
      }
    }

    if (!schemaToSend) {
      // Blank form — use createInitialSchema for canonical, correct field init
      const schema = createInitialSchema({
        title: safeTitle,
        description: description,
        formType: schemaType,
        startingPoint: 'blank',
      });
      schemaToSend = enrichSchemaWithProMarkers(schema);
      schemaToSend.metadata = {
        ...schemaToSend.metadata,
        template: 'blank',
      };
    }

    // Ensure schema_version is set and fields is an array
    schemaToSend.schema_version = 1;
    if (!Array.isArray(schemaToSend.fields)) {
      schemaToSend.fields = [];
    }

    try {
      // Send schema atomically with the form creation (POST /forms accepts a `schema` field).
      // This avoids a two-step failure mode where the form is created but the schema save fails.
      const result = await createFormMutation.mutateAsync({ title: safeTitle, schema: schemaToSend });

      if (result?.id) {
        // Mark this form as "newly created, never manually saved" so the builder
        // can auto-delete it if the user closes without making any edits.
        try { sessionStorage.setItem('sf_new_form_id', String(result.id)); } catch (_) {}
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

  const formStructures = [
    {
      id: 'standard',
      title: __('Standard', 'subtleforms'),
      description: __(
        'Single page or multi-step form. Best for contact forms, applications.',
        'subtleforms'
      ),
      icon: Icon.File,
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
  ];

  const renderOptionCard = (option, selected, onSelect, size = 'default') => {
    const isSelected = selected === option.id;
    const isDisabled = option.disabled;
    const isHorizontal = size === 'horizontal';

    return (
      <button
        key={option.id}
        type='button'
        role='radio'
        aria-checked={isSelected}
        aria-disabled={isDisabled}
        aria-labelledby={`${option.id}-title`}
        aria-describedby={`${option.id}-desc`}
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
            id={`${option.id}-title`}
            className={clsx(
              'sf-option-card__title',
              isSelected
                ? 'sf-option-card__title--selected'
                : 'sf-option-card__title--unselected'
            )}>
            {option.title}
          </div>

          <div id={`${option.id}-desc`} className='sf-option-card__description'>
            {option.description}
          </div>
        </div>

        {isSelected && (
          <Icon.CheckCircle className='sf-option-card__check-icon' aria-hidden='true' />
        )}

        {isDisabled && (
          <div className='sf-option-card__coming-soon' aria-label={__('Coming soon', 'subtleforms')}>
            {__('Coming soon', 'subtleforms')}
          </div>
        )}
      </button>
    );
  };

  const isCreateDisabled =
    !title.trim() ||
    (template === 'preset' && !selectedTemplateId) ||
    createFormMutation.isPending;

  return (
    <Modal
      title={null}
      __experimentalHideHeader={true}
      onRequestClose={handleRequestClose}
      className={clsx(
        'subtleforms-create-modal',
        template === 'preset' && 'subtleforms-create-modal--wide'
      )}
      overlayClassName='subtleforms-modal-overlay'
      shouldCloseOnClickOutside={!createFormMutation.isPending}
      shouldCloseOnEsc={!createFormMutation.isPending}
      aria-labelledby='create-form-modal-title'
      aria-describedby='create-form-modal-description'>
      <div className='sf-create-form-modal__container subtleforms-admin'>
        {/* Header */}
        <div className='sf-create-form-modal__header'>
          <h2 id='create-form-modal-title' className='sf-create-form-modal__title'>
            {__('Create New Form', 'subtleforms')}
          </h2>
          <p id='create-form-modal-description' className='sf-create-form-modal__subtitle'>
            {__('Set up your form and start collecting responses.', 'subtleforms')}
          </p>
        </div>

        {/* Form Content */}
        <div className='sf-create-form-modal__content'>
          <div className='sf-create-form-modal__form-section'>

            {/* Form Details */}
            <div className='sf-create-form-modal__form-details'>
              <div>
                <label htmlFor='form-title-input' className='sf-create-form-modal__label'>
                  {__('Form Title', 'subtleforms')}
                  <span className='sf-create-form-modal__required' aria-label='required'>*</span>
                </label>
                <TextControl
                  id='form-title-input'
                  value={title}
                  onChange={setTitle}
                  disabled={createFormMutation.isPending}
                  placeholder={__('e.g. Contact Form', 'subtleforms')}
                  aria-required='true'
                />
              </div>

              <div>
                <label htmlFor='form-description-input' className='sf-create-form-modal__label'>
                  {__('Description', 'subtleforms')}
                  <span className='sf-create-form-modal__optional'>
                    ({__('Optional', 'subtleforms')})
                  </span>
                </label>
                <TextareaControl
                  id='form-description-input'
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

            {/* Form Structure */}
            <fieldset>
              <legend className='sf-create-form-modal__label-section'>
                {__('Form Structure', 'subtleforms')}
              </legend>
              <div
                className='sf-create-form-modal__form-types'
                role='radiogroup'
                aria-label={__('Choose form structure', 'subtleforms')}>
                {formStructures.map((t) =>
                  renderOptionCard(t, formType, setFormType, 'horizontal')
                )}
              </div>
              {formType === 'standard' && (
                <div
                  className='sf-create-form-modal__sub-options'
                  role='radiogroup'
                  aria-label={__('Choose page layout', 'subtleforms')}>
                  <label className='sf-create-form-modal__radio-option'>
                    <input
                      type='radio'
                      name='sf-layout'
                      checked={!isMultiStep}
                      onChange={() => setIsMultiStep(false)}
                    />
                    <span className='sf-create-form-modal__radio-label'>
                      {__('Single page form', 'subtleforms')}
                    </span>
                  </label>
                  <label className='sf-create-form-modal__radio-option'>
                    <input
                      type='radio'
                      name='sf-layout'
                      checked={isMultiStep}
                      onChange={() => setIsMultiStep(true)}
                    />
                    <span className='sf-create-form-modal__radio-label'>
                      {__('Multi-step form', 'subtleforms')}
                    </span>
                  </label>
                </div>
              )}
            </fieldset>

            {/* Starting Template */}
            <fieldset>
              <legend className='sf-create-form-modal__label-section'>
                {__('Starting Template', 'subtleforms')}
              </legend>
              <div
                className='sf-create-form-modal__templates-grid'
                role='radiogroup'
                aria-label={__('Choose starting template', 'subtleforms')}>
                {templates.map((t) =>
                  renderOptionCard(t, template, setTemplate)
                )}
              </div>
              {template === 'preset' && (
                <div className='sf-create-form-modal__template-selector'>
                  <TemplateSelector
                    onSelectTemplate={setSelectedTemplateId}
                    selectedTemplate={selectedTemplateId}
                  />
                </div>
              )}
            </fieldset>

          </div>
        </div>

        {/* Footer Actions */}
        <div className='sf-create-form-modal__footer'>
          <button
            type='button'
            onClick={handleRequestClose}
            disabled={createFormMutation.isPending}
            aria-label={__('Cancel form creation', 'subtleforms')}
            className='sf-create-form-modal__cancel-button'>
            {__('Cancel', 'subtleforms')}
          </button>

          <button
            type='button'
            onClick={handleCreate}
            disabled={isCreateDisabled}
            aria-label={
              createFormMutation.isPending
                ? __('Creating form, please wait', 'subtleforms')
                : __('Create form', 'subtleforms')
            }
            aria-busy={createFormMutation.isPending}
            className='sf-create-form-modal__primary-button'>
            {createFormMutation.isPending && (
              <Icon.Loader className='sf-create-form-modal__spinner' aria-hidden='true' />
            )}
            {createFormMutation.isPending
              ? __('Creating...', 'subtleforms')
              : __('Create Form', 'subtleforms')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
