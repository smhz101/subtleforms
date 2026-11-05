/**
 * Form settings > Integrations > Mailchimp: audience select, mapping table,
 * consent picker and the hand-over. The API is mocked.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import MailchimpFormPanel from './MailchimpFormPanel';
import { setMergeRow } from './MappingTable';
import { mailchimpApi } from './api';
import { registerSlotItem } from '../../../../shared/extend';

jest.mock('./mailchimp.scss', () => ({}));
jest.mock('../settings/extensions/extensions.scss', () => ({}), { virtual: true });
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  mailchimpApi: {
    state: jest.fn(),
    audiences: jest.fn(),
    fields: jest.fn(),
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const SCHEMA = {
  fields: [
    { key: 'fname', type: 'text', label: 'First name' },
    { key: 'email', type: 'email', label: 'Email' },
    { key: 'work_email', type: 'email', label: 'Work email' },
    { key: 'company', type: 'text', label: 'Company' },
    { key: 'news', type: 'checkbox', label: 'Send me news' },
    { key: 'terms', type: 'consent', label: 'I agree' },
    { key: 'plain', type: 'textarea', label: 'Message' },
  ],
};
const FIELD_OPTIONS = SCHEMA.fields.map((f) => ({ label: f.label, value: f.key }));
const AUDIENCES = [
  { id: 'abc123', name: 'Newsletter', count: 42 },
  { id: 'def456', name: 'Customers', count: 7 },
];
const MERGE = [
  { tag: 'COMPANY', name: 'Company', type: 'text', required: false },
  { tag: 'PHONE', name: 'Phone', type: 'phone', required: false },
];

let container;
let root;

async function mount(config, props = {}) {
  window.subtleformsAdmin = { extensions: { mailchimp: { builtin: true } } };
  mailchimpApi.state.mockResolvedValue({ status: 'connected', has_key: true, last4: 'us21' });
  mailchimpApi.audiences.mockResolvedValue(AUDIENCES);
  mailchimpApi.fields.mockResolvedValue(MERGE);
  const patch = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MailchimpFormPanel
        schema={SCHEMA}
        integrations={{ mailchimp: config }}
        patch={patch}
        fieldOptions={FIELD_OPTIONS}
        {...props}
      />
    )
  );
  return patch;
}

const select = (label) => [...container.querySelectorAll('select')].find((s) => s.getAttribute('aria-label') === label || container.querySelector(`label[for="${s.id}"]`)?.textContent.trim() === label);
const optionsOf = (el) => [...el.options].map((o) => o.textContent);
const choose = async (el, value) =>
  act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
  delete window.subtleformsAdmin;
  delete window.__subtleformsExtend.slots['form.integration.mailchimp'];
});

test('off: only the switch is shown and nothing is loaded', async () => {
  await mount({ enabled: false });
  expect(container.textContent).toContain('Add people who submit this form to Mailchimp');
  expect(container.querySelector('select')).toBeNull();
  expect(mailchimpApi.audiences).not.toHaveBeenCalled();
});

test('turning it on patches the form settings', async () => {
  const patch = await mount({ enabled: false });
  await act(async () => container.querySelector('input[type="checkbox"]').click());
  expect(patch).toHaveBeenCalledWith('mailchimp', { enabled: true });
});

test('on: audiences load into the select and the saved one is chosen', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  const audience = select('Audience');
  expect(optionsOf(audience)).toEqual(['Choose an audience', 'Newsletter (42)', 'Customers (7)']);
  expect(audience.value).toBe('abc123');
  expect(mailchimpApi.fields).toHaveBeenCalledWith('abc123', false);
});

test('choosing an audience patches list_id', async () => {
  const patch = await mount({ enabled: true, list_id: '' });
  await choose(select('Audience'), 'def456');
  expect(patch).toHaveBeenCalledWith('mailchimp', { list_id: 'def456' });
});

test('Refresh asks Mailchimp again for the audiences and the fields', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  const refresh = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Refresh');
  await act(async () => refresh.click());
  expect(mailchimpApi.audiences).toHaveBeenLastCalledWith(true);
  expect(mailchimpApi.fields).toHaveBeenLastCalledWith('abc123', true);
});

test('the mapping table lists Email, First name, Last name and every merge field of the audience', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  const rows = [...container.querySelectorAll('.sf-mc-map__target')].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
  expect(rows).toEqual(['Email required', 'First name', 'Last name', 'Company COMPANY', 'Phone PHONE']);
});

test('the Email dropdown offers only email fields', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  expect(optionsOf(select('Form field for Email'))).toEqual(['First email field in the form', 'Email', 'Work email']);
});

test('mapping a merge field patches merge_fields and keeps the other rows', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123', merge_fields: [{ field: 'plain', target: 'PHONE' }] });
  await choose(select('Form field for Company'), 'company');
  expect(patch).toHaveBeenCalledWith('mailchimp', {
    merge_fields: [
      { field: 'plain', target: 'PHONE' },
      { field: 'company', target: 'COMPANY' },
    ],
  });
});

test('picking the email field patches fields.email and keeps the other identity fields', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123', fields: { first_name: 'fname' } });
  await choose(select('Form field for Email'), 'work_email');
  expect(patch).toHaveBeenCalledWith('mailchimp', { fields: { first_name: 'fname', email: 'work_email' } });
});

test('a saved mapping for a field the audience no longer has stays visible and can be removed', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123', merge_fields: [{ field: 'plain', target: 'OLDTAG' }] });
  expect(container.textContent).toContain('OLDTAG');
  expect(container.textContent).toContain('not in this audience');
  const remove = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove');
  await act(async () => remove.click());
  expect(patch).toHaveBeenCalledWith('mailchimp', { merge_fields: [] });
});

test('the consent picker lists only checkbox and consent fields', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123' });
  const consent = select('Only subscribe if this box is ticked');
  expect(optionsOf(consent)).toEqual(['Always (no consent box)', 'Send me news', 'I agree']);
  expect(container.textContent).toContain('Strongly recommended');
  await choose(consent, 'news');
  expect(patch).toHaveBeenCalledWith('mailchimp', { consent_field: 'news' });
});

test('double opt-in and update existing are switches; update existing is on by default', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123' });
  const toggles = Object.fromEntries(
    [...container.querySelectorAll('input[type="checkbox"]')].map((i) => [container.querySelector(`label[for="${i.id}"]`)?.textContent.trim(), i])
  );
  expect(toggles['Double opt-in'].checked).toBe(false);
  expect(toggles['Update existing contacts'].checked).toBe(true);
  await act(async () => toggles['Double opt-in'].click());
  expect(patch).toHaveBeenCalledWith('mailchimp', { double_optin: true });
  await act(async () => toggles['Update existing contacts'].click());
  expect(patch).toHaveBeenCalledWith('mailchimp', { update_existing: false });
});

test('tags are a comma separated text field', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123', tags: 'website' });
  const tags = container.querySelector('input[type="text"]');
  expect(tags.value).toBe('website');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(tags, 'website, news');
    tags.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(patch).toHaveBeenCalledWith('mailchimp', { tags: 'website, news' });
});

test('not connected: a note links to the settings and no audiences are requested', async () => {
  window.subtleformsAdmin = { extensions: { mailchimp: { builtin: true } } };
  mailchimpApi.state.mockResolvedValue({ status: 'none', has_key: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(<MailchimpFormPanel schema={SCHEMA} integrations={{ mailchimp: { enabled: true } }} patch={jest.fn()} fieldOptions={FIELD_OPTIONS} />)
  );
  expect(container.textContent).toContain('Mailchimp is not connected yet');
  expect(container.querySelector('a').getAttribute('href')).toContain('ext=mailchimp');
  expect(mailchimpApi.audiences).not.toHaveBeenCalled();
});

test('an add-on draws more controls in the form.integration.mailchimp slot', async () => {
  registerSlotItem('form.integration.mailchimp', 'extra', {
    component: (props) => <p data-testid='extra'>{`audience ${props.audienceId}; fields ${props.mergeFields.map((f) => f.tag).join(',')}`}</p>,
  });
  await mount({ enabled: true, list_id: 'abc123' });
  expect(container.querySelector('[data-testid="extra"]').textContent).toBe('audience abc123; fields COMPANY,PHONE');
});

test('an add-on that lists its own Mailchimp takes the panel over', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  act(() => root.unmount());
  container.remove();
  window.subtleformsAdmin = { extensions: { mailchimp: { slug: 'mailchimp' } } };
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () =>
    root.render(<MailchimpFormPanel schema={SCHEMA} integrations={{ mailchimp: { enabled: true } }} patch={jest.fn()} fieldOptions={FIELD_OPTIONS} />)
  );
  expect(container.innerHTML).toBe('');
});

describe('setMergeRow', () => {
  test('adds, changes and removes one row', () => {
    expect(setMergeRow([], 'PHONE', 'tel')).toEqual([{ field: 'tel', target: 'PHONE' }]);
    expect(setMergeRow([{ field: 'a', target: 'phone' }], 'PHONE', 'b')).toEqual([{ field: 'b', target: 'phone' }]);
    expect(setMergeRow([{ field: 'a', target: 'PHONE' }, { field: 'c', target: 'X' }], 'PHONE', '')).toEqual([{ field: 'c', target: 'X' }]);
  });
});
