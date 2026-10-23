/**
 * A form's own CSS stays when a block picks a theme (2.7.2).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('custom CSS under a block theme', () => {
  it('is still printed when the block chooses a theme', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const schema = {
      metadata: { appearance: { preset: 'theme', tokens: {}, customCss: '.subtleforms-button{color:red}' } },
      fields: [{ id: 'a', key: 'name', type: 'text', label: 'Name' }],
    };
    await act(async () => {
      root.render(<FormRenderer preloadedSchema={schema} formId={9} blockOptions={{ theme: 'minimal' }} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const css = Array.from(container.querySelectorAll('style')).map((s) => s.textContent).join('');
    expect(css).toContain('.subtleforms-form-9 .subtleforms-button{color:red}');
    act(() => root.unmount());
  });
});
