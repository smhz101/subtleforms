/**
 * LiveRegion Stories
 */
import { useState } from '@wordpress/element';
import LiveRegion from '../ui/feedback/LiveRegion';

export default {
  title: 'Components/LiveRegion',
  component: LiveRegion,
  tags: ['autodocs'],
};

export const Polite = {
  args: {
    message: 'Form saved successfully.',
    level: 'polite',
    clearAfter: 5000,
  },
};

export const Assertive = {
  args: {
    message: 'Error: Please fix 3 fields before submitting.',
    level: 'assertive',
    clearAfter: 0,
  },
};

export const Visible = {
  args: {
    message: 'This message is visible on screen, not just for screen readers.',
    level: 'polite',
    visible: true,
    clearAfter: 0,
  },
};

export const Interactive = () => {
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(0);
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LiveRegion message={message} level="polite" clearAfter={3000} />
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Click the button to trigger a live region announcement.
        Use a screen reader to hear it.
      </p>
      <button
        type="button"
        onClick={() => {
          setCount((n) => n + 1);
          setMessage(`Action performed (${count + 1} times)`);
        }}
        style={{ padding: '6px 16px', width: 'fit-content' }}
      >
        Trigger announcement
      </button>
    </div>
  );
};
