/**
 * Arbitrary customCss in stored schema must never render (WordPress.org Package A).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('legacy customCss is not rendered', () => {
  it('does not print a style tag for appearance.customCss', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const hostile = '.subtleforms-button{color:red} body{display:none}';
    const schema = {
      metadata: { appearance: { preset: 'theme', tokens: { labelSize: '14px' }, customCss: hostile } },
      fields: [{ id: 'a', key: 'name', type: 'text', label: 'Name' }],
    };
    await act(async () => {
      root.render(<FormRenderer preloadedSchema={schema} formId={9} blockOptions={{ theme: 'minimal' }} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const css = Array.from(container.querySelectorAll('style')).map((s) => s.textContent).join('');
    expect(css).not.toContain('color:red');
    expect(css).not.toContain('display:none');
    expect(css).not.toContain(hostile);
    expect(container.querySelector('.subtleforms-form-9')).not.toBeNull();
    // Structured appearance still applies as CSS variables on the root.
    const rootEl = container.querySelector('.subtleforms-form-9');
    expect(rootEl.style.getPropertyValue('--subtleforms-label-size') || rootEl.getAttribute('style') || '').toMatch(/label-size|14px|--subtleforms/);
    act(() => root.unmount());
  });
});
