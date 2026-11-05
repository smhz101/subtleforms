/**
 * Form settings > Integrations > Email marketing: one section that lists the
 * services switched on in Settings. The API is mocked.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import EmailMarketingFormPanel from './EmailMarketingFormPanel';
import { emailMarketingApi } from './api';
import { registerSlotItem } from '../../../../shared/extend';

jest.mock('./emailMarketing.scss', () => ({}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  emailMarketingApi: {
    all: jest.fn(),
    lists: jest.fn(),
    fields: jest.fn(),
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const SCHEMA = { fields: [{ key: 'email', type: 'email', label: 'Email' }] };
const FIELD_OPTIONS = [{ label: 'Email', value: 'email' }];
const state = (enabled, extra = {}) => ({ enabled, status: 'connected', has_key: true, last4: 'abcd', settings: {}, ...extra });

let container;
let root;

async function mount(integrations, services = { mailchimp: state(true), brevo: state(false), kit: state(true) }) {
  window.subtleformsAdmin = { extensions: { email_marketing: { builtin: true } }, emailMarketing: { services: {}, extras: [], banner: { show: false } } };
  emailMarketingApi.all.mockResolvedValue({ services });
  emailMarketingApi.lists.mockResolvedValue([]);
  emailMarketingApi.fields.mockResolvedValue([]);
  const patch = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(<EmailMarketingFormPanel schema={SCHEMA} integrations={integrations} patch={patch} fieldOptions={FIELD_OPTIONS} />)
  );
  return patch;
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
  delete window.subtleformsAdmin;
  delete window.__subtleformsExtend.slots['email_marketing.service.form'];
});

const sections = () => [...container.querySelectorAll('.sf-em-form__service')].map((n) => n.getAttribute('data-service'));

test('only the services switched on in Settings appear, under one Email marketing heading', async () => {
  await mount({});
  expect(container.querySelectorAll('h4')).toHaveLength(1);
  expect(container.querySelector('h4').textContent).toBe('Email marketing');
  expect(sections()).toEqual(['mailchimp', 'kit']);
  expect(container.textContent).not.toContain('Brevo');
});

test('a service that is off in Settings keeps its saved form settings and stays out of sight', async () => {
  await mount({ brevo: { enabled: true, list_id: '7' } });
  expect(sections()).not.toContain('brevo');
  expect(emailMarketingApi.lists).not.toHaveBeenCalledWith('brevo', expect.anything());
});

test('with no service on, a hint links to Settings > Integrations > Email marketing', async () => {
  await mount({}, { mailchimp: state(false), brevo: state(false), kit: state(false) });
  expect(sections()).toEqual([]);
  expect(container.textContent).toContain('No email marketing service is switched on');
  expect(container.querySelector('a').getAttribute('href')).toContain('ext=email_marketing');
});

test('each service has its own switch for the form', async () => {
  const patch = await mount({ mailchimp: { enabled: false } });
  const mailchimp = container.querySelector('[data-service="mailchimp"]');
  expect(mailchimp.querySelector('select')).toBeNull();
  await act(async () => mailchimp.querySelector('input[type="checkbox"]').click());
  expect(patch).toHaveBeenCalledWith('mailchimp', { enabled: true });
});

test('a service switched on for the form shows its settings; the other stays collapsed', async () => {
  await mount({ kit: { enabled: true, list_id: '' } });
  expect(container.querySelector('[data-service="kit"] select')).not.toBeNull();
  expect(container.querySelector('[data-service="mailchimp"] select')).toBeNull();
  expect(emailMarketingApi.lists).toHaveBeenCalledWith('kit', false);
});

test('an enabled service that is not connected says so and links to its settings', async () => {
  await mount({ mailchimp: { enabled: true } }, { mailchimp: state(true, { status: 'none', has_key: false }), brevo: state(false), kit: state(false) });
  expect(container.textContent).toContain('Mailchimp is not connected yet');
  expect(container.querySelector('a[href*="service=mailchimp"]')).not.toBeNull();
  expect(emailMarketingApi.lists).not.toHaveBeenCalled();
});

test('an add-on draws its options in the email_marketing.service.form slot, told the service and whether it is connected', async () => {
  registerSlotItem('email_marketing.service.form', 'extra', {
    component: (props) => <p data-testid={`extra-${props.service}`}>{`connected ${props.connected}`}</p>,
  });
  await mount({ mailchimp: { enabled: true }, kit: { enabled: true } }, { mailchimp: state(true), brevo: state(false), kit: state(true, { has_key: false, status: 'none' }) });
  expect(container.querySelector('[data-testid="extra-mailchimp"]').textContent).toBe('connected true');
  expect(container.querySelector('[data-testid="extra-kit"]').textContent).toBe('connected false');
});
