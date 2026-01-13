import { useState, useEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './ui/Icon';
import clsx from 'clsx';
import './BuilderTour.scss';

const TOUR_STEPS = [
  {
    id: 'header',
    title: __('Form Header', 'subtleforms'),
    content: __(
      'This is your form title. Click to edit it. You can see the form status (Draft/Published) and use Save, Publish, or Delete buttons.',
      'subtleforms'
    ),
    selector: '[data-tour="header"]',
    position: 'bottom',
  },
  {
    id: 'draft-vs-publish',
    title: __('Draft vs Publish', 'subtleforms'),
    content: __(
      'Draft means your changes are saved but not live. Publish makes the form live. If it is already published, Update applies your latest changes.',
      'subtleforms'
    ),
    selector: '[data-tour="status-badge"]',
    position: 'bottom',
  },
  {
    id: 'left-panel',
    title: __('Fields Panel', 'subtleforms'),
    content: __(
      'Browse available field types organized by category. Click any field to add it to your form canvas.',
      'subtleforms'
    ),
    selector: '[data-tour="fields-panel"]',
    position: 'right',
  },
  {
    id: 'canvas',
    title: __('Form Canvas', 'subtleforms'),
    content: __(
      'This is your form canvas. Add fields, drag to reorder, and organize your form structure. Click any field to select and configure it.',
      'subtleforms'
    ),
    selector: '[data-tour="canvas"]',
    position: 'top',
  },
  {
    id: 'field-toolbar',
    title: __('Field Toolbar', 'subtleforms'),
    content: __(
      'When a field is selected, use these tools to move it up/down, duplicate, or delete it.',
      'subtleforms'
    ),
    selector: '[data-tour="field-toolbar"]',
    position: 'left',
  },
  {
    id: 'right-panel',
    title: __('Field Inspector', 'subtleforms'),
    content: __(
      'Configure the selected field here. Set properties, validation rules, and conditional logic in the tabs.',
      'subtleforms'
    ),
    selector: '[data-tour="field-inspector"]',
    position: 'left',
  },
  {
    id: 'entries-tab',
    title: __('Submissions Tab', 'subtleforms'),
    content: __(
      'Switch to this tab to view form submissions. You can see all responses, filter them, and export data.',
      'subtleforms'
    ),
    selector: '.data-tour-submissions-tab',
    position: 'bottom',
  },
  {
    id: 'complete',
    title: __('Tour Complete!', 'subtleforms'),
    content: __(
      "You're ready to build amazing forms! Click the help icon anytime to restart this tour.",
      'subtleforms'
    ),
    selector: null,
    position: 'center',
  },
];

export default function BuilderTour({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const tooltipRef = useRef(null);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  useEffect(() => {
    const positionTooltip = () => {
      if (!step.selector) {
        // Center position for final step
        setTooltipPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        });
        setIsPositioned(true);
        return;
      }

      const targetElement = document.querySelector(step.selector);
      const tooltipElement = tooltipRef.current;

      if (!targetElement || !tooltipElement) {
        setIsPositioned(false);
        return;
      }

      const targetRect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltipElement.getBoundingClientRect();
      const offset = 20;

      let top = 0;
      let left = 0;

      switch (step.position) {
        case 'top':
          top = targetRect.top - tooltipRect.height - offset;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = targetRect.bottom + offset;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.left - tooltipRect.width - offset;
          break;
        case 'right':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.right + offset;
          break;
        default:
          top = targetRect.bottom + offset;
          left = targetRect.left;
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 10) left = 10;
      if (left + tooltipRect.width > viewportWidth - 10) {
        left = viewportWidth - tooltipRect.width - 10;
      }
      if (top < 10) top = 10;
      if (top + tooltipRect.height > viewportHeight - 10) {
        top = viewportHeight - tooltipRect.height - 10;
      }

      setTooltipPosition({ top, left });
      setIsPositioned(true);

      // Scroll target into view
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    };

    // Delay positioning to allow DOM to settle
    const timeout = setTimeout(positionTooltip, 100);

    // Reposition on window resize
    window.addEventListener('resize', positionTooltip);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', positionTooltip);
    };
  }, [currentStep, step]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setIsPositioned(false);
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setIsPositioned(false);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Save tour completion
    fetch(
      (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
        '/wp-json/subtleforms/v1') + '/tour/complete',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
          'Content-Type': 'application/json',
        },
      }
    ).catch((err) => console.error('Failed to save tour completion:', err));

    onComplete();
  };

  const handleSkip = () => {
    // Save tour skip
    fetch(
      (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
        '/wp-json/subtleforms/v1') + '/tour/complete',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
          'Content-Type': 'application/json',
        },
      }
    ).catch((err) => console.error('Failed to save tour skip:', err));

    onSkip();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className='sf-builder-tour__overlay'
        style={{ pointerEvents: 'none' }}
      />

      {/* Spotlight */}
      {step.selector && (
        <div
          className='sf-builder-tour__spotlight'
          style={{
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            transition: 'all 0.3s ease-in-out',
            ...(() => {
              const targetElement = document.querySelector(step.selector);
              if (!targetElement) return {};
              const rect = targetElement.getBoundingClientRect();
              return {
                top: rect.top - 4,
                left: rect.left - 4,
                width: rect.width + 8,
                height: rect.height + 8,
              };
            })(),
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={clsx(
          'sf-builder-tour__tooltip',
          isPositioned && 'sf-builder-tour__tooltip--positioned'
        )}
        style={{
          ...tooltipPosition,
          ...(tooltipPosition.transform
            ? {}
            : { position: 'fixed', zIndex: 50 }),
        }}>
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className='sf-builder-tour__close-btn'
          aria-label={__('Close tour', 'subtleforms')}>
          <Icon.Close />
        </button>

        {/* Progress */}
        <div className='sf-builder-tour__progress'>
          <div className='sf-builder-tour__progress-text'>
            <span>
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <span>
              {Math.round(((currentStep + 1) / TOUR_STEPS.length) * 100)}%
            </span>
          </div>
          <div className='sf-builder-tour__progress-bar-container'>
            <div
              className='sf-builder-tour__progress-bar'
              style={{
                width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className='sf-builder-tour__content'>
          <h3 className='sf-mb-2 sf-font-semibold sf-text-gray-900 sf-text-lg'>
            {step.title}
          </h3>
          <p className='sf-text-gray-600 sf-leading-relaxed'>{step.content}</p>
        </div>

        {/* Actions */}
        <div className='sf-builder-tour__actions'>
          <div className='sf-builder-tour__actions-left'>
            {currentStep > 0 && (
              <Button isSecondary onClick={handlePrev}>
                <Icon.Left />
                {__('Back', 'subtleforms')}
              </Button>
            )}
          </div>
          <div className='sf-builder-tour__actions-right'>
            <Button isSecondary onClick={handleSkip}>
              {__('Skip Tour', 'subtleforms')}
            </Button>
            <Button isPrimary onClick={handleNext}>
              {isLastStep ? (
                __('Finish', 'subtleforms')
              ) : (
                <>
                  {__('Next', 'subtleforms')}
                  <Icon.Right />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
