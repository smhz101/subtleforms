import { useState } from '@wordpress/element';
import { Modal, Button, CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
  FiFileText,
  FiMail,
  FiClipboard,
  FiCreditCard,
  FiMessageCircle,
  FiLayers,
  FiColumns,
  FiList,
  FiCheckCircle,
} from 'react-icons/fi';
import classNames from 'classnames';

const FORM_GOALS = [
  {
    id: 'contact',
    label: __('Contact Form', 'subtleforms'),
    icon: FiMail,
    description: __('Simple contact form for inquiries', 'subtleforms'),
    fields: ['name', 'email', 'message'],
  },
  {
    id: 'lead',
    label: __('Lead Capture', 'subtleforms'),
    icon: FiClipboard,
    description: __('Capture leads with essential info', 'subtleforms'),
    fields: ['name', 'email', 'company', 'phone'],
  },
  {
    id: 'survey',
    label: __('Survey', 'subtleforms'),
    icon: FiList,
    description: __('Collect feedback and opinions', 'subtleforms'),
    fields: ['name', 'email', 'rating', 'feedback'],
  },
  {
    id: 'payment',
    label: __('Payment Form', 'subtleforms'),
    icon: FiCreditCard,
    description: __('Accept payments online', 'subtleforms'),
    fields: ['name', 'email', 'amount', 'payment'],
  },
  {
    id: 'conversational',
    label: __('Conversational', 'subtleforms'),
    icon: FiMessageCircle,
    description: __('Chat-like interactive form', 'subtleforms'),
    fields: ['name', 'email', 'message'],
  },
];

