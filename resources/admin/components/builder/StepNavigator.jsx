import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

export default function StepNavigator({
  steps,
  onSelectStep,
  onAddStep,
  onDeleteStep,
}) {
  if (!steps || steps.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: '#f9f9f9',
          borderBottom: '1px solid #dcdcde',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}>
        <Button isSecondary onClick={onAddStep} style={{ padding: '6px 12px' }}>
          {__('Add First Step', 'subtleforms')}
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#f9f9f9',
        borderBottom: '1px solid #dcdcde',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        overflowX: 'auto',
        flexWrap: 'nowrap',
      }}>
      {steps.map((step, index) => (
        <div
          key={step.id}
          style={{
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            flexShrink: 0,
          }}>
          <button
            type='button'
            onClick={() => onSelectStep(step.id)}
            style={{
              padding: '6px 12px',
              background: step.selected ? '#2271b1' : '#fff',
              color: step.selected ? '#fff' : '#1e1e1e',
              border: '1px solid #dcdcde',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!step.selected) {
                e.currentTarget.style.background = '#f0f0f1';
              }
            }}
            onMouseLeave={(e) => {
              if (!step.selected) {
                e.currentTarget.style.background = '#fff';
              }
            }}>
            {sprintf(__('Step %d', 'subtleforms'), index + 1)}:{' '}
            {step.title || __('Untitled', 'subtleforms')}
          </button>
          {steps.length > 1 && (
            <button
              type='button'
              onClick={() => onDeleteStep(step.id)}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#d63638',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
              }}
              title={__('Delete step', 'subtleforms')}>
              ×
            </button>
          )}
        </div>
      ))}
      <Button
        isSecondary
        onClick={onAddStep}
        style={{ padding: '6px 12px', marginLeft: '8px' }}>
        + {__('Add Step', 'subtleforms')}
      </Button>
    </div>
  );
}
