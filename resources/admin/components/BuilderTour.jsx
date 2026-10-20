import { useState, useEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import clsx from 'clsx';
import './BuilderTour.scss';

/**
 * Select the first field on the canvas when none is selected, so the field
 * toolbar and the inspector steps point at something (UX2-26).
 */
export function selectFirstField(doc = document) {
  if (doc.querySelector('.sf-field-toolbar--visible')) {
    return;
  }
  const field = doc.querySelector('[data-tour="canvas"] .sf-field-chrome');
  if (field) {
    field.click();
  }
}

/**
 * Bring a target into view by scrolling its own scroll container, never
 * the window: the builder fills the window and must not move (UX2-26).
 *
 * @param {Element} el Target.
 */
export function revealInContainer(el) {
  let box = el.parentElement;
  while (box && box !== document.body) {
    const style = window.getComputedStyle(box);
    if (/(auto|scroll)/.test(style.overflowY) && box.scrollHeight > box.clientHeight) {
      break;
    }
    box = box.parentElement;
  }
  if (!box || box === document.body) {
    return;
  }
  const target = el.getBoundingClientRect();
  const area = box.getBoundingClientRect();
  if (target.top >= area.top && target.bottom <= area.bottom) {
    return;
  }
  // A target taller than its area shows from its top.
  box.scrollTop += target.top - area.top - 16;
}

export const TOUR_STEPS = [
  {
    id: 'header',
    title: __('Form header', 'subtleforms'),
    content: __(
      'This is the form title: click it to rename the form. The Publish button on the right makes the form live, and its arrow opens Save draft, Discard changes and Delete form.',
      'subtleforms'
    ),
    selector: '[data-tour="header"]',
    position: 'bottom',
  },
  {
    id: 'draft-vs-publish',
    title: __('Draft and published', 'subtleforms'),
    content: __(
      'Draft means your changes are saved but not live. Publish makes the form live. If it is already published, Update applies your latest changes.',
      'subtleforms'
    ),
    selector: '[data-tour="status-badge"]',
    position: 'bottom',
  },
  {
    id: 'left-panel',
    title: __('Fields', 'subtleforms'),
    content: __(
      'Browse the field types by category. Click a field, or drag it, to add it to the form.',
      'subtleforms'
    ),
    selector: '[data-tour="fields-panel"]',
    position: 'right',
  },
  {
    id: 'canvas',
    title: __('Form canvas', 'subtleforms'),
    content: __(
      'This is your form. Drag fields to reorder them and click a field to select it.',
      'subtleforms'
    ),
    selector: '[data-tour="canvas"]',
    position: 'left',
  },
  {
    id: 'field-toolbar',
    title: __('Field toolbar', 'subtleforms'),
    content: __(
      'A selected field has these tools: drag it, move it up or down, change its width, duplicate it or delete it.',
      'subtleforms'
    ),
    selector: '.sf-field-toolbar--visible[data-tour="field-toolbar"]',
    position: 'bottom',
    prepare: selectFirstField,
  },
  {
    id: 'right-panel',
    title: __('Field settings', 'subtleforms'),
    content: __(
      'The selected field is set up here: its label and options under Field, then Validation, Logic and Style.',
      'subtleforms'
    ),
    selector: '[data-tour="field-inspector"]',
    position: 'left',
    prepare: selectFirstField,
  },
  {
    id: 'entries-tab',
    title: __('Entries', 'subtleforms'),
    content: __(
      'Open Entries to read the submissions of this form, filter them and export them.',
      'subtleforms'
    ),
    selector: '.data-tour-submissions-tab',
    position: 'bottom',
  },
  {
    id: 'complete',
    title: __('That is the tour', 'subtleforms'),
    content: __(
      'You can start it again from the help icon at any time.',
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

      if (!tooltipElement) {
        setIsPositioned(false);
        return;
      }
      if (!targetElement) {
        // Nothing to point at: show the step in the middle (UX2-26).
        setTooltipPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
        setIsPositioned(true);
        return;
      }

      // Scroll first, then measure, so the tooltip lands next to the target.
      revealInContainer(targetElement);

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
    };

    if (step.prepare) {
      step.prepare(document);
    }

    // Delay positioning to allow DOM to settle
    const timeout = setTimeout(positionTooltip, 150);

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
          <h3 className='sf-builder-tour__title'>{step.title}</h3>
          <p className='sf-builder-tour__text'>{step.content}</p>
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