const FORM_TYPES = [
  {
    id: 'regular',
    label: __('Regular', 'subtleforms'),
    icon: FiFileText,
    description: __('Standard single-page form', 'subtleforms'),
  },
  {
    id: 'multi-step',
    label: __('Multi-Step', 'subtleforms'),
    icon: FiLayers,
    description: __('Break form into multiple steps', 'subtleforms'),
  },
  {
    id: 'sectioned',
    label: __('Sectioned', 'subtleforms'),
    icon: FiColumns,
    description: __('Organize into logical sections', 'subtleforms'),
  },
  {
    id: 'conversational',
    label: __('Conversational', 'subtleforms'),
    icon: FiMessageCircle,
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
          <div className='sf-space-y-6'>
            <div className='sf-text-center'>
              <div className='sf-inline-flex sf-justify-center sf-items-center sf-bg-blue-100 sf-mb-4 sf-rounded-full sf-w-16 sf-h-16'>
                <FiCheckCircle className='sf-w-8 sf-h-8 sf-text-blue-600' />
              </div>
              <h2 className='sf-mb-2 sf-font-bold sf-text-gray-900 sf-text-2xl'>
                {__('Welcome to SubtleForms', 'subtleforms')}
              </h2>
              <p className='sf-mx-auto sf-max-w-md sf-text-gray-600'>
                {__(
                  'Create beautiful, powerful forms in minutes. This wizard will help you build your first form quickly.',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='sf-space-y-4 sf-bg-gray-50 sf-p-6 sf-rounded-lg'>
              <h3 className='sf-font-semibold sf-text-gray-900'>
                {__('What can you do with SubtleForms?', 'subtleforms')}
              </h3>
              <ul className='sf-space-y-2'>
                <li className='sf-flex sf-items-start'>
                  <FiCheckCircle className='sf-flex-shrink-0 sf-mt-0.5 sf-mr-2 sf-w-5 sf-h-5 sf-text-green-500' />
                  <span className='sf-text-gray-700'>
                    {__('Build forms with drag & drop', 'subtleforms')}
                  </span>
                </li>
                <li className='sf-flex sf-items-start'>
                  <FiCheckCircle className='sf-flex-shrink-0 sf-mt-0.5 sf-mr-2 sf-w-5 sf-h-5 sf-text-green-500' />
                  <span className='sf-text-gray-700'>
                    {__(
                      'Add conditional logic and multi-step flows',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='sf-flex sf-items-start'>
                  <FiCheckCircle className='sf-flex-shrink-0 sf-mt-0.5 sf-mr-2 sf-w-5 sf-h-5 sf-text-green-500' />
                  <span className='sf-text-gray-700'>
                    {__(
                      'Manage submissions and integrate with services',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='sf-flex sf-items-start'>
                  <FiCheckCircle className='sf-flex-shrink-0 sf-mt-0.5 sf-mr-2 sf-w-5 sf-h-5 sf-text-green-500' />
                  <span className='sf-text-gray-700'>
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
          <div className='sf-space-y-6'>
            <div className='sf-mb-6 sf-text-center'>
              <h2 className='sf-mb-2 sf-font-bold sf-text-gray-900 sf-text-2xl'>
                {__("What's your form goal?", 'subtleforms')}
              </h2>
              <p className='sf-text-gray-600'>
                {__(
                  'Select the purpose of your form to get started with the right fields.',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='sf-gap-4 sf-grid sf-grid-cols-1 sm:sf-grid-cols-2'>
              {FORM_GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    className={classNames(
                      'sf-p-6 sf-rounded-lg sf-border-2 sf-text-left sf-transition-all',
                      'hover:sf-border-blue-500 hover:sf-shadow-md',
                      isSelected
                        ? 'sf-border-blue-500 sf-bg-blue-50'
                        : 'sf-border-gray-200 sf-bg-white'
                    )}>
                    <div className='sf-flex sf-items-start'>
                      <div
                        className={classNames(
                          'sf-flex-shrink-0 sf-w-10 sf-h-10 sf-rounded-lg sf-flex sf-items-center sf-justify-center',
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                        )}>
                        <Icon className='sf-w-5 sf-h-5' />
                      </div>
                      <div className='sf-flex-1 sf-ml-4'>
                        <h3
                          className={classNames(
                            'font-semibold mb-1',
                            isSelected ? 'text-blue-900' : 'text-gray-900'
                          )}>
                          {goal.label}
                        </h3>
                        <p className='sf-text-gray-600 sf-text-sm'>
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
          <div className='sf-space-y-6'>
            <div className='sf-mb-6 sf-text-center'>
              <h2 className='sf-mb-2 sf-font-bold sf-text-gray-900 sf-text-2xl'>
                {__('Choose your form type', 'subtleforms')}
              </h2>
              <p className='sf-text-gray-600'>
                {__(
                  'How would you like to present your form to users?',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='sf-gap-4 sf-grid sf-grid-cols-1 sm:sf-grid-cols-2'>
              {FORM_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={classNames(
                      'sf-p-6 sf-rounded-lg sf-border-2 sf-text-left sf-transition-all',
                      'hover:sf-border-blue-500 hover:sf-shadow-md',
                      isSelected
                        ? 'sf-border-blue-500 sf-bg-blue-50'
                        : 'sf-border-gray-200 sf-bg-white'
                    )}>
                    <div className='sf-flex sf-items-start'>
                      <div
                        className={classNames(
                          'sf-flex-shrink-0 sf-w-10 sf-h-10 sf-rounded-lg sf-flex sf-items-center sf-justify-center',
                          isSelected
                            ? 'sf-bg-blue-600 sf-text-white'
                            : 'sf-bg-gray-100 sf-text-gray-600'
                        )}>
                        <Icon className='sf-w-5 sf-h-5' />
                      </div>
                      <div className='sf-flex-1 sf-ml-4'>
                        <h3
                          className={classNames(
                            'font-semibold mb-1',
                            isSelected ? 'text-blue-900' : 'text-gray-900'
                          )}>
                          {type.label}
                        </h3>
                        <p className='sf-text-gray-600 sf-text-sm'>
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
          <div className='sf-space-y-6'>
            <div className='sf-mb-6 sf-text-center'>
              <h2 className='sf-mb-2 sf-font-bold sf-text-gray-900 sf-text-2xl'>
                {__('Field suggestions', 'subtleforms')}
              </h2>
              <p className='sf-text-gray-600'>
                {__(
                  "Based on your selections, we've pre-selected these fields. You can customize them in the builder.",
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='sf-bg-white sf-p-6 sf-border sf-border-gray-200 sf-rounded-lg'>
              <div className='sf-space-y-4'>
                <div className='sf-flex sf-justify-between sf-items-center sf-pb-4 sf-border-gray-200 sf-border-b'>
                  <div>
                    <div className='sf-font-semibold sf-text-gray-900'>
                      {goal?.label || __('Your Form', 'subtleforms')}
                    </div>
                    <div className='sf-text-gray-600 sf-text-sm'>
                      {type?.label || __('Regular', 'subtleforms')}{' '}
                      {__('form', 'subtleforms')}
                    </div>
                  </div>
                  <div className='sf-text-gray-500 sf-text-sm'>
                    {goal?.fields?.length || 0} {__('fields', 'subtleforms')}
                  </div>
                </div>

                <div className='sf-space-y-2'>
                  {goal?.fields?.map((fieldKey) => {
                    const field = FIELD_DEFINITIONS[fieldKey];
                    if (!field) return null;
                    return (
                      <div
                        key={fieldKey}
                        className='sf-flex sf-items-center sf-bg-gray-50 sf-p-3 sf-rounded-lg'>
                        <FiCheckCircle className='sf-flex-shrink-0 sf-mr-3 sf-w-5 sf-h-5 sf-text-green-500' />
                        <div className='sf-flex-1'>
                          <div className='sf-font-medium sf-text-gray-900'>
                            {field.config.label}
                          </div>
                          <div className='sf-text-gray-500 sf-text-sm'>
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
          <div className='sf-space-y-6'>
            <div className='sf-text-center'>
              <div className='sf-inline-flex sf-justify-center sf-items-center sf-bg-green-100 sf-mb-4 sf-rounded-full sf-w-16 sf-h-16'>
                <FiCheckCircle className='sf-w-8 sf-h-8 sf-text-green-600' />
              </div>
              <h2 className='sf-mb-2 sf-font-bold sf-text-gray-900 sf-text-2xl'>
                {__("You're all set!", 'subtleforms')}
              </h2>
              <p className='sf-mx-auto sf-max-w-md sf-text-gray-600'>
                {__(
                  'Your form will be created with the selected fields. You can customize everything in the form builder.',
                  'subtleforms'
                )}
              </p>
            </div>

            <div className='sf-bg-blue-50 sf-p-6 sf-border sf-border-blue-200 sf-rounded-lg'>
              <h3 className='sf-mb-3 sf-font-semibold sf-text-blue-900'>
                {__('Next steps:', 'subtleforms')}
              </h3>
              <ul className='sf-space-y-2'>
                <li className='sf-flex sf-items-start sf-text-blue-800'>
                  <span className='sf-mr-2'>1.</span>
                  <span>
                    {__(
                      'Customize your form fields in the builder',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='sf-flex sf-items-start sf-text-blue-800'>
                  <span className='sf-mr-2'>2.</span>
                  <span>
                    {__(
                      'Configure validation rules and conditional logic',
                      'subtleforms'
                    )}
                  </span>
                </li>
                <li className='sf-flex sf-items-start sf-text-blue-800'>
                  <span className='sf-mr-2'>3.</span>
                  <span>
                    {__('Preview your form to test it out', 'subtleforms')}
                  </span>
                </li>
                <li className='sf-flex sf-items-start sf-text-blue-800'>
                  <span className='sf-mr-2'>4.</span>
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
      <div className='sf-p-6'>
        {/* Progress Indicator */}
        {step > 0 && (
          <div className='sf-mb-8'>
            <div className='sf-flex sf-justify-between sf-items-center sf-mb-2 sf-text-gray-600 sf-text-sm'>
              <span>
                {__('Step', 'subtleforms')} {step} {__('of', 'subtleforms')}{' '}
                {totalSteps}
              </span>
              <span>
                {Math.round((step / totalSteps) * 100)}%{' '}
                {__('complete', 'subtleforms')}
              </span>
            </div>
            <div className='sf-bg-gray-200 sf-rounded-full sf-h-2 sf-overflow-hidden'>
              <div
                className='sf-bg-blue-600 sf-h-full sf-transition-all sf-duration-300'
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className='sf-min-h-[400px]'>{renderStepContent()}</div>

        {/* Actions */}
        <div className='sf-mt-8 sf-pt-6 sf-border-gray-200 sf-border-t'>
          <div className='sf-flex sf-justify-between sf-items-center'>
            <div>
              {step === 0 && (
                <CheckboxControl
                  label={__("Don't show this again", 'subtleforms')}
                  checked={dontShowAgain}
                  onChange={setDontShowAgain}
                />
              )}
            </div>
            <div className='sf-flex sf-items-center sf-space-x-3'>
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
