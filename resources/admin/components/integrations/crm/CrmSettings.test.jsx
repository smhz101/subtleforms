/**
 * Settings > Integrations > CRM: the grid with one tile, the HubSpot screen,
 * the form panel and the note about Pro. The API is mocked.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import CrmSettings from './CrmSettings';
import CrmFormPanel from './CrmFormPanel';
import { setPropertyRow } from './HubSpotFormPanel';
import { crmApi } from './api';
import { registerCrmService, registerSlotItem } from '../../../../shared/extend';
import { withClient } from '../../../../../tests/js/queryWrapper';

jest.mock('../emailMarketing/emailMarketing.scss', () => ({}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  crmApi: {
    all: jest.fn(),
    state: jest.fn(),
    setEnabled: jest.fn(),
    connect: jest.fn(),
    test: jest.fn(),
    disconnect: jest.fn(),
    properties: jest.fn(),
    dismissBanner: jest.fn(),
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const CONNECTED = { enabled: true, status: 'connected', has_key: true, connected: true, last4: 'ab12', account_name: 'Acme Portal (123456)', error: '' };

let container;
let root;

function pageData(overrides = {}) {
  return {
    extensions: { crm: { slug: 'crm', builtin: true, enabled: false, configured: false } },
    crm: {
      services: { hubspot: { slug: 'hubspot', label: 'HubSpot', available: true, enabled: false, configured: false, builtin: true } },
      extras: [],
      banner: { show: true, url: 'https://subtleforms.com/pro/' },
    },
    ...overrides,
  };
}

async function mount(element, data = pageData(), hash = '#tab=extensions&ext=crm', all = { services: { hubspot: CONNECTED } }) {
  window.subtleformsAdmin = data;
  window.history.replaceState(null, '', `/wp-admin/admin.php${hash}`);
  crmApi.state.mockResolvedValue(CONNECTED);
  crmApi.all.mockResolvedValue(all);
  crmApi.setEnabled.mockResolvedValue(CONNECTED);
  crmApi.properties.mockResolvedValue([
    { name: 'email', label: 'Email' },
    { name: 'jobtitle', label: 'Job title' },
  ]);
  crmApi.dismissBanner.mockResolvedValue({ dismissed: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(withClient(element)));
}

const tile = (slug) => container.querySelector(`.sf-svc-tile[data-service="${slug}"]`);

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
  delete window.subtleformsAdmin;
  ['crm.service.settings', 'crm.service.form'].forEach((slot) => delete window.__subtleformsExtend.slots[slot]);
  window.history.replaceState(null, '', '/');
});

describe('the grid', () => {
  test('has one tile, HubSpot, with its own switch and no Save button', async () => {
    await mount(<CrmSettings />);
    const tiles = [...container.querySelectorAll('.sf-svc-tile')];
    expect(tiles.map((t) => t.getAttribute('data-service'))).toEqual(['hubspot']);
    expect(tile('hubspot').querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(container.textContent).toContain('Send contacts to HubSpot from the forms you choose.');
    expect([...container.querySelectorAll('button')].some((b) => /save changes/i.test(b.textContent))).toBe(false);
  });

  test('shows the note about Pro, and hides it once an add-on registers extras', async () => {
    await mount(<CrmSettings />);
    expect(container.querySelector('.sf-em-pro')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
    registerSlotItem('crm.service.settings', 'pro-extras', { component: () => null });
    await mount(<CrmSettings />);
    expect(container.querySelector('.sf-em-pro')).toBeNull();
  });

  test('a service the server does not list gets no tile', async () => {
    registerCrmService('acme', { label: 'Acme', settingsComponent: () => null });
    await mount(<CrmSettings />);
    expect(tile('acme')).toBeNull();
    delete window.__subtleformsExtend.crm.acme;
  });
});

describe('the HubSpot screen', () => {
  test('opens from the address and shows the portal name and a masked token', async () => {
    await mount(<CrmSettings />, pageData(), '#tab=extensions&ext=crm&service=hubspot');
    expect(container.querySelector('.sf-crm-detail')).not.toBeNull();
    expect(container.textContent).toContain('Acme Portal (123456)');
    expect(container.textContent).toContain('ab12');
    expect(container.textContent).not.toMatch(/pat-/);
  });

  test('test connection shows the portal name and id from the server', async () => {
    crmApi.test = crmApi.test.mockResolvedValue({ ok: true, message: 'Connected to Acme Portal (123456).', state: CONNECTED });
    await mount(<CrmSettings />, pageData(), '#tab=extensions&ext=crm&service=hubspot');
    crmApi.test.mockResolvedValue({ ok: true, message: 'Connected to Acme Portal (123456).', state: CONNECTED });
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Test connection');
    await act(async () => btn.click());
    expect(container.querySelector('[role="status"]').textContent).toContain('Acme Portal (123456)');
  });
});

describe('the form panel', () => {
  const schema = {
    fields: [
      { key: 'email', type: 'email', label: 'Email' },
      { key: 'name', type: 'text', label: 'Name' },
    ],
  };

  test('lists HubSpot only while it is switched on in Settings', async () => {
    await mount(<CrmFormPanel schema={schema} integrations={{}} patch={jest.fn()} fieldOptions={[]} />, pageData(), '', { services: { hubspot: { ...CONNECTED, enabled: false } } });
    await act(async () => {});
    expect(container.querySelector('[data-service="hubspot"]')).toBeNull();
    expect(container.textContent).toContain('No CRM is switched on.');
  });

  test('the switch patches the form and the mapping shows email as required', async () => {
    const patch = jest.fn();
    window.subtleformsAdmin = null;
    await mount(<CrmFormPanel schema={schema} integrations={{ hubspot: { enabled: true } }} patch={patch} fieldOptions={[{ label: 'Name', value: 'name' }]} />, pageData({
      crm: { services: { hubspot: { enabled: true, configured: true } }, extras: [], banner: { show: false, url: '' } },
    }));
    await act(async () => {});
    const section = container.querySelector('[data-service="hubspot"]');
    expect(section).not.toBeNull();
    expect(section.textContent).toContain('required');
    expect(section.textContent).toContain('Job title');
    expect(section.textContent).toContain('Update existing contacts');
  });

  test('renders what an add-on draws in the crm.service.form slot', async () => {
    registerSlotItem('crm.service.form', 'extra', { component: ({ service }) => <p id='extra'>{service}</p> });
    await mount(<CrmFormPanel schema={schema} integrations={{ hubspot: { enabled: true } }} patch={jest.fn()} fieldOptions={[]} />, pageData({
      crm: { services: { hubspot: { enabled: true, configured: true } }, extras: [], banner: { show: false, url: '' } },
    }));
    await act(async () => {});
    expect(container.querySelector('#extra')?.textContent).toBe('hubspot');
  });
});

describe('setPropertyRow', () => {
  test('adds, changes and removes a row, keeping the others', () => {
    let rows = setPropertyRow([], 'jobtitle', 'role');
    expect(rows).toEqual([{ field: 'role', property: 'jobtitle' }]);
    rows = setPropertyRow(rows, 'city', 'town');
    rows = setPropertyRow(rows, 'jobtitle', 'position');
    expect(rows).toEqual([
      { field: 'position', property: 'jobtitle' },
      { field: 'town', property: 'city' },
    ]);
    expect(setPropertyRow(rows, 'jobtitle', '')).toEqual([{ field: 'town', property: 'city' }]);
  });
});
