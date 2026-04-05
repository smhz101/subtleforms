import React from 'react';
import { useState, useCallback, useMemo } from '@wordpress/element';
import { TextControl, TextareaControl, Modal } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useNavigate } from 'react-router-dom';
import { useCreateForm, useTemplates } from '../data';
import { useNotice } from '../ui/feedback';
import { useAbility } from '../policies';
import { UpgradePrompt } from '../components/ui';
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';
import { createInitialSchema } from '../utils/initialSchema';
import { TEMPLATE_CATEGORIES } from '../templates';
import clsx from 'clsx';
import './CreateFormPage.scss';

// ── Helper: auto-incrementing default title ──────────────────────────────────
function generateDefaultTitle() {
  try {
    const next = parseInt(localStorage.getItem('sf_form_seq') || '0', 10) + 1;
    localStorage.setItem('sf_form_seq', String(next));
    return sprintf(__('New Form %1$d', 'subtleforms'), next);
  } catch (_e) {
    return sprintf(__('New Form %1$d', 'subtleforms'), Date.now() % 10000);
  }
}

// ── Helper: form type label for badge ────────────────────────────────────────
function getFormTypeLabel(type) {
  switch (type) {
    case 'multi-step':
    case 'multistep':      return __('Multi-Step', 'subtleforms');
    case 'conversational': return __('Conversational', 'subtleforms');
    case 'sectioned':      return __('Sectioned', 'subtleforms');
    case 'payment':        return __('Payment', 'subtleforms');
    case 'regular':
    default:               return __('Standard', 'subtleforms');
  }
}

