/**
 * Required-fields legend on the public form.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('required fields legend', () => {
  it('renders when a required field exists', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const schema = {
      metadata: {},
      fields: [{ id: 'a', key: 'name', type: 'text', label: 'Name', required: true }],
    };
    await act(async () => {
      root.render(<FormRenderer preloadedSchema={schema} formId={21} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(container.querySelector('.subtleforms-required-legend')).not.toBeNull();
    expect(container.textContent).toContain('indicates required fields');
    act(() => root.unmount());
  });

  it('is absent when no field is required', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const schema = {
      metadata: {},
      fields: [{ id: 'a', key: 'name', type: 'text', label: 'Name' }],
    };
    await act(async () => {
      root.render(<FormRenderer preloadedSchema={schema} formId={22} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(container.querySelector('.subtleforms-required-legend')).toBeNull();
    act(() => root.unmount());
  });
});
