import { useState } from '@wordpress/element';
import { Modal, Button, CheckboxControl } from '@wordpress/components';
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
          <div className='onboarding-wizard__content-wrapper'>
            <div className='onboarding-wizard__welcome'>
              <div className='onboarding-wizard__welcome-icon'>
                <Icon.CheckCircle />
              </div>
              <h2>{__('Welcome to SubtleForms', 'subtleforms')}</h2>
              <p>
                {__(
                  'Create beautiful, powerful forms in minutes. This wizard will help you build your first form quickly.',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='onboarding-wizard__features'>
              <h3>{__('What can you do with SubtleForms?', 'subtleforms')}</h3>
              <ul>
                <li className='onboarding-wizard__features-item'>
                  <Icon.CheckCircle />
                  <span>
                    {__('Build forms with drag & drop', 'subtleforms')}
                  </span>
                </li>
                <li className='onboarding-wizard__features-item'>
                  <Icon.CheckCircle />
                  <span>
                    {__(
                      'Add conditional logic and multi-step flows',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='onboarding-wizard__features-item'>
                  <Icon.CheckCircle />
                  <span>
                    {__(
                      'Manage submissions and integrate with services',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='onboarding-wizard__features-item'>
                  <Icon.CheckCircle />
                  <span>
                    {__(
                      'Accept payments and create conversational forms',
                      'subtleforms'
                    )}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        );

      case 1:
        return (
          <div className='sf-onboarding-wizard__step'>
            <div className='sf-onboarding-wizard__step-header'>
              <h2 className='sf-onboarding-wizard__step-title'>
                {__("What's your form goal?", 'subtleforms')}
              </h2>
              <p className='sf-onboarding-wizard__step-description'>
                {__(
                  'Select the purpose of your form to get started with the right fields.',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='onboarding-wizard__grid'>
              {FORM_GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    className={clsx(
                      'sf-onboarding-wizard__option',
                      isSelected && 'sf-onboarding-wizard__option--selected'
                    )}>
                    <div className='sf-onboarding-wizard__option-content'>
                      <div
                        className={clsx(
                          'sf-onboarding-wizard__option-icon',
                          isSelected &&
                            'sf-onboarding-wizard__option-icon--selected'
                        )}>
                        <Icon />
                      </div>
                      <div className='sf-onboarding-wizard__option-text'>
                        <h3 className='sf-onboarding-wizard__option-title'>
                          {goal.label}
                        </h3>
                        <p className='sf-onboarding-wizard__option-description'>
                          {goal.description}
                        </p>
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
          <div className='sf-onboarding-wizard__step'>
            <div className='sf-onboarding-wizard__step-header'>
              <h2 className='sf-onboarding-wizard__step-title'>
                {__('Choose your form type', 'subtleforms')}
              </h2>
              <p className='sf-onboarding-wizard__step-description'>
                {__(
                  'How would you like to present your form to users?',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='onboarding-wizard__grid'>
              {FORM_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={clsx(
                      'sf-onboarding-wizard__option',
                      isSelected && 'sf-onboarding-wizard__option--selected'
                    )}>
                    <div className='sf-onboarding-wizard__option-content'>
                      <div
                        className={clsx(
                          'sf-onboarding-wizard__option-icon',
                          isSelected &&
                            'sf-onboarding-wizard__option-icon--selected'
                        )}>
                        <Icon />
                      </div>
                      <div className='onboarding-wizard__option-text'>
                        <h3
                          className={clsx(
                            'mb-1 font-semibold',
                            isSelected ? 'text-blue-900' : 'text-gray-900'
                          )}>
                          {type.label}
                        </h3>
                        <p className='sf-onboarding-wizard__option-description'>
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 3:
        const goal = FORM_GOALS.find((g) => g.id === selectedGoal);
        const type = FORM_TYPES.find((t) => t.id === selectedType);
        return (
          <div className='sf-onboarding-wizard__step'>
            <div className='sf-onboarding-wizard__step-header'>
              <h2 className='sf-onboarding-wizard__step-title'>
                {__('Field suggestions', 'subtleforms')}
              </h2>
              <p className='sf-onboarding-wizard__step-description'>
                {__(
                  "Based on your selections, we've pre-selected these fields. You can customize them in the builder.",
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='onboarding-wizard__review-card'>
              <div className='onboarding-wizard__review-card-content'>
                <div className='onboarding-wizard__review-header'>
                  <div>
                    <div className='onboarding-wizard__review-title'>
                      {goal?.label || __('Your Form', 'subtleforms')}
                    </div>
                    <div className='onboarding-wizard__review-subtitle'>
                      {type?.label || __('Regular', 'subtleforms')}{' '}
                      {__('form', 'subtleforms')}
                    </div>
                  </div>
                  <div className='onboarding-wizard__review-count'>
                    {goal?.fields?.length || 0} {__('fields', 'subtleforms')}
                  </div>
                </div>

                <div className='onboarding-wizard__review-fields'>
                  {goal?.fields?.map((fieldKey) => {
                    const field = FIELD_DEFINITIONS[fieldKey];
                    if (!field) return null;
                    return (
                      <div
                        key={fieldKey}
                        className='onboarding-wizard__review-field'>
                        <Icon.CheckCircle />
                        <div className='onboarding-wizard__review-field-info'>
                          <div className='onboarding-wizard__review-field-name'>
                            {field.config.label}
                          </div>
                          <div className='onboarding-wizard__review-field-meta'>
                            {field.type}
                            {field.config.required &&
                              ` • ${__('Required', 'subtleforms')}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className='sf-onboarding-wizard__step'>
            <div className='sf-onboarding-wizard__step-header'>
              <div className='onboarding-wizard__finish-icon'>
                <Icon.CheckCircle />
              </div>
              <h2 className='sf-onboarding-wizard__step-title'>
                {__("You're all set!", 'subtleforms')}
              </h2>
              <p className='sf-onboarding-wizard__step-description'>
                {__(
                  'Your form will be created with the selected fields. You can customize everything in the form builder.',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='onboarding-wizard__next-steps'>
              <h3 className='onboarding-wizard__next-steps-title'>
                {__('Next steps:', 'subtleforms')}
              </h3>
              <ul className='onboarding-wizard__next-steps-list'>
                <li className='onboarding-wizard__next-steps-item'>
                  <span className='onboarding-wizard__next-steps-number'>1.</span>
                  <span>
                    {__(
                      'Customize your form fields in the builder',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='onboarding-wizard__next-steps-item'>
                  <span className='onboarding-wizard__next-steps-number'>2.</span>
                  <span>
                    {__(
                      'Configure validation rules and conditional logic',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='onboarding-wizard__next-steps-item'>
                  <span className='onboarding-wizard__next-steps-number'>3.</span>
                  <span>
                    {__('Preview your form to test it out', 'subtleforms')}
                  </span>
                </li>
                <li className='onboarding-wizard__next-steps-item'>
                  <span className='onboarding-wizard__next-steps-number'>4.</span>
                  <span>
                    {__(
                      'Publish and embed it on your site with a shortcode',
                      'subtleforms'
                    )}
                  </span>
                </li>
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
      title={step === 0 ? '' : __('Form Setup Wizard', 'subtleforms')}
      onRequestClose={handleSkip}
      className='subtleforms-onboarding-wizard'
      style={{ maxWidth: '640px' }}>
      <div className='onboarding-wizard'>
        {/* Progress Indicator */}
        {step > 0 && (
          <div className='onboarding-wizard__progress'>
            <div className='onboarding-wizard__progress-header'>
              <span>
                {__('Step', 'subtleforms')} {step} {__('of', 'subtleforms')}{' '}
                {totalSteps}
              </span>
              <span>
                {Math.round((step / totalSteps) * 100)}%{' '}
                {__('complete', 'subtleforms')}
              </span>
            </div>
            <div className='onboarding-wizard__progress-bar-container'>
              <div
                className='onboarding-wizard__progress-bar'
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className='onboarding-wizard__content'>{renderStepContent()}</div>

        {/* Actions */}
        <div className='onboarding-wizard__actions'>
          <div className='onboarding-wizard__actions-container'>
            <div>
              {step === 0 && (
                <CheckboxControl
                  label={__("Don't show this again", 'subtleforms')}
                  checked={dontShowAgain}
                  onChange={setDontShowAgain}
                />
              )}
            </div>
            <div className='onboarding-wizard__actions-buttons'>
              {step > 0 && (
                <Button isSecondary onClick={handleBack}>
                  {__('Back', 'subtleforms')}
                </Button>
              )}
              <Button isSecondary onClick={handleSkip}>
                {__('Skip', 'subtleforms')}
              </Button>
              {step < totalSteps ? (
                <Button
                  isPrimary
                  onClick={handleNext}
                  disabled={step === 1 && !selectedGoal}>
                  {__('Next', 'subtleforms')}
                </Button>
              ) : (
                <Button isPrimary onClick={handleFinish}>
                  {__('Create Form', 'subtleforms')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
