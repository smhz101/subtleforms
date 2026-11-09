/**
 * ConnectionSteps: an ordered list, a link button only for a safe https
 * address (new tab, noopener), a copy field for a step that has `code`, and the
 * extension object carries the component for add-ons.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ConnectionSteps, { isSafeHref } from './ConnectionSteps';
import { exposeConnectionSteps } from './connectionStepsExpose';
import { STEPS_FIXTURE } from './ConnectionSteps.fixture';

jest.mock('./ConnectionSteps.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function mount(node) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
}

afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  root = null;
  container = null;
});

describe('ConnectionSteps', () => {
  it('draws an ordered list with the intro, the note and one item per step', async () => {
    await mount(<ConnectionSteps {...STEPS_FIXTURE} />);
    expect(container.querySelector('ol.sf-steps__list')).not.toBeNull();
    expect(container.querySelectorAll('li.sf-steps__item')).toHaveLength(4);
    expect(container.querySelector('.sf-steps__title').textContent).toBe('Connect Example');
    expect(container.querySelector('.sf-steps__intro').textContent).toContain('two minutes');
    expect(container.querySelector('.sf-steps__note').textContent).toContain('never shown again');
    expect([...container.querySelectorAll('.sf-steps__num')].map((n) => n.textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('links a step to its page in a new tab, safely', async () => {
    await mount(<ConnectionSteps {...STEPS_FIXTURE} />);
    const links = container.querySelectorAll('a.sf-steps__link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://example.com/login');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[0].textContent).toContain('Open Example');
    expect(links[0].textContent).toContain('opens in a new tab');
  });

  it('defaults the link text', async () => {
    await mount(<ConnectionSteps steps={[{ text: 'Go', href: 'https://example.com/' }]} />);
    expect(container.querySelector('a.sf-steps__link').textContent).toContain('Open the page');
  });

  it('draws no link for an address that is not https', async () => {
    await mount(
      <ConnectionSteps
        steps={[
          { text: 'One', href: 'http://example.com/' },
          { text: 'Two', href: 'javascript:alert(1)' },
          { text: 'Three', href: '' },
        ]}
      />
    );
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(isSafeHref('https://example.com/x')).toBe(true);
    expect(isSafeHref('//example.com')).toBe(false);
    expect(isSafeHref(undefined)).toBe(false);
  });

  it('draws a copy field for a step with code and copies it', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    await mount(<ConnectionSteps {...STEPS_FIXTURE} />);
    expect(container.querySelector('.sf-steps__code code').textContent).toBe('https://example.com/wp-json/subtleforms/v1/hook');
    const button = container.querySelector('.sf-steps__code button');
    await act(async () => {
      button.click();
    });
    expect(writeText).toHaveBeenCalledWith('https://example.com/wp-json/subtleforms/v1/hook');
    expect(button.textContent).toBe('Copied');
  });

  it('skips empty steps and draws no heading without a title', async () => {
    await mount(<ConnectionSteps steps={[null, { text: '' }, { text: 'Real step' }]} />);
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('.sf-steps__title')).toBeNull();
  });

  it('is on the extension object for add-ons', () => {
    const target = {};
    exposeConnectionSteps(target);
    expect(target.ConnectionSteps).toBe(ConnectionSteps);
  });
});
