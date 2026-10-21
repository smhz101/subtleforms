/**
 * Custom headers rows (2.5.0). The old field showed the saved headers as
 * JSON and dropped text that was not valid JSON yet, so every keystroke put
 * the previous text back and nothing could be typed.
 */
import { createRoot, useState } from '@wordpress/element';
import { act } from 'react';
import HeadersEditor from './HeadersEditor';

global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

const saves = [];

function Host({ initial = {} }) {
  const [headers, setHeaders] = useState(initial);
  return (
    <HeadersEditor
      value={headers}
      onChange={(next) => {
        saves.push(next);
        setHeaders(next);
      }}
    />
  );
}

function mount(initial) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Host initial={initial} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

function setValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Type one character at a time, as a person does. */
function typeText(el, text) {
  let typed = '';
  for (const ch of text) {
    typed += ch;
    setValue(el, typed);
  }
}

const button = (container, text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const inputs = (container, label) => [...container.querySelectorAll(`input[placeholder="${label}"]`)];

describe('HeadersEditor', () => {
  beforeEach(() => {
    saves.length = 0;
  });

  test('typing a header name and value works one character at a time and saves the finished row', () => {
    const { container, unmount } = mount({});
    act(() => button(container, 'Add header').click());
    const [name] = inputs(container, 'Header name');
    const [value] = inputs(container, 'Value');

    typeText(name, 'X-Api-Key');
    expect(inputs(container, 'Header name')[0].value).toBe('X-Api-Key');
    typeText(value, 'abc 123');
    expect(inputs(container, 'Value')[0].value).toBe('abc 123');
    expect(saves[saves.length - 1]).toEqual({ 'X-Api-Key': 'abc 123' });
    unmount();
  });

  test('a half-typed or refused row stays on screen and is not saved', () => {
    const { container, unmount } = mount({ 'X-Keep': '1' });
    act(() => button(container, 'Add header').click());
    const name = inputs(container, 'Header name')[1];

    typeText(name, 'Host');
    expect(inputs(container, 'Header name')[1].value).toBe('Host');
    expect(container.textContent).toContain('SubtleForms sets this header itself');
    expect(saves.every((s) => !('Host' in s))).toBe(true);

    setValue(inputs(container, 'Header name')[1], 'Bad Name');
    expect(container.textContent).toContain('A header name can use letters');
    unmount();
  });

  test('a header value with a line break, pasted as JSON, is refused and says why', () => {
    const { container, unmount } = mount({ 'X-A': 'one' });
    act(() => button(container, 'View as JSON').click());
    setValue(container.querySelector('textarea'), '{"X-A": "one\\ntwo"}');
    expect(container.textContent).toContain('X-A: A header value must be on one line.');
    // The refused header is not saved.
    expect(saves[saves.length - 1]).toEqual({});
    unmount();
  });

  test('rows can be removed', () => {
    const { container, unmount } = mount({ 'X-A': '1', 'X-B': '2' });
    act(() => container.querySelector('button[aria-label="Remove header X-A"]').click());
    expect(saves[saves.length - 1]).toEqual({ 'X-B': '2' });
    unmount();
  });

  test('the JSON view shows the rows, keeps invalid text and never saves it', () => {
    const { container, unmount } = mount({ 'X-A': '1' });
    act(() => button(container, 'View as JSON').click());
    const area = container.querySelector('textarea');
    expect(JSON.parse(area.value)).toEqual({ 'X-A': '1' });

    typeText(area, '{"X-A": "1", ');
    expect(container.querySelector('textarea').value).toBe('{"X-A": "1", ');
    expect(container.textContent).toContain('This is not valid JSON yet');
    expect(button(container, 'Back to rows').disabled).toBe(true);
    expect(saves.length).toBe(0);

    setValue(container.querySelector('textarea'), '{"X-A": "1", "X-B": "2"}');
    expect(saves[saves.length - 1]).toEqual({ 'X-A': '1', 'X-B': '2' });
    act(() => button(container, 'Back to rows').click());
    expect(inputs(container, 'Header name').map((i) => i.value)).toEqual(['X-A', 'X-B']);
    unmount();
  });
});
