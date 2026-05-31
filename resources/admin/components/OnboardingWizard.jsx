import { useState } from '@wordpress/element';
import { Modal, CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from './ui/Icon';
import './OnboardingWizard.scss';

const FORM_GOALS = [
  {
    id: 'contact',
    label: __('Contact Form', 'subtleforms'),
    icon: Icon.Mail,
    description: __('Simple contact form for inquiries', 'subtleforms'),
    fields: ['name', 'email', 'message'],
  },
  {
    id: 'lead',
    label: __('Lead Capture', 'subtleforms'),
    icon: Icon.Clipboard,
    description: __('Capture leads with essential info', 'subtleforms'),
    fields: ['name', 'email', 'company', 'phone'],
  },
  {
    id: 'survey',
    label: __('Survey', 'subtleforms'),
    icon: Icon.List,
    description: __('Collect feedback and opinions', 'subtleforms'),
    fields: ['name', 'email', 'rating', 'feedback'],
  },
  {
    id: 'payment',
    label: __('Payment Form', 'subtleforms'),
    icon: Icon.CreditCard,
    description: __('Accept payments online', 'subtleforms'),
    fields: ['name', 'email', 'amount', 'payment'],
  },
  {
    id: 'conversational',
    label: __('Conversational', 'subtleforms'),
    icon: Icon.MessageCircle,
    description: __('Chat-like interactive form', 'subtleforms'),
    fields: ['name', 'email', 'message'],
  },
];

const FORM_TYPES = [
  {
    id: 'regular',
    label: __('Regular', 'subtleforms'),
    icon: Icon.FileText,
    description: __('Standard single-page form', 'subtleforms'),
  },
  {
    id: 'multi-step',
    label: __('Multi-Step', 'subtleforms'),
    icon: Icon.Layers,
    description: __('Break form into multiple steps', 'subtleforms'),
  },
  {
    id: 'sectioned',
    label: __('Sectioned', 'subtleforms'),
    icon: Icon.Columns,
    description: __('Organize into logical sections', 'subtleforms'),
  },
  {
    id: 'conversational',
    label: __('Conversational', 'subtleforms'),
    icon: Icon.MessageCircle,
    description: __('Chat-style one question at a time', 'subtleforms'),
  },
];

const FIELD_DEFINITIONS = {
  name: {
    key: 'name',
    type: 'text',
    config: {
      label: __('Name', 'subtleforms'),
      placeholder: __('Your name', 'subtleforms'),
      required: true,
    },
  },
  email: {
    key: 'email',
    type: 'email',
    config: {
      label: __('Email', 'subtleforms'),
      placeholder: __('your@email.com', 'subtleforms'),
      required: true,
    },
  },
  message: {
    key: 'message',
    type: 'textarea',
    config: {
      label: __('Message', 'subtleforms'),
      placeholder: __('Your message...', 'subtleforms'),
      required: true,
      rows: 5,
    },
  },
  company: {
    key: 'company',
    type: 'text',
    config: {
      label: __('Company', 'subtleforms'),
      placeholder: __('Company name', 'subtleforms'),
      required: false,
    },
  },
  phone: {
    key: 'phone',
    type: 'tel',
    config: {
      label: __('Phone', 'subtleforms'),
      placeholder: __('+1 (555) 123-4567', 'subtleforms'),
      required: false,
    },
  },
  rating: {
    key: 'rating',
    type: 'radio',
    config: {
      label: __('Rating', 'subtleforms'),
      required: true,
    },
    options: [
      { label: __('Excellent', 'subtleforms'), value: '5' },
      { label: __('Good', 'subtleforms'), value: '4' },
      { label: __('Average', 'subtleforms'), value: '3' },
      { label: __('Poor', 'subtleforms'), value: '2' },
      { label: __('Very Poor', 'subtleforms'), value: '1' },
    ],
  },
  feedback: {
    key: 'feedback',
    type: 'textarea',
    config: {
      label: __('Feedback', 'subtleforms'),
      placeholder: __('Your feedback...', 'subtleforms'),
      required: false,
      rows: 4,
    },
  },
  amount: {
    key: 'amount',
    type: 'number',
    config: {
      label: __('Amount', 'subtleforms'),
      placeholder: __('0.00', 'subtleforms'),
      required: true,
      min: 0,
      step: 0.01,
    },
  },
  payment: {
    key: 'payment',
    type: 'payment_gateway',
    config: {
      label: __('Payment Details', 'subtleforms'),
      required: true,
    },
  },
};

export default function OnboardingWizard({ onComplete, onDismiss }) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedType, setSelectedType] = useState('regular');

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      // Save to WordPress options via API
      fetch(
        (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
          '/wp-json/subtleforms/v1') + '/onboarding/dismiss',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            'Content-Type': 'application/json',
          },
        }
      ).catch((err) => console.error('Failed to dismiss wizard:', err));
    }
    onDismiss();
  };

  const handleFinish = () => {
    if (dontShowAgain) {
      // Save to WordPress options via API
      fetch(
        (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
          '/wp-json/subtleforms/v1') + '/onboarding/dismiss',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            'Content-Type': 'application/json',
          },
        }
      ).catch((err) => console.error('Failed to dismiss wizard:', err));
    }

    // Build form schema based on selections
    const goal = FORM_GOALS.find((g) => g.id === selectedGoal);
    const fields = goal
      ? goal.fields.map((fieldKey) => FIELD_DEFINITIONS[fieldKey])
      : [];

    const formData = {
      goal: selectedGoal,
      type: selectedType,
      fields: fields,
    };

    onComplete(formData);
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className='sf-ob__welcome'>
            <div className='sf-ob__welcome-icon'>
              <Icon.Sparkles size={24} />
            </div>
            <div className='sf-ob__welcome-heading'>
              <h2>{__('Welcome to SubtleForms', 'subtleforms')}</h2>
              <p>
                {__(
                  'Create beautiful, powerful forms in minutes. This quick setup will have your first form ready to go.',
                  'subtleforms'
                )}
              </p>
            </div>
            <div className='sf-ob__welcome-features'>
              <div className='sf-ob__welcome-feature'>
                <Icon.LayoutGrid size={14} />
                <span>{__('Drag & drop form builder', 'subtleforms')}</span>
              </div>
              <div className='sf-ob__welcome-feature'>
                <Icon.Settings size={14} />
                <span>
                  {__('Conditional logic & multi-step', 'subtleforms')}
                </span>
              </div>
              <div className='sf-ob__welcome-feature'>
                <Icon.FileText size={14} />
                <span>{__('Submissions dashboard', 'subtleforms')}</span>
              </div>
              <div className='sf-ob__welcome-feature'>
                <Icon.Lightbulb size={14} />
                <span>{__('Integrations & payments', 'subtleforms')}</span>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className='sf-ob__step'>
            <div className='sf-ob__step-header'>
              <h2>{__("What's your form goal?", 'subtleforms')}</h2>
              <p>
                {__(
                  'Select the purpose of your form to get started with the right fields.',
                  'subtleforms'
                )}
              </p>
            </div>
            <div className='sf-ob__grid'>
              {FORM_GOALS.map((goal) => {
                const ItemIcon = goal.icon;
                const isSelected = selectedGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    type='button'
                    onClick={() => setSelectedGoal(goal.id)}
                    className={clsx(
                      'sf-ob__option',
                      isSelected && 'sf-ob__option--active'
                    )}>
                    <div
                      className={clsx(
                        'sf-ob__option-icon',
                        isSelected && 'sf-ob__option-icon--active'
                      )}>
                      <ItemIcon size={18} />
                    </div>
                    <div>
                      <div className='sf-ob__option-label'>{goal.label}</div>
                      <div className='sf-ob__option-desc'>
                        {goal.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className='sf-ob__step'>
            <div className='sf-ob__step-header'>
              <h2>{__('Choose your form type', 'subtleforms')}</h2>
              <p>
                {__(
                  'How would you like to present your form to users?',
                  'subtleforms'
                )}
              </p>
            </div>
            <div className='sf-ob__grid'>
              {FORM_TYPES.map((type) => {
                const ItemIcon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type='button'
                    onClick={() => setSelectedType(type.id)}
                    className={clsx(
                      'sf-ob__option',
                      isSelected && 'sf-ob__option--active'
                    )}>
                    <div
                      className={clsx(
                        'sf-ob__option-icon',
                        isSelected && 'sf-ob__option-icon--active'
                      )}>
                      <ItemIcon size={18} />
                    </div>
                    <div>
                      <div className='sf-ob__option-label'>{type.label}</div>
                      <div className='sf-ob__option-desc'>
                        {type.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 3: {
        const goal = FORM_GOALS.find((g) => g.id === selectedGoal);
        const type = FORM_TYPES.find((t) => t.id === selectedType);
        return (
          <div className='sf-ob__step'>
            <div className='sf-ob__step-header'>
              <h2>{__('Field suggestions', 'subtleforms')}</h2>
              <p>
                {__(
                  "Based on your selections, we've pre-selected these fields. You can customize them in the builder.",
                  'subtleforms'
                )}
              </p>
            </div>
            <div className='sf-ob__review'>
              <div className='sf-ob__review-header'>
                <div>
                  <div className='sf-ob__review-title'>
                    {goal?.label || __('Your Form', 'subtleforms')}
                  </div>
                  <div className='sf-ob__review-sub'>
                    {type?.label || __('Regular', 'subtleforms')}{' '}
                    {__('form', 'subtleforms')}
                  </div>
                </div>
                <div className='sf-ob__review-count'>
                  {goal?.fields?.length || 0} {__('fields', 'subtleforms')}
                </div>
              </div>
              <div className='sf-ob__review-fields'>
                {goal?.fields?.map((fieldKey) => {
                  const field = FIELD_DEFINITIONS[fieldKey];
                  if (!field) return null;
                  return (
                    <div key={fieldKey} className='sf-ob__review-field'>
                      <Icon.Check
                        className='sf-ob__review-field-check'
                        size={14}
                      />
                      <div className='sf-ob__review-field-name'>
                        {field.config.label}
                      </div>
                      <div className='sf-ob__review-field-meta'>
                        {field.type}
                        {field.config.required &&
                          ` · ${__('req', 'subtleforms')}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      case 4:
        return (
          <div className='sf-ob__finish'>
            <div className='sf-ob__finish-icon'>
              <Icon.Check size={26} />
            </div>
            <h2>{__("You're all set!", 'subtleforms')}</h2>
            <p>
              {__(
                'Your form will be created with the selected fields. Customize everything in the form builder.',
                'subtleforms'
              )}
            </p>
            <div className='sf-ob__next-steps'>
              <div className='sf-ob__next-steps-title'>
                {__('Next steps', 'subtleforms')}
              </div>
              <ul className='sf-ob__next-steps-list'>
                {[
                  __('Customize your form fields in the builder', 'subtleforms'),
                  __(
                    'Configure validation and conditional logic',
                    'subtleforms'
                  ),
                  __('Preview your form to test it out', 'subtleforms'),
                  __(
                    'Publish and embed on your site with a shortcode',
                    'subtleforms'
                  ),
                ].map((text, i) => (
                  <li key={i} className='sf-ob__next-steps-item'>
                    <span className='sf-ob__next-steps-item-num'>
                      {i + 1}.
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={__('Form Setup', 'subtleforms')}
      onRequestClose={handleSkip}
      className='sf-ob-modal'>
      <div className='sf-ob'>
        {step > 0 && (
          <div className='sf-ob__progress'>
            <div className='sf-ob__progress-label'>
              <span>
                {__('Step', 'subtleforms')} {step} {__('of', 'subtleforms')}{' '}
                {totalSteps}
              </span>
              <span>{Math.round((step / totalSteps) * 100)}%</span>
            </div>
            <div className='sf-ob__progress-track'>
              <div
                className='sf-ob__progress-fill'
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className='sf-ob__content'>{renderStepContent()}</div>

        <div className='sf-ob__footer'>
          <div className='sf-ob__footer-left'>
            {step === 0 && (
              <CheckboxControl
                label={__("Don't show this again", 'subtleforms')}
                checked={dontShowAgain}
                onChange={setDontShowAgain}
              />
            )}
          </div>
          <div className='sf-ob__footer-right'>
            {step > 0 && (
              <button
                type='button'
                className='components-button is-secondary'
                onClick={handleBack}>
                {__('Back', 'subtleforms')}
              </button>
            )}
            <button
              type='button'
              className='components-button is-secondary'
              onClick={handleSkip}>
              {__('Skip', 'subtleforms')}
            </button>
            {step < totalSteps ? (
              <button
                type='button'
                className='components-button is-primary'
                onClick={handleNext}
                disabled={step === 1 && !selectedGoal}>
                {__('Next', 'subtleforms')}
              </button>
            ) : (
              <button
                type='button'
                className='components-button is-primary'
                onClick={handleFinish}>
                {__('Create Form', 'subtleforms')}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