export default function CreateFormPage() {
  const navigate             = useNavigate();
  const { error: showError } = useNotice();
  const createFormMutation   = useCreateForm();

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [step, setStep]               = useState(1);
  const [title, setTitle]             = useState(() => generateDefaultTitle());
  const [description, setDescription] = useState('');
  const [formType, setFormType]       = useState('standard');
  const [isMultiStep, setIsMultiStep] = useState(false);

  // selectedTemplate: { id: 'blank' } by default, or full template object
  const [selectedTemplate, setSelectedTemplate] = useState({ id: 'blank' });

  // ── Template browser state (Step 1) ─────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery]           = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedProTemplate, setSelectedProTemplate] = useState(null);

  const { data: templatesResponse, isLoading: isLoadingTemplates } = useTemplates();
  const { can: canUseProTemplates } = useAbility('templates.pro');

  const allTemplates = useMemo(() =>
    templatesResponse?.success && templatesResponse?.templates
      ? Object.values(templatesResponse.templates)
      : [],
    [templatesResponse]
  );

  const filteredTemplates = useMemo(() => {
    let filtered = allTemplates;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allTemplates, searchQuery, selectedCategory]);

  // ── Template selection handlers ──────────────────────────────────────────────
  const applyTemplateType = (tpl) => {
    const type = tpl.schema?.metadata?.type;
    if (type === 'conversational') {
      setFormType('conversational');
      setIsMultiStep(false);
    } else if (['multi-step', 'multistep', 'sectioned'].includes(type)) {
      setFormType('standard');
      setIsMultiStep(true);
    } else {
      setFormType('standard');
      setIsMultiStep(false);
    }
  };

  const handleSelectBlank = () => {
    setSelectedTemplate({ id: 'blank' });
    setFormType('standard');
    setIsMultiStep(false);
  };

  const handleSelectTemplate = (tpl) => {
    if (tpl.is_pro && !canUseProTemplates) {
      setSelectedProTemplate(tpl);
      setShowUpgradeModal(true);
      return;
    }
    setSelectedTemplate(tpl);
    applyTemplateType(tpl);
  };

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (createFormMutation.isPending) return;

    const safeTitle = title.trim() || generateDefaultTitle();
    let schemaToSend;

    const schemaType = formType === 'conversational'
      ? 'conversational'
      : isMultiStep ? 'multi-step' : 'regular';

    if (selectedTemplate?.id !== 'blank' && selectedTemplate?.schema) {
      const fields  = selectedTemplate.schema.fields || [];
      const tplType = selectedTemplate.schema.metadata?.type || 'regular';
      schemaToSend  = enrichSchemaWithProMarkers({
        fields,
        metadata: {
          name: 'form_schema',
          title: safeTitle,
          description,
          type: tplType,
          template: selectedTemplate.id,
        },
      });
    }

    if (!schemaToSend) {
      const schema = createInitialSchema({ title: safeTitle, description, formType: schemaType, startingPoint: 'blank' });
      schemaToSend = enrichSchemaWithProMarkers(schema);
      schemaToSend.metadata = { ...schemaToSend.metadata, template: 'blank' };
    }

    schemaToSend.schema_version = 1;
    if (!Array.isArray(schemaToSend.fields)) schemaToSend.fields = [];

    try {
      const result = await createFormMutation.mutateAsync({ title: safeTitle, schema: schemaToSend });
      if (result?.id) {
        try { sessionStorage.setItem('sf_new_form_id', String(result.id)); } catch (_) {}
        navigate('/forms/' + result.id);
      }
    } catch (error) {
      showError(error);
    }
  }, [title, description, formType, isMultiStep, selectedTemplate, createFormMutation, navigate, showError]);

  // ── Validation ───────────────────────────────────────────────────────────────
  const isCreateDisabled = !title.trim() || createFormMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AdminShell
      title={__('Create New Form', 'subtleforms')}
      actions={
        <button
          type='button'
          className='sf-cfp__btn-ghost'
          onClick={() => navigate('/forms')}
          disabled={createFormMutation.isPending}>
          {__('Cancel', 'subtleforms')}
        </button>
      }>

      <div className={clsx(
        'sf-create-form-container',
        step === 1 ? 'sf-create-form-container--wide' : 'sf-create-form-container--narrow'
      )}>

        {/* ── Step indicator ─────────────────────────────────────────────── */}
        <div className='sf-cfp-stepper' aria-label={sprintf(__('Step %d of 2', 'subtleforms'), step)}>
          <div className={clsx('sf-cfp-stepper__item', step === 1 ? 'is-active' : 'is-done')}>
            <div className='sf-cfp-stepper__bubble'>
              {step > 1
                ? <Icon.Check className='sf-cfp-stepper__check-icon' aria-hidden='true' />
                : <span aria-hidden='true'>1</span>}
            </div>
            <span className='sf-cfp-stepper__label'>{__('Choose Template', 'subtleforms')}</span>
          </div>
          <div className={clsx('sf-cfp-stepper__connector', step > 1 && 'is-done')} />
          <div className={clsx('sf-cfp-stepper__item', step === 2 && 'is-active')}>
            <div className='sf-cfp-stepper__bubble'>
              <span aria-hidden='true'>2</span>
            </div>
            <span className='sf-cfp-stepper__label'>{__('Configure', 'subtleforms')}</span>
          </div>
        </div>

        {/* ── Animated step content ──────────────────────────────────────── */}
        <div className='sf-step-wrapper' key={step}>

          {step === 1 ? (
            /* ── STEP 1: Template Browser ──────────────────────────────── */
            <div className='sf-cfp-tbrowser'>

              {/* Search */}
              <div className='sf-cfp-tbrowser__search'>
                <TextControl
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={__('Search templates…', 'subtleforms')}
                  aria-label={__('Search templates', 'subtleforms')}
                />
              </div>

              {/* Sidebar + grid */}
              <div className='sf-cfp-tbrowser__layout'>

                <aside className='sf-cfp-tbrowser__sidebar' aria-label={__('Template categories', 'subtleforms')}>
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type='button'
                      onClick={() => setSelectedCategory(cat.id)}
                      className={clsx('sf-cfp-tbrowser__cat-btn', selectedCategory === cat.id && 'is-active')}>
                      {cat.label}
                    </button>
                  ))}
                </aside>

                <div className='sf-cfp-tbrowser__grid-wrap'>
                  {isLoadingTemplates ? (
                    <div className='sf-cfp-tbrowser__status'>
                      <p>{__('Loading templates…', 'subtleforms')}</p>
                    </div>
                  ) : (
                    <div className='sf-cfp-tbrowser__grid'>

                      {/* Blank card — always first, hidden when category-filtered */}
                      {selectedCategory === 'all' && (
                        <button
                          type='button'
                          className={clsx(
                            'sf-cfp-tcard',
                            'sf-cfp-tcard--blank',
                            selectedTemplate?.id === 'blank' && 'sf-cfp-tcard--selected'
                          )}
                          onClick={handleSelectBlank}
                          aria-pressed={selectedTemplate?.id === 'blank'}>
                          <div className='sf-cfp-tcard__badge-row'>
                            <span className='sf-cfp-tcard__badge sf-cfp-tcard__badge--blank'>
                              {__('Blank', 'subtleforms')}
                            </span>
                          </div>
                          <div className='sf-cfp-tcard__icon-wrap'>
                            <Icon.File className='sf-cfp-tcard__icon-svg' aria-hidden='true' />
                          </div>
                          <div className='sf-cfp-tcard__body'>
                            <h3 className='sf-cfp-tcard__name'>{__('Blank Form', 'subtleforms')}</h3>
                            <p className='sf-cfp-tcard__desc'>{__('Start from scratch with an empty canvas.', 'subtleforms')}</p>
                          </div>
                          {selectedTemplate?.id === 'blank' && (
                            <Icon.CheckCircle className='sf-cfp-tcard__check' aria-hidden='true' />
                          )}
                        </button>
                      )}

                      {/* Template cards */}
                      {filteredTemplates.map(tpl => {
                        const isLocked   = tpl.is_pro && !canUseProTemplates;
                        const isSelected = selectedTemplate?.id === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type='button'
                            onClick={() => handleSelectTemplate(tpl)}
                            title={isLocked ? __('Pro template — click to unlock', 'subtleforms') : undefined}
                            className={clsx(
                              'sf-cfp-tcard',
                              isSelected && 'sf-cfp-tcard--selected',
                              isLocked  && 'sf-cfp-tcard--locked'
                            )}>
                            <div className='sf-cfp-tcard__badge-row'>
                              {tpl.is_pro
                                ? <span className='sf-cfp-tcard__badge sf-cfp-tcard__badge--pro'>{__('Pro', 'subtleforms')}</span>
                                : <span className='sf-cfp-tcard__badge sf-cfp-tcard__badge--free'>{__('Free', 'subtleforms')}</span>
                              }
                              <span className='sf-cfp-tcard__badge sf-cfp-tcard__badge--type'>
                                {getFormTypeLabel(tpl.schema?.metadata?.type)}
                              </span>
                            </div>
                            <div className='sf-cfp-tcard__body'>
                              <h3 className='sf-cfp-tcard__name'>{tpl.name}</h3>
                              <p className='sf-cfp-tcard__desc'>{tpl.description}</p>
                            </div>
                            {isSelected && <Icon.CheckCircle className='sf-cfp-tcard__check' aria-hidden='true' />}
                            {isLocked && (
                              <div className='sf-cfp-tcard__lock'>
                                <Icon.Lock className='sf-cfp-tcard__lock-icon' aria-hidden='true' />
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {/* Empty state */}
                      {filteredTemplates.length === 0 && (selectedCategory !== 'all' || searchQuery.trim()) && (
                        <div className='sf-cfp-tbrowser__empty'>
                          <Icon.Search className='sf-cfp-tbrowser__empty-icon' aria-hidden='true' />
                          <p>{__('No templates match your search.', 'subtleforms')}</p>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>

              {/* Step 1 actions */}
              <div className='sf-cfp__actions'>
                <button
                  type='button'
                  className='sf-cfp__btn-cancel'
                  onClick={() => navigate('/forms')}
                  disabled={createFormMutation.isPending}>
                  {__('Cancel', 'subtleforms')}
                </button>
                <button
                  type='button'
                  className='sf-cfp__btn-primary'
                  onClick={() => setStep(2)}>
                  {__('Next', 'subtleforms')}
                  <Icon.ChevronRight className='sf-cfp__btn-icon' aria-hidden='true' />
                </button>
              </div>

            </div>
          ) : (
            /* ── STEP 2: Configuration ────────────────────────────────── */
            <>
              {/* Selected template pill */}
              {selectedTemplate?.id !== 'blank' && (
                <div className='sf-cfp-tpl-pill'>
                  <span className='sf-cfp-tpl-pill__label'>{__('Template:', 'subtleforms')}</span>
                  <span className='sf-cfp-tpl-pill__name'>{selectedTemplate.name}</span>
                  <button
                    type='button'
                    className='sf-cfp-tpl-pill__change'
                    onClick={() => setStep(1)}>
                    {__('Change', 'subtleforms')}
                  </button>
                </div>
              )}

              {/* Form info card */}
              <section className='sf-cfp-card'>
                <h2 className='sf-cfp-card__title'>{__('Form Info', 'subtleforms')}</h2>
                <div className='sf-cfp__field-group'>
                  <div className='sf-cfp__field'>
                    <label htmlFor='cfp-title' className='sf-cfp__label'>
                      {__('Title', 'subtleforms')}
                      <span className='sf-cfp__required' aria-label='required'>*</span>
                    </label>
                    <TextControl
                      id='cfp-title'
                      value={title}
                      onChange={setTitle}
                      disabled={createFormMutation.isPending}
                      placeholder={__('e.g. Contact Form', 'subtleforms')}
                      aria-required='true'
                    />
                  </div>
                  <div className='sf-cfp__field'>
                    <label htmlFor='cfp-desc' className='sf-cfp__label'>
                      {__('Description', 'subtleforms')}
                      <span className='sf-cfp__optional'>{__('(Optional)', 'subtleforms')}</span>
                    </label>
                    <TextareaControl
                      id='cfp-desc'
                      value={description}
                      onChange={setDescription}
                      disabled={createFormMutation.isPending}
                      rows={2}
                      placeholder={__('Describe the purpose of this form…', 'subtleforms')}
                    />
                  </div>
                </div>
              </section>

              {/* Structure card — only visible when blank form is selected */}
              {selectedTemplate?.id === 'blank' && (
                <section className='sf-cfp-card'>
                  <h2 className='sf-cfp-card__title'>{__('Structure', 'subtleforms')}</h2>
                  <fieldset className='sf-cfp__fieldset'>
                    <legend className='sf-sr-only'>{__('Form structure', 'subtleforms')}</legend>
                    <div
                      className='sf-cfp__structure-grid'
                      role='radiogroup'
                      aria-label={__('Choose form structure', 'subtleforms')}>
                      {[
                        {
                          id: 'standard',
                          title: __('Standard', 'subtleforms'),
                          description: __('Single page or multi-step form. Best for contact forms, applications.', 'subtleforms'),
                          icon: Icon.File,
                        },
                        {
                          id: 'conversational',
                          title: __('Conversational', 'subtleforms'),
                          description: __('One question at a time. Best for surveys and quizzes.', 'subtleforms'),
                          icon: Icon.MessageCircle,
                        },
                      ].map(opt => {
                        const isSel = formType === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type='button'
                            role='radio'
                            aria-checked={isSel}
                            aria-label={opt.title}
                            onClick={() => setFormType(opt.id)}
                            className={clsx('sf-cfp-option-card', isSel && 'sf-cfp-option-card--selected')}>
                            <div className={clsx('sf-cfp-option-card__icon', isSel && 'sf-cfp-option-card__icon--selected')}>
                              {React.createElement(opt.icon, { className: 'sf-cfp-option-card__icon-svg' })}
                            </div>
                            <div className='sf-cfp-option-card__body'>
                              <div className='sf-cfp-option-card__title'>{opt.title}</div>
                              <div className='sf-cfp-option-card__desc'>{opt.description}</div>
                            </div>
                            {isSel && <Icon.CheckCircle className='sf-cfp-option-card__check' aria-hidden='true' />}
                          </button>
                        );
                      })}
                    </div>
                    {formType === 'standard' && (
                      <div className='sf-cfp__sub-options' role='radiogroup' aria-label={__('Choose page layout', 'subtleforms')}>
                        <label className='sf-cfp__radio-option'>
                          <input type='radio' name='cfp-layout' checked={!isMultiStep} onChange={() => setIsMultiStep(false)} />
                          <span className='sf-cfp__radio-label'>{__('Single page', 'subtleforms')}</span>
                        </label>
                        <label className='sf-cfp__radio-option'>
                          <input type='radio' name='cfp-layout' checked={isMultiStep} onChange={() => setIsMultiStep(true)} />
                          <span className='sf-cfp__radio-label'>{__('Multi-step', 'subtleforms')}</span>
                        </label>
                      </div>
                    )}
                  </fieldset>
                </section>
              )}

              {/* Step 2 actions */}
              <div className='sf-cfp__actions'>
                <button
                  type='button'
                  className='sf-cfp__btn-cancel'
                  onClick={() => setStep(1)}
                  disabled={createFormMutation.isPending}>
                  {__('← Back', 'subtleforms')}
                </button>
                <button
                  type='button'
                  className='sf-cfp__btn-primary'
                  onClick={handleCreate}
                  disabled={isCreateDisabled}
                  aria-busy={createFormMutation.isPending}>
                  {createFormMutation.isPending && (
                    <Icon.Loader className='sf-cfp__spinner' aria-hidden='true' />
                  )}
                  {createFormMutation.isPending
                    ? __('Creating…', 'subtleforms')
                    : __('Create Form', 'subtleforms')}
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Pro template preview modal */}
      {showUpgradeModal && selectedProTemplate && (
        <Modal
          title={selectedProTemplate.name}
          onRequestClose={() => setShowUpgradeModal(false)}
          className='sf-tpl-preview-modal'>
          <div className='sf-tpl-preview'>
            <div className='sf-tpl-preview__header'>
              <span className='sf-cfp-tcard__badge sf-cfp-tcard__badge--pro'>{__('Pro', 'subtleforms')}</span>
              {selectedProTemplate.description && (
                <p className='sf-tpl-preview__desc'>{selectedProTemplate.description}</p>
              )}
            </div>

            {/* Field list preview */}
            {selectedProTemplate.schema?.fields?.length > 0 && (
              <div className='sf-tpl-preview__fields'>
                <p className='sf-tpl-preview__fields-label'>
                  {__('Fields included:', 'subtleforms')}
                </p>
                <ul className='sf-tpl-preview__field-list'>
                  {selectedProTemplate.schema.fields.slice(0, 8).map((f, i) => (
                    <li key={i} className='sf-tpl-preview__field-item'>
                      <Icon.Check className='sf-tpl-preview__field-check' aria-hidden='true' />
                      {f.label}
                    </li>
                  ))}
                  {selectedProTemplate.schema.fields.length > 8 && (
                    <li className='sf-tpl-preview__field-more'>
                      {sprintf(
                        __('+ %d more fields', 'subtleforms'),
                        selectedProTemplate.schema.fields.length - 8
                      )}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <UpgradePrompt
              variant='inline'
              feature={selectedProTemplate.name}
              benefits={[
                __('Unlock all 20+ Pro templates instantly', 'subtleforms'),
                __('Advanced form types (multi-step, conversational)', 'subtleforms'),
                __('Webhooks, integrations & conditional logic', 'subtleforms'),
                __('Priority support & regular new templates', 'subtleforms'),
              ]}
              ctaText={__('Upgrade to Pro', 'subtleforms')}
            />
          </div>
        </Modal>
      )}

    </AdminShell>
  );
}
