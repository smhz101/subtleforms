/**
 * Conversational forms move focus to the new question (#139).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ConversationalFormRenderer from './ConversationalFormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

const schema = {
  metadata: {},
  fields: [
    { id: 'a', key: 'first', type: 'text', label: 'First' },
    { id: 'b', key: 'second', type: 'text', label: 'Second' },
  ],
};

async function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ConversationalFormRenderer schema={schema} formId={1} />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  return { container, root };
}

const press = async (key) => {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

const click = async (el) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('conversational focus', () => {
  it('does not move focus on first render', async () => {
    const { container, root } = await mount();
    expect(container.contains(document.activeElement)).toBe(false);
    act(() => root.unmount());
    container.remove();
  });

  it('Enter moves focus to question 2, Back returns to question 1', async () => {
    const { container, root } = await mount();
    await press('Enter');
    const second = container.querySelector('.subtleforms-field-wrapper input');
    expect(second.name || second.id).toContain('second');
    expect(document.activeElement).toBe(second);
    await click(container.querySelector('.subtleforms-button-prev'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const first = container.querySelector('.subtleforms-field-wrapper input');
    expect(first.name || first.id).toContain('first');
    expect(document.activeElement).toBe(first);
    act(() => root.unmount());
    container.remove();
  });

  it('going to review focuses the review heading', async () => {
    const { container, root } = await mount();
    await press('Enter');
    await press('Enter');
    const heading = container.querySelector('.subtleforms-review-title');
    expect(heading).not.toBeNull();
    expect(document.activeElement).toBe(heading);
    act(() => root.unmount());
    container.remove();
  });
});
