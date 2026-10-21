/**
 * "Data to send" of a webhook (2.5.0): ticks, the live example, the JSON
 * view and the way back.
 */
import { createRoot, useState } from '@wordpress/element';
import { act } from 'react';
import PayloadPicker, { currentSelection, payloadMode } from './PayloadPicker';
import { collectPayloadFields, defaultSelection } from './webhookModel';

global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

const fields = collectPayloadFields([
  { type: 'text', key: 'name', label: 'Name' },
  { type: 'email', key: 'email', label: 'Email' },
  { type: 'password', key: 'pass', label: 'Password' },
]);

let latest;
function Host({ initial }) {
  const [settings, setSettings] = useState(initial);
  latest = settings;
  return (
    <PayloadPicker
      settings={settings}
      fields={fields}
      hasPayment={false}
      formId={5}
      formTitle='Contact'
      siteUrl='https://example.com'
      patch={(p) => setSettings((s) => ({ ...s, ...p }))}
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

const button = (c, text) => [...c.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const box = (c, label) => [...c.querySelectorAll('input[type="checkbox"]')].find((i) => i.closest('.components-base-control')?.textContent.includes(label));
const preview = (c) => c.querySelector('.sf-webhook-preview__code').textContent;

function setText(el, value) {
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('PayloadPicker', () => {
  test('ticking a box saves a selection and updates the example', () => {
    const { container, unmount } = mount({ payload_mode: 'selected', payload_selection: defaultSelection(fields) });
    expect(preview(container)).toContain('"email": "name@example.com"');
    act(() => box(container, 'Email').click());
    expect(latest.payload_mode).toBe('selected');
    expect(latest.payload_selection).not.toContain('field:email');
    expect(preview(container)).not.toContain('name@example.com');
    act(() => box(container, 'IP address').click());
    expect(latest.payload_selection).toContain('ip_address');
    expect(preview(container)).toContain('"ip_address": "203.0.113.10"');
    expect(box(container, 'Password')).toBeUndefined();
    unmount();
  });

  test('Select none and Select all change every answer', () => {
    const { container, unmount } = mount({ payload_mode: 'selected', payload_selection: defaultSelection(fields) });
    act(() => button(container, 'Select none').click());
    expect(latest.payload_selection.filter((k) => k.startsWith('field:'))).toEqual([]);
    act(() => button(container, 'Select all').click());
    expect(latest.payload_selection.filter((k) => k.startsWith('field:'))).toEqual(['field:name', 'field:email']);
    unmount();
  });

  test('a standard (full) webhook is shown as it is and moves to a selection only when a box is changed', () => {
    const { container, unmount } = mount({ payload_mode: 'full' });
    expect(payloadMode(latest)).toBe('full');
    expect(preview(container)).toContain('"site_url"');
    // Looking at the JSON and coming back changes nothing.
    act(() => button(container, 'View as JSON').click());
    act(() => button(container, 'Back to checkboxes').click());
    expect(latest.payload_mode).toBe('full');
    act(() => box(container, 'Email').click());
    expect(latest.payload_mode).toBe('selected');
    expect(preview(container)).not.toContain('"site_url"');
    unmount();
  });

  test('JSON view edits become a custom body, and a matching body goes back to boxes', () => {
    const { container, unmount } = mount({ payload_mode: 'selected', payload_selection: ['form_id', 'field:name'] });
    act(() => button(container, 'View as JSON').click());
    const area = container.querySelector('textarea');
    expect(JSON.parse(area.value)).toEqual({ event: 'submission.created', form_id: '{{entry:form_id}}', fields: { name: '{{field:name}}' } });

    // Add a field through the JSON: still what the boxes can show.
    setText(area, '{"event":"submission.created","form_id":"{{entry:form_id}}","fields":{"name":"{{field:name}}","email":"{{field:email}}"}}');
    expect(latest.payload_mode).toBe('custom');
    act(() => button(container, 'Back to checkboxes').click());
    expect(latest.payload_mode).toBe('selected');
    expect(latest.payload_selection).toEqual(['form_id', 'field:name', 'field:email']);
    unmount();
  });

  test('a body the boxes cannot show stays custom with a clear note, and is kept', () => {
    const { container, unmount } = mount({ payload_mode: 'custom', custom_payload: '{"who":"{{name}}"}' });
    expect(container.textContent).toContain('Custom JSON.');
    expect(container.textContent).toContain('The checkboxes are off');
    expect(button(container, 'Back to checkboxes').disabled).toBe(true);
    expect(preview(container)).toContain('"who": "Example text"');
    expect(latest.custom_payload).toBe('{"who":"{{name}}"}');

    // Text that is not valid JSON yet is kept on screen and not saved.
    setText(container.querySelector('textarea'), '{"who": ');
    expect(container.querySelector('textarea').value).toBe('{"who": ');
    expect(container.textContent).toContain('not valid JSON yet');
    expect(latest.custom_payload).toBe('{"who":"{{name}}"}');

    act(() => button(container, 'Start over with checkboxes').click());
    expect(latest.payload_mode).toBe('selected');
    unmount();
  });

  test('current selection reads every stored mode', () => {
    expect(currentSelection({ payload_mode: 'selected', payload_selection: ['form_id', 'field:gone'] }, fields, false)).toEqual(['form_id']);
    expect(currentSelection({ payload_mode: 'custom', custom_payload: '{"a":1}' }, fields, false)).toEqual([]);
    expect(currentSelection({}, fields, false)).toContain('field:name');
  });
});
