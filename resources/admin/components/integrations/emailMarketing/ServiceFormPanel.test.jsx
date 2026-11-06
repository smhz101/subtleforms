/**
 * The body of a service's section in Form settings > Integrations: list
 * select, mapping table, tags, consent picker, double opt-in and update
 * existing, for Mailchimp, Brevo and Kit. The API is mocked.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ServiceFormPanel from './ServiceFormPanel';
import { setMergeRow } from './MappingTable';
import { emailMarketingApi } from './api';

jest.mock('./emailMarketing.scss', () => ({}));
jest.mock('../settings/extensions/extensions.scss', () => ({}), { virtual: true });
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  emailMarketingApi: {
    lists: jest.fn(),
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
const LISTS = [
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
  emailMarketingApi.lists.mockResolvedValue(LISTS);
  emailMarketingApi.fields.mockResolvedValue(MERGE);
  const patch = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <ServiceFormPanel
        service='mailchimp'
        connected
        schema={SCHEMA}
        config={config}
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
});

test('audiences load into the select and the saved one is chosen', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  const audience = select('Audience');
  expect(optionsOf(audience)).toEqual(['Choose an audience', 'Newsletter (42)', 'Customers (7)']);
  expect(audience.value).toBe('abc123');
  expect(emailMarketingApi.fields).toHaveBeenCalledWith('mailchimp', 'abc123', false);
});

test('choosing an audience patches list_id', async () => {
  const patch = await mount({ enabled: true, list_id: '' });
  await choose(select('Audience'), 'def456');
  expect(patch).toHaveBeenCalledWith({ list_id: 'def456' });
});

test('Refresh asks the service again for the audiences and the fields', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  const refresh = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Refresh');
  await act(async () => refresh.click());
  expect(emailMarketingApi.lists).toHaveBeenLastCalledWith('mailchimp', true);
  expect(emailMarketingApi.fields).toHaveBeenLastCalledWith('mailchimp', 'abc123', true);
});

test('the mapping table lists Email, First name, Last name and every merge field of the audience', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  const rows = [...container.querySelectorAll('.sf-em-map__target')].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
  expect(rows).toEqual(['Email required', 'First name', 'Last name', 'Company COMPANY', 'Phone PHONE']);
});

test('the Email dropdown offers only email fields', async () => {
  await mount({ enabled: true, list_id: 'abc123' });
  expect(optionsOf(select('Form field for Email'))).toEqual(['First email field in the form', 'Email', 'Work email']);
});

test('mapping a merge field patches merge_fields and keeps the other rows', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123', merge_fields: [{ field: 'plain', target: 'PHONE' }] });
  await choose(select('Form field for Company'), 'company');
  expect(patch).toHaveBeenCalledWith({
    merge_fields: [
      { field: 'plain', target: 'PHONE' },
      { field: 'company', target: 'COMPANY' },
    ],
  });
});

test('picking the email field patches fields.email and keeps the other identity fields', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123', fields: { first_name: 'fname' } });
  await choose(select('Form field for Email'), 'work_email');
  expect(patch).toHaveBeenCalledWith({ fields: { first_name: 'fname', email: 'work_email' } });
});

test('a saved mapping for a field the audience no longer has stays visible and can be removed', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123', merge_fields: [{ field: 'plain', target: 'OLDTAG' }] });
  expect(container.textContent).toContain('OLDTAG');
  expect(container.textContent).toContain('not found');
  const remove = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove');
  await act(async () => remove.click());
  expect(patch).toHaveBeenCalledWith({ merge_fields: [] });
});

test('the consent picker lists only checkbox and consent fields', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123' });
  const consent = select('Only subscribe if this box is ticked');
  expect(optionsOf(consent)).toEqual(['Always (no consent box)', 'Send me news', 'I agree']);
  expect(container.textContent).toContain('Strongly recommended');
  await choose(consent, 'news');
  expect(patch).toHaveBeenCalledWith({ consent_field: 'news' });
});

test('double opt-in and update existing are switches; update existing is on by default', async () => {
  const patch = await mount({ enabled: true, list_id: 'abc123' });
  const toggles = Object.fromEntries(
    [...container.querySelectorAll('input[type="checkbox"]')].map((i) => [container.querySelector(`label[for="${i.id}"]`)?.textContent.trim(), i])
  );
  expect(toggles['Double opt-in'].checked).toBe(false);
  expect(toggles['Update existing contacts'].checked).toBe(true);
  await act(async () => toggles['Double opt-in'].click());
  expect(patch).toHaveBeenCalledWith({ double_optin: true });
  await act(async () => toggles['Update existing contacts'].click());
  expect(patch).toHaveBeenCalledWith({ update_existing: false });
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
  expect(patch).toHaveBeenCalledWith({ tags: 'website, news' });
});

describe('setMergeRow', () => {
  test('adds, changes and removes one row', () => {
    expect(setMergeRow([], 'PHONE', 'tel')).toEqual([{ field: 'tel', target: 'PHONE' }]);
    expect(setMergeRow([{ field: 'a', target: 'phone' }], 'PHONE', 'b')).toEqual([{ field: 'b', target: 'phone' }]);
    expect(setMergeRow([{ field: 'a', target: 'PHONE' }, { field: 'c', target: 'X' }], 'PHONE', '')).toEqual([{ field: 'c', target: 'X' }]);
  });
});

describe('setMergeRow for Kit keeps the key as typed', () => {
  test('adds a lowercase key without changing its case, and finds it again', () => {
    expect(setMergeRow([], 'phone_number', 'tel', false)).toEqual([{ field: 'tel', target: 'phone_number' }]);
    expect(setMergeRow([{ field: 'a', target: 'phone_number' }], 'phone_number', 'b', false)).toEqual([{ field: 'b', target: 'phone_number' }]);
    expect(setMergeRow([{ field: 'a', target: 'phone_number' }], 'phone_number', '', false)).toEqual([]);
  });
});

describe('Brevo', () => {
  const ATTRS = [{ tag: 'SMS', name: 'Sms', type: 'text', required: false }];
  const mountBrevo = async (config, connection = { settings: {} }) => {
    emailMarketingApi.lists.mockResolvedValue([{ id: '7', name: 'Leads', count: 3 }]);
    emailMarketingApi.fields.mockResolvedValue(ATTRS);
    const patch = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(<ServiceFormPanel service='brevo' connected connection={connection} schema={SCHEMA} config={config} patch={patch} fieldOptions={FIELD_OPTIONS} />)
    );
    return patch;
  };

  test('lists and attributes come from the account, with Brevo wording and no tags', async () => {
    await mountBrevo({ enabled: true, list_id: '7' });
    expect(emailMarketingApi.lists).toHaveBeenCalledWith('brevo', false);
    expect(emailMarketingApi.fields).toHaveBeenCalledWith('brevo', '7', false);
    expect(optionsOf(select('List'))).toEqual(['No list (only create the contact)', 'Leads (3)']);
    expect(container.textContent).toContain('Brevo attribute');
    expect(container.textContent).not.toContain('Tags');
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });

  test('double opt-in warns until the template and the redirect page are set', async () => {
    await mountBrevo({ enabled: true, list_id: '7', double_optin: true });
    expect(container.textContent).toContain('needs a confirmation template');
    expect(container.querySelector('a[href*="service=brevo"]')).not.toBeNull();
  });

  test('no warning once the template and the page are saved', async () => {
    await mountBrevo({ enabled: true, list_id: '7', double_optin: true }, { settings: { doi_template_id: 5, doi_redirect_url: 'https://example.com/thanks' } });
    expect(container.textContent).not.toContain('needs a confirmation template');
  });
});

describe('Kit', () => {
  const mountKit = async (config) => {
    emailMarketingApi.lists.mockResolvedValue([{ id: '311', name: 'Newsletter form', count: null }]);
    emailMarketingApi.fields.mockResolvedValue([{ tag: 'phone_number', name: 'Phone number', type: 'text', required: false }]);
    const patch = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(<ServiceFormPanel service='kit' connected connection={{ settings: {} }} schema={SCHEMA} config={config} patch={patch} fieldOptions={FIELD_OPTIONS} />)
    );
    return patch;
  };

  test('a Kit form is chosen, custom fields keep their key, and tags exist', async () => {
    const patch = await mountKit({ enabled: true, list_id: '311' });
    expect(optionsOf(select('Kit form'))).toEqual(['No form (only create the subscriber)', 'Newsletter form']);
    const rows = [...container.querySelectorAll('.sf-em-map__target')].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual(['Email required', 'First name', 'Last name', 'Phone number phone_number']);
    await choose(select('Form field for Phone number'), 'company');
    expect(patch).toHaveBeenCalledWith({ merge_fields: [{ field: 'company', target: 'phone_number' }] });
    expect(container.textContent).toContain('Tags');
  });

  test('double opt-in is a plain statement, not a switch', async () => {
    await mountKit({ enabled: true, list_id: '311' });
    expect(container.textContent).toContain('no double opt-in switch');
    const labels = [...container.querySelectorAll('input[type="checkbox"]')].map((i) => container.querySelector(`label[for="${i.id}"]`)?.textContent.trim());
    expect(labels).toEqual(['Update existing contacts']);
  });

  test('the last name row says where Kit keeps it', async () => {
    await mountKit({ enabled: true, list_id: '311' });
    expect(container.textContent).toContain('custom field last_name');
  });
});

describe('MailPoet', () => {
  const labelsOfSwitches = () => [...container.querySelectorAll('input[type="checkbox"]')].map((i) => container.querySelector(`label[for="${i.id}"]`)?.textContent.trim());

  const mountMailPoet = (config) => mount(config, { service: 'mailpoet' });

  test('lists come from MailPoet and the saved one is chosen', async () => {
    await mountMailPoet({ enabled: true, list_id: 'abc123' });
    expect(emailMarketingApi.lists).toHaveBeenCalledWith('mailpoet', false);
    expect(container.textContent).toContain('Newsletter');
  });

  test('the two MailPoet emails replace the double opt-in switch', async () => {
    await mountMailPoet({ enabled: true, list_id: 'abc123' });
    const labels = labelsOfSwitches();
    expect(labels).toContain("Send MailPoet's confirmation email");
    expect(labels).toContain('Send the welcome email for this list');
    expect(labels.some((l) => /double opt-in/i.test(l || ''))).toBe(false);
  });

  test('the confirmation email is on by default and the welcome email is off', async () => {
    await mountMailPoet({ enabled: true, list_id: 'abc123' });
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
    const byLabel = (text) => boxes.find((i) => container.querySelector(`label[for="${i.id}"]`)?.textContent.trim() === text);
    expect(byLabel("Send MailPoet's confirmation email").checked).toBe(true);
    expect(byLabel('Send the welcome email for this list').checked).toBe(false);
  });

  test('switching the welcome email on patches schedule_welcome_email', async () => {
    const patch = await mountMailPoet({ enabled: true, list_id: 'abc123' });
    const box = [...container.querySelectorAll('input[type="checkbox"]')].find(
      (i) => container.querySelector(`label[for="${i.id}"]`)?.textContent.trim() === 'Send the welcome email for this list'
    );
    await act(async () => box.click());
    expect(patch).toHaveBeenCalledWith({ schedule_welcome_email: true });
  });

  test('there is no tags field', async () => {
    await mountMailPoet({ enabled: true, list_id: 'abc123' });
    expect(container.textContent).not.toContain('Tags');
  });
});
