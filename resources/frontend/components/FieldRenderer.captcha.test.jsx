/**
 * #142: a CAPTCHA with no widget draws nothing for visitors. Only a site
 * admin gets the setup message, and it arrives in the field's config.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const field = (config) => ({ id: 'cap', key: 'cap', type: 'recaptcha', config });

describe('CAPTCHA field with no widget', () => {
  test.each(['recaptcha', 'hcaptcha', 'turnstile'])('%s with no HTML and no warning renders nothing', (type) => {
    const { container, unmount } = mount(
      <FieldRenderer field={{ ...field({ captchaHtml: '', captchaWarning: '', captchaReady: false }), type }} values={{}} onChange={() => {}} errors={{}} />
    );
    expect(container.innerHTML).toBe('');
    expect(container.querySelector('p')).toBeNull();
    unmount();
  });

  test('a warning renders the paragraph', () => {
    const { container, unmount } = mount(
      <FieldRenderer
        field={field({ captchaHtml: '', captchaWarning: 'Only site admins see this message.', captchaReady: false })}
        values={{}}
        onChange={() => {}}
        errors={{}}
      />
    );
    const note = container.querySelector('p.subtleforms-captcha-warning');
    expect(note).not.toBeNull();
    expect(note.textContent).toBe('Only site admins see this message.');
    unmount();
  });

  test('a widget still renders', () => {
    const { container, unmount } = mount(
      <FieldRenderer
        field={field({ captchaHtml: '<div class="g-recaptcha" data-sitekey="k"></div>', captchaWarning: '', captchaReady: true })}
        values={{}}
        onChange={() => {}}
        errors={{}}
      />
    );
    expect(container.querySelector('.g-recaptcha')).not.toBeNull();
    unmount();
  });
});
