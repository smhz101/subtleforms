import { useMemo, useState } from '@wordpress/element';
import {
  Button,
  TextControl,
  TextareaControl,
  RadioControl,
  CheckboxControl,
  Notice,
  Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const STEPS = [
  { key: 'basics', title: __('Form basics', 'subtleforms') },
  { key: 'type', title: __('Form type', 'subtleforms') },
  { key: 'start', title: __('Starting point', 'subtleforms') },
];

export default function CreateFormWizard({
  initialTitle = '',
  onComplete,
  onCancel,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [formType, setFormType] = useState('regular');
  const [startingPoint, setStartingPoint] = useState('blank');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const step = STEPS[stepIndex];

  const canContinue = useMemo(() => {
    if (step.key === 'basics') {
      return (title || '').trim().length > 0;
    }
    if (step.key === 'type') {
      return !!formType;
    }
    if (step.key === 'start') {
      return !!startingPoint;
    }
    return false;
  }, [formType, startingPoint, step.key, title]);

  const primaryLabel = useMemo(() => {
    if (stepIndex < STEPS.length - 1) {
      return __('Next', 'subtleforms');
    }
    return __('Create form', 'subtleforms');
  }, [stepIndex]);

  async function handlePrimary() {
    setError(null);

    if (!canContinue) {
      return;
    }

    if (stepIndex < STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
      return;
    }

    // Final submit
    try {
      setSubmitting(true);
      await onComplete?.({
        title: (title || '').trim(),
        description: (description || '').trim(),
        formType,
        startingPoint,
        dontShowAgain,
      });
    } catch (e) {
      setError(e?.message || __('Failed to create form.', 'subtleforms'));
      setSubmitting(false);
    }
  }

  function handleBack() {
    setError(null);
    setStepIndex((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className='sf-flex sf-justify-center sf-items-center sf-p-6 sf-min-h-[calc(100vh-32px)]'>
      <div className='sf-bg-white sf-shadow-sm sf-border sf-border-gray-200 sf-rounded sf-w-full sf-max-w-[680px]'>
        <div className='sf-px-6 sf-py-5 sf-border-gray-200 sf-border-b'>
          <div className='sf-flex sf-justify-between sf-items-center sf-gap-4'>
            <div>
              <h1 className='sf-m-0 sf-font-semibold sf-text-lg'>
                {__('Create form', 'subtleforms')}
              </h1>
              <div className='sf-mt-1 sf-text-gray-600 sf-text-sm'>
                {step.title} ({stepIndex + 1}/{STEPS.length})
              </div>
            </div>

            {submitting && (
              <div className='sf-flex sf-items-center sf-gap-2 sf-text-gray-600 sf-text-sm'>
                <Spinner />
                {__('Creating…', 'subtleforms')}
              </div>
            )}
          </div>
        </div>

        <div className='sf-px-6 sf-py-5'>
          {error && (
            <Notice status='error' isDismissible={false}>
              {error}
            </Notice>
          )}

          {step.key === 'basics' && (
            <div className='sf-flex sf-flex-col sf-gap-4'>
              <TextControl
                label={__('Form name', 'subtleforms')}
                value={title}
                onChange={(v) => setTitle(v)}
                disabled={submitting}
              />
              <TextareaControl
                label={__('Short description (optional)', 'subtleforms')}
                value={description}
                onChange={(v) => setDescription(v)}
                disabled={submitting}
              />
            </div>
          )}

          {step.key === 'type' && (
            <RadioControl
              label={__('Choose a form type', 'subtleforms')}
              selected={formType}
              options={[
                { label: __('Regular form', 'subtleforms'), value: 'regular' },
                {
                  label: __('Multi-step form', 'subtleforms'),
                  value: 'multi-step',
                },
                {
                  label: __('Sectioned form', 'subtleforms'),
                  value: 'sectioned',
                },
                {
                  label: __('Conversational form', 'subtleforms'),
                  value: 'conversational',
                },
              ]}
              onChange={(v) => setFormType(v)}
              disabled={submitting}
            />
          )}

          {step.key === 'start' && (
            <div className='sf-flex sf-flex-col sf-gap-4'>
              <RadioControl
                label={__('Starting point', 'subtleforms')}
                selected={startingPoint}
                options={[
                  { label: __('Blank', 'subtleforms'), value: 'blank' },
                  {
                    label: __(
                      'Minimal template (based on form type)',
                      'subtleforms'
                    ),
                    value: 'minimal',
                  },
                ]}
                onChange={(v) => setStartingPoint(v)}
                disabled={submitting}
              />

              <CheckboxControl
                label={__("Don't show again", 'subtleforms')}
                checked={dontShowAgain}
                onChange={(checked) => setDontShowAgain(checked)}
                disabled={submitting}
              />
            </div>
          )}
        </div>

        <div className='sf-flex sf-justify-between sf-items-center sf-px-6 sf-py-4 sf-border-gray-200 sf-border-t'>
          <div className='sf-flex sf-items-center sf-gap-2'>
            {stepIndex > 0 ? (
              <Button isSecondary onClick={handleBack} disabled={submitting}>
                {__('Back', 'subtleforms')}
              </Button>
            ) : (
              <Button isSecondary onClick={onCancel} disabled={submitting}>
                {__('Cancel', 'subtleforms')}
              </Button>
            )}
          </div>

          <Button
            isPrimary
            onClick={handlePrimary}
            disabled={submitting || !canContinue}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
