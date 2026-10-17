import {
  SelectControl,
  TextControl,
  ToggleControl,
  RadioControl,
  Notice,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import ConfirmModal from '../../modals/ConfirmModal';
import {
  structuralType,
  hasSteps,
  wrapFieldsInStep,
  flattenSteps,
  TYPE_STANDARD,
  TYPE_MULTI_STEP,
  TYPE_CONVERSATIONAL,
} from '../../../shared/formType';
import { createNodeId, createFieldKey } from './utils/idGenerator';
import ActionsPanel from './ActionsPanel';
import { ConfirmationPanel, AvailabilityPanel } from './FormBehaviorPanels';
import CheckoutPanel from './CheckoutPanel';
import IntegrationsPanel from './IntegrationsPanel';
import { isPricedForm, isPricedType } from '../../../shared/pricing';
import Icon from '../../ui/Icon';
import './FormSettings.scss';

/**
 * FormSettings - Configure form-wide settings including payment options
 */
export default function FormSettings({ 
  schema, 
  onChange, 
  validationErrors = [], 
  fieldErrors = {}, 
  isReadOnly = false 
}) {
  const metadata = schema?.metadata || {};
  // The structure decides between Standard and Multi-step (2.3.2).
  const formType = structuralType(schema || {}) || 'regular';
  const isPaymentForm = formType === 'payment';
  const isConversationalForm = formType === 'conversational';
  // Both spellings reach this component: stored schemas may hold either, and
  // normalisation happens on save rather than on every read.
  const isMultiStep = formType === 'multi-step' || formType === 'multistep';
  const supportsPayment = isPaymentForm || isConversationalForm;

  // Payment settings
  const paymentSettings = metadata.payment || {
    enabled: isPaymentForm ? true : false, // Payment forms have payment enabled by default
    mode: 'test',
    currency: 'USD',
    amountType: 'fixed',
    fixedAmount: '',
    amountField: '',
  };

  const handleMetadataChange = (key, value) => {
    if (isReadOnly) return;
    const updated = {
      ...schema,
      metadata: {
        ...metadata,
        [key]: value,
      },
    };
    onChange(updated);
  };

  const handlePaymentSettingChange = (key, value) => {
    if (isReadOnly) return;
    const updated = {
      ...schema,
      metadata: {
        ...metadata,
        payment: {
          ...paymentSettings,
          [key]: value,
        },
      },
    };
    onChange(updated);
  };

  // Checkout settings (2.1) merge into whatever payment settings exist,
  // without the legacy defaults above (they would pin the currency).
  const handleCheckoutChange = (key, value) => {
    if (isReadOnly) return;
    onChange({
      ...schema,
      metadata: {
        ...metadata,
        payment: {
          ...(metadata.payment || {}),
          [key]: value,
        },
      },
    });
  };

  const flatFields = (() => {
    const out = [];
    const walk = (list) =>
      (Array.isArray(list) ? list : []).forEach((f) => {
        if (!f || typeof f !== 'object') return;
        out.push(f);
        walk(f.children);
        walk(f.fields);
        (f.columns || []).forEach((col) => Array.isArray(col) && walk(col));
      });
    walk(schema?.fields);
    return out;
  })();
  const pricedFields = flatFields.filter((f) => isPricedType(f.type));
  const takesMoney = isPricedForm(flatFields) || supportsPayment;

  // Get all numeric/text fields for amount selection
  const amountFieldOptions = () => {
    if (!schema?.fields) return [];

    const flatten = (fields) => {
      let result = [];
      fields.forEach((field) => {
        // Only include numeric and text fields
        if (field.type === 'number' || field.type === 'text') {
          const key = field.config?.key || field.key;
          const label = field.config?.label || key;
          result.push({ label, value: key });
        }
        if (field.children && Array.isArray(field.children)) {
          result = result.concat(flatten(field.children));
        }
        if (field.columns && Array.isArray(field.columns)) {
          field.columns.forEach((col) => {
            if (Array.isArray(col)) {
              result = result.concat(flatten(col));
            }
          });
        }
      });
      return result;
    };

    return flatten(schema.fields);
  };

  const fieldOptions = amountFieldOptions();

  const restrictions = metadata.restrictions || {};
  const availabilityOn = [restrictions.requireLogin, restrictions.openAt, restrictions.closeAt, restrictions.entryLimit].filter(Boolean).length;

  const sections = [
    {
      key: 'form',
      title: __('Form', 'subtleforms'),
      items: [
        { id: 'general', title: __('General', 'subtleforms'), description: __('Name, description and how the form is presented.', 'subtleforms'), icon: Icon.FileText },
        { id: 'fields', title: __('Field defaults', 'subtleforms'), description: __('Defaults for every field that does not set its own.', 'subtleforms'), icon: Icon.Sliders },
      ],
    },
    {
      key: 'responses',
      title: __('Responses', 'subtleforms'),
      items: [
        { id: 'confirmation', title: __('Confirmation', 'subtleforms'), description: __('What visitors see after they submit, and the submit button.', 'subtleforms'), icon: Icon.CheckCircle },
        { id: 'notifications', title: __('Notifications', 'subtleforms'), description: __('Emails and API calls that run when an entry arrives.', 'subtleforms'), icon: Icon.Mail },
        {
          id: 'availability',
          title: __('Availability', 'subtleforms'),
          description: __('Who can submit, and when the form stops accepting entries.', 'subtleforms'),
          icon: Icon.Clock,
          badge: availabilityOn ? String(availabilityOn) : '',
        },
      ],
    },
    {
      key: 'connections',
      title: __('Connections', 'subtleforms'),
      items: [
        (supportsPayment || takesMoney) && {
          id: 'payments',
          title: __('Payments', 'subtleforms'),
          description: __('How this form charges, and where the visitor checks out.', 'subtleforms'),
          icon: Icon.CreditCard,
        },
        { id: 'integrations', title: __('Integrations', 'subtleforms'), description: __('Send entries to email marketing, a CRM, analytics or a webhook.', 'subtleforms'), icon: Icon.Webhook },
      ].filter(Boolean),
    },
    {
      key: 'advanced',
      title: __('Advanced', 'subtleforms'),
      items: [
        { id: 'advanced', title: __('Advanced', 'subtleforms'), description: __('Builder width and the internal name used by developers.', 'subtleforms'), icon: Icon.Settings },
      ],
    },
  ];

  const available = sections.flatMap((group) => group.items);
  const [activeSection, setActiveSection] = useState('general');
  const current = available.find((item) => item.id === activeSection) || available[0];

  return (
    <div className='subtleforms-form-settings sf-form-settings'>
      <div className='sf-form-settings__container'>
        <h2 className='sf-form-settings__title'>
          {__('Form Settings', 'subtleforms')}
        </h2>

        {isReadOnly && (
          <Notice status='info' isDismissible={false}>
            <p>{__('Settings are read-only: Activate your Pro license to edit. Your form continues working. No data loss.', 'subtleforms')}</p>
          </Notice>
        )}

        <div className='sf-form-settings__layout'>
          <nav className='sf-form-settings__nav' aria-label={__('Form settings sections', 'subtleforms')}>
            {sections.map((group) => (
              <div key={group.key} className='sf-form-settings__nav-group'>
                <p className='sf-form-settings__nav-heading'>{group.title}</p>
                <ul>
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = current.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type='button'
                          className={`sf-form-settings__nav-item${isActive ? ' is-active' : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setActiveSection(item.id)}>
                          <ItemIcon size={18} aria-hidden='true' />
                          <span>{item.title}</span>
                          {item.badge ? <span className='sf-form-settings__nav-badge'>{item.badge}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className='sf-form-settings__content'>
            <header className='sf-form-settings__header'>
              <h3 className='sf-form-settings__section-title'>{current.title}</h3>
              <p className='sf-form-settings__description'>{current.description}</p>
            </header>

            {current.id === 'general' && (
              <div className='sf-form-settings__card'>
                {formType !== 'regular' && formType !== 'standard' && (
                  <div className='sf-form-type-banner' data-form-type={formType}>
                    <h3 className='sf-form-type-banner__title'>
                      {isMultiStep && __('Multi-step Form', 'subtleforms')}
                      {formType === 'sectioned' && __('Sectioned Form', 'subtleforms')}
                      {formType === 'conversational' && __('Conversational Form', 'subtleforms')}
                      {formType === 'payment' && __('Payment Form', 'subtleforms')}
                    </h3>
                    <p className='sf-form-type-banner__description'>
                      {isMultiStep && __('Fields are organized into steps. Users navigate through one step at a time with progress tracking.', 'subtleforms')}
                      {formType === 'sectioned' && __('Fields are grouped into collapsible sections. All sections are visible on a single page.', 'subtleforms')}
                      {formType === 'conversational' && __('Questions are presented one at a time. After completing all questions, users review answers before submitting.', 'subtleforms')}
                      {formType === 'payment' && __('This form collects payment information. Configure payment settings in Payments.', 'subtleforms')}
                    </p>
                  </div>
                )}
                <FormTypeControl schema={schema} onChange={onChange} isReadOnly={isReadOnly} />
                <TextControl
                  label={__('Form name', 'subtleforms')}
                  value={metadata.title || ''}
                  onChange={(value) => handleMetadataChange('title', value)}
                  help={__('The name shown to you and your visitors for this form.', 'subtleforms')}
                  disabled={isReadOnly}
                />
                <TextControl
                  label={__('Description', 'subtleforms')}
                  value={metadata.description || ''}
                  onChange={(value) => handleMetadataChange('description', value)}
                  help={__('Shown under the title when the block or shortcode displays it.', 'subtleforms')}
                  disabled={isReadOnly}
                />
              </div>
            )}

            {current.id === 'fields' && (
              <div className='sf-form-settings__card'>
                <SelectControl
                  __nextHasNoMarginBottom
                  __next40pxDefaultSize
                  label={__('Field label visibility', 'subtleforms')}
                  value={metadata.labelVisibility === 'hidden' ? 'hidden' : 'visible'}
                  options={[
                    { value: 'visible', label: __('Visible (top aligned)', 'subtleforms') },
                    { value: 'hidden', label: __('Hidden (kept for screen readers)', 'subtleforms') },
                  ]}
                  disabled={isReadOnly}
                  onChange={(v) => handleMetadataChange('labelVisibility', v)}
                />
                <SelectControl
                  __nextHasNoMarginBottom
                  __next40pxDefaultSize
                  label={__('Help text placement', 'subtleforms')}
                  value={metadata.descriptionPlacement === 'above' ? 'above' : 'below'}
                  options={[
                    { value: 'below', label: __('Below input', 'subtleforms') },
                    { value: 'above', label: __('Above input', 'subtleforms') },
                  ]}
                  disabled={isReadOnly}
                  onChange={(v) => handleMetadataChange('descriptionPlacement', v)}
                />
                <TextControl
                  __nextHasNoMarginBottom
                  __next40pxDefaultSize
                  label={__('Message when a required field is left empty', 'subtleforms')}
                  placeholder={__('This field is required.', 'subtleforms')}
                  value={metadata.requiredMessage || ''}
                  disabled={isReadOnly}
                  onChange={(v) => handleMetadataChange('requiredMessage', v)}
                />
                <TextControl
                  __nextHasNoMarginBottom
                  __next40pxDefaultSize
                  label={__('Message when an answer is not valid', 'subtleforms')}
                  help={__('Leave empty for the standard message of each field type.', 'subtleforms')}
                  value={metadata.validationMessage || ''}
                  disabled={isReadOnly}
                  onChange={(v) => handleMetadataChange('validationMessage', v)}
                />
              </div>
            )}

            {current.id === 'confirmation' && (
              <div className='sf-form-settings__card'>
                <ConfirmationPanel schema={schema} onMetadata={handleMetadataChange} isReadOnly={isReadOnly} />
              </div>
            )}

            {current.id === 'notifications' && (
              <div className='sf-form-settings__card sf-form-settings__card--stack'>
                <ActionsPanel schema={schema} onChange={onChange} isReadOnly={isReadOnly} />
              </div>
            )}

            {current.id === 'availability' && (
              <div className='sf-form-settings__card'>
                <AvailabilityPanel schema={schema} onMetadata={handleMetadataChange} isReadOnly={isReadOnly} />
              </div>
            )}

            {current.id === 'payments' && (
              <div className='sf-form-settings__stack'>
                {supportsPayment && (
                  <div className='sf-form-settings__card'>
                    {isConversationalForm && (
                      <div className='sf-info-box sf-info-box--blue'>
                        <p className='sf-info-box__text'>
                          <strong>{__('Conversational Payment:', 'subtleforms')}</strong>{' '}
                          {__('When enabled, users will answer questions, review their answers, and then complete payment before submission.', 'subtleforms')}
                        </p>
                      </div>
                    )}
                    {isPaymentForm && (
                      <div className='sf-info-box sf-info-box--blue'>
                        <p className='sf-info-box__text'>
                          <strong>{__('Note:', 'subtleforms')}</strong>{' '}
                          {__('Payment gateway integration will be added in a future update. These settings prepare your form for payment processing.', 'subtleforms')}
                        </p>
                      </div>
                    )}
                    <ToggleControl
                      label={__('Enable Payments', 'subtleforms')}
                      checked={paymentSettings.enabled}
                      onChange={(value) => handlePaymentSettingChange('enabled', value)}
                      help={__('Require payment for form submission', 'subtleforms')}
                      disabled={isReadOnly}
                    />
                    {paymentSettings.enabled && (
                      <>
                        <RadioControl
                          label={__('Payment Mode', 'subtleforms')}
                          selected={paymentSettings.mode}
                          options={[
                            { label: __('Test Mode', 'subtleforms'), value: 'test' },
                            { label: __('Live Mode', 'subtleforms'), value: 'live' },
                          ]}
                          onChange={(value) => handlePaymentSettingChange('mode', value)}
                          help={__('Test mode will not process real payments', 'subtleforms')}
                        />
                        <SelectControl
                          label={__('Currency', 'subtleforms')}
                          value={paymentSettings.currency}
                          options={[
                            { label: 'USD - US Dollar', value: 'USD' },
                            { label: 'EUR - Euro', value: 'EUR' },
                            { label: 'GBP - British Pound', value: 'GBP' },
                            { label: 'CAD - Canadian Dollar', value: 'CAD' },
                            { label: 'AUD - Australian Dollar', value: 'AUD' },
                            { label: 'JPY - Japanese Yen', value: 'JPY' },
                            { label: 'INR - Indian Rupee', value: 'INR' },
                          ]}
                          onChange={(value) => handlePaymentSettingChange('currency', value)}
                          help={__('Currency for payment transactions', 'subtleforms')}
                        />
                        <RadioControl
                          label={__('Amount Type', 'subtleforms')}
                          selected={paymentSettings.amountType}
                          options={[
                            { label: __('Fixed Amount', 'subtleforms'), value: 'fixed' },
                            { label: __('From Field', 'subtleforms'), value: 'field' },
                          ]}
                          onChange={(value) => handlePaymentSettingChange('amountType', value)}
                          help={__('Set a fixed amount or use a field value', 'subtleforms')}
                        />
                        {paymentSettings.amountType === 'fixed' && (
                          <TextControl
                            label={__('Fixed Amount', 'subtleforms')}
                            type='number'
                            step='0.01'
                            min='0'
                            value={paymentSettings.fixedAmount}
                            onChange={(value) => handlePaymentSettingChange('fixedAmount', value)}
                            help={__('The amount to charge (e.g., 29.99)', 'subtleforms')}
                          />
                        )}
                        {paymentSettings.amountType === 'field' && (
                          <SelectControl
                            label={__('Amount Field', 'subtleforms')}
                            value={paymentSettings.amountField}
                            options={[
                              { label: __('Select a field...', 'subtleforms'), value: '' },
                              ...fieldOptions,
                            ]}
                            onChange={(value) => handlePaymentSettingChange('amountField', value)}
                            help={__('Field that contains the payment amount', 'subtleforms')}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
                {takesMoney && !!window.subtleformsAdmin?.woocommerce && (
                  <div className='sf-form-settings__card sf-form-settings__card--stack'>
                    <CheckoutPanel
                      schema={schema}
                      fields={pricedFields}
                      onPayment={handleCheckoutChange}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                )}
              </div>
            )}

            {current.id === 'integrations' && (
              <div className='sf-form-settings__card sf-form-settings__card--stack'>
                <IntegrationsPanel schema={schema} onChange={onChange} isReadOnly={isReadOnly} />
              </div>
            )}

            {current.id === 'advanced' && (
              <div className='sf-form-settings__card'>
                <RadioControl
                  label={__('Builder canvas width', 'subtleforms')}
                  selected={metadata.canvasWidth || 'standard'}
                  options={[
                    { label: __('Narrow (640px)', 'subtleforms'), value: 'narrow' },
                    { label: __('Standard (768px)', 'subtleforms'), value: 'standard' },
                    { label: __('Wide (1024px)', 'subtleforms'), value: 'wide' },
                  ]}
                  onChange={(value) => handleMetadataChange('canvasWidth', value)}
                  help={__('Editing width inside the builder only. The published form’s width is set under Preview.', 'subtleforms')}
                />
                <TextControl
                  label={__('Internal identifier', 'subtleforms')}
                  value={metadata.name || 'form_schema'}
                  onChange={(value) => handleMetadataChange('name', value)}
                  help={__('Machine name used in exports and developer hooks. Most forms can leave this as it is.', 'subtleforms')}
                  disabled={isReadOnly}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/** Every key used in a field tree. */
function collectKeys(fields, keys = new Set()) {
  (Array.isArray(fields) ? fields : []).forEach((f) => {
    if (!f || typeof f !== 'object') return;
    if (f.key) keys.add(f.key);
    collectKeys(f.children, keys);
    collectKeys(f.fields, keys);
    (Array.isArray(f.columns) ? f.columns : []).forEach((col) => collectKeys(col, keys));
  });
  return keys;
}

/** Number of fields inside the steps of a field list. */
function countStepFields(fields) {
  return flattenSteps(fields).length;
}

/**
 * Form type selector (2.3.2).
 *
 * Standard to Multi-step puts every field in a first step. Multi-step to
 * Standard (or Conversational) removes the steps and keeps every field in
 * order, after a confirmation. Every change is one undoable edit.
 */
export function FormTypeControl({ schema, onChange, isReadOnly = false }) {
  const [pending, setPending] = useState(null);
  // Remounts the selector after a cancelled change so it shows the real type.
  const [resetCount, setResetCount] = useState(0);
  const type = structuralType(schema || {});
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];

  if (![TYPE_STANDARD, TYPE_MULTI_STEP, TYPE_CONVERSATIONAL].includes(type)) {
    return null;
  }

  const apply = (next) => {
    let nextFields = fields;
    if (next === TYPE_MULTI_STEP) {
      nextFields = wrapFieldsInStep(fields, {
        id: createNodeId(),
        key: createFieldKey('step', collectKeys(fields)),
        kind: 'structure',
        title: __('Step 1', 'subtleforms'),
        description: '',
      });
    } else if (hasSteps(fields)) {
      nextFields = flattenSteps(fields);
    }
    onChange({
      ...schema,
      fields: nextFields,
      metadata: { ...(schema?.metadata || {}), type: next },
    });
  };

  const request = (next) => {
    if (isReadOnly || next === type) return;
    if (type === TYPE_MULTI_STEP && hasSteps(fields)) {
      setPending(next);
      return;
    }
    apply(next);
  };

  const stepCount = fields.filter((f) => f && (f.type === 'step' || f.type === 'form_step')).length;
  const fieldCount = countStepFields(fields);
  const help = {
    [TYPE_STANDARD]: __('All fields on one page. Adding a Page Break makes the form Multi-step.', 'subtleforms'),
    [TYPE_MULTI_STEP]: __('Fields are split into steps by Page Breaks. Removing the last Page Break makes the form Standard.', 'subtleforms'),
    [TYPE_CONVERSATIONAL]: __('One question at a time, full screen.', 'subtleforms'),
  }[type];

  return (
    <div className='sf-form-type-control'>
      <ToggleGroupControl
        key={`${type}-${resetCount}`}
        __nextHasNoMarginBottom
        __next40pxDefaultSize
        isBlock
        label={__('Form type', 'subtleforms')}
        help={help}
        value={type}
        onChange={(v) => v && request(v)}>
        <ToggleGroupControlOption value={TYPE_STANDARD} label={__('Standard', 'subtleforms')} disabled={isReadOnly} />
        <ToggleGroupControlOption value={TYPE_MULTI_STEP} label={__('Multi-step', 'subtleforms')} disabled={isReadOnly} />
        <ToggleGroupControlOption value={TYPE_CONVERSATIONAL} label={__('Conversational', 'subtleforms')} disabled={isReadOnly} />
      </ToggleGroupControl>
      <ConfirmModal
        isOpen={!!pending}
        onClose={() => {
          setPending(null);
          setResetCount((c) => c + 1);
        }}
        title={
          pending === TYPE_CONVERSATIONAL
            ? __('Change to Conversational?', 'subtleforms')
            : __('Change to Standard?', 'subtleforms')
        }
        message={sprintf(
          /* translators: 1: number of steps, 2: number of fields */
          _n(
            'The %1$d step is removed. All %2$d fields stay, in the same order. You can undo this.',
            'The %1$d steps are removed. All %2$d fields stay, in the same order. You can undo this.',
            stepCount,
            'subtleforms'
          ),
          stepCount,
          fieldCount
        )}
        confirmText={__('Remove steps', 'subtleforms')}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          apply(next);
        }}
      />
    </div>
  );
}
