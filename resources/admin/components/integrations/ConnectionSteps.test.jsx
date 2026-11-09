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

beforeEach(() => {
  window.localStorage.clear();
});

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
    await mount(<ConnectionSteps collapsible={false} steps={[null, { text: '' }, { text: 'Real step' }]} />);
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('.sf-steps__title')).toBeNull();
  });

  it('is on the extension object for add-ons', () => {
    const target = {};
    exposeConnectionSteps(target);
    expect(target.ConnectionSteps).toBe(ConnectionSteps);
  });

  describe('accordion', () => {
    const toggleOf = () => container.querySelector('button.sf-steps__toggle');
    const panelOf = () => container.querySelector('.sf-steps__panel');

    it('is open by default and has the default title', async () => {
      await mount(<ConnectionSteps steps={[{ text: 'Go' }]} />);
      expect(toggleOf().textContent).toBe('How to connect');
      expect(toggleOf().getAttribute('aria-expanded')).toBe('true');
      expect(panelOf().hasAttribute('hidden')).toBe(false);
      expect(toggleOf().getAttribute('aria-controls')).toBe(panelOf().id);
    });

    it('starts closed with defaultOpen false and opens on click', async () => {
      await mount(<ConnectionSteps id='sf-steps-x' title='How to connect X' defaultOpen={false} steps={[{ text: 'Go' }]} />);
      expect(toggleOf().getAttribute('aria-expanded')).toBe('false');
      expect(panelOf().hasAttribute('hidden')).toBe(true);
      await act(async () => toggleOf().click());
      expect(toggleOf().getAttribute('aria-expanded')).toBe('true');
      expect(panelOf().hasAttribute('hidden')).toBe(false);
      await act(async () => toggleOf().click());
      expect(toggleOf().getAttribute('aria-expanded')).toBe('false');
    });

    it('remembers the choice under the storage key', async () => {
      await mount(<ConnectionSteps id='sf-steps-y' storageKey='sf-steps-custom' steps={[{ text: 'Go' }]} />);
      await act(async () => toggleOf().click());
      expect(window.localStorage.getItem('sf-steps-custom')).toBe('0');
      act(() => root.unmount());
      container.remove();
      await mount(<ConnectionSteps id='sf-steps-y' storageKey='sf-steps-custom' steps={[{ text: 'Go' }]} />);
      expect(toggleOf().getAttribute('aria-expanded')).toBe('false');
    });

    it('uses the id as the storage key and lets a saved choice beat the default', async () => {
      window.localStorage.setItem('sf-steps-hubspot', '1');
      await mount(<ConnectionSteps id='sf-steps-hubspot' defaultOpen={false} steps={[{ text: 'Go' }]} />);
      expect(toggleOf().getAttribute('aria-expanded')).toBe('true');
    });

    it('still works when storage throws', async () => {
      const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      await mount(<ConnectionSteps defaultOpen={false} steps={[{ text: 'Go' }]} />);
      expect(toggleOf().getAttribute('aria-expanded')).toBe('false');
      await act(async () => toggleOf().click());
      expect(toggleOf().getAttribute('aria-expanded')).toBe('true');
      get.mockRestore();
      set.mockRestore();
    });

    it('draws a plain section when not collapsible', async () => {
      await mount(<ConnectionSteps collapsible={false} title='Plain' steps={[{ text: 'Go' }]} />);
      expect(toggleOf()).toBeNull();
      expect(container.querySelector('h4.sf-steps__title').textContent).toBe('Plain');
    });
  });
});
