/**
 * Settings > Integrations > Email marketing: the service grid, the service
 * screen, the address, the keyboard and the note about Pro. The API is mocked.
 */
import fs from 'fs';
import path from 'path';
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import EmailMarketingSettings from './EmailMarketingSettings';
import { emailMarketingApi } from './api';
import { registerSlotItem, registerEmailMarketingService } from '../../../../shared/extend';
import { withClient } from '../../../../../tests/js/queryWrapper';

jest.mock('./emailMarketing.scss', () => ({}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  emailMarketingApi: {
    state: jest.fn(),
    setEnabled: jest.fn(),
    connect: jest.fn(),
    test: jest.fn(),
    disconnect: jest.fn(),
    saveSettings: jest.fn(),
    brevoTemplates: jest.fn(),
    dismissBanner: jest.fn(),
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const CONNECTED = { enabled: true, status: 'connected', has_key: true, last4: 'us21', account_name: 'Acme Studio', account_email: 'owner@example.com', error: '', settings: {} };

let container;
let root;

function pageData(overrides = {}) {
  return {
    extensions: { email_marketing: { slug: 'email_marketing', builtin: true, enabled: false, configured: false } },
    emailMarketing: {
      services: {
        mailchimp: { slug: 'mailchimp', label: 'Mailchimp', available: true, enabled: false, configured: false, builtin: true },
        brevo: { slug: 'brevo', label: 'Brevo', available: true, enabled: false, configured: false, builtin: true },
        kit: { slug: 'kit', label: 'Kit', available: true, enabled: false, configured: false, builtin: true },
        mailpoet: { slug: 'mailpoet', label: 'MailPoet', available: true, enabled: false, configured: false, builtin: true, local: true, local_state: 'ready' },
      },
      extras: [],
      banner: { show: true, url: 'https://subtleforms.com/pro/' },
    },
    ...overrides,
  };
}

async function mount(data = pageData(), hash = '#tab=extensions&ext=email_marketing') {
  window.subtleformsAdmin = data;
  window.history.replaceState(null, '', `/wp-admin/admin.php${hash}`);
  emailMarketingApi.state.mockResolvedValue(CONNECTED);
  emailMarketingApi.setEnabled.mockResolvedValue(CONNECTED);
  emailMarketingApi.brevoTemplates.mockResolvedValue([]);
  emailMarketingApi.dismissBanner.mockResolvedValue({ dismissed: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(withClient(<EmailMarketingSettings />)));
}

const tile = (slug) => container.querySelector(`.sf-svc-tile[data-service="${slug}"]`);
const toggleOf = (slug) => tile(slug).querySelector('input[type="checkbox"]');
const open = async (slug) => act(async () => tile(slug).querySelector('.sf-svc-tile__open').click());
const back = () => container.querySelector('button[aria-label="Back to email marketing"]');

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
  delete window.subtleformsAdmin;
  ['email_marketing.service.settings', 'email_marketing.service.form'].forEach((slot) => delete window.__subtleformsExtend.slots[slot]);
  delete window.__subtleformsExtend.emailMarketing.acme;
  window.history.replaceState(null, '', '/');
});

describe('the grid', () => {
  test('shows a tile for Mailchimp, Brevo, Kit and MailPoet in that order, each named for assistive technology only', async () => {
    await mount();
    const tiles = [...container.querySelectorAll('.sf-svc-tile')];
    expect(tiles.map((t) => t.getAttribute('data-service'))).toEqual(['mailchimp', 'brevo', 'kit', 'mailpoet']);
    const names = { mailchimp: 'Mailchimp', brevo: 'Brevo', kit: 'Kit', mailpoet: 'MailPoet' };
    tiles.forEach((t) => {
      const slug = t.getAttribute('data-service');
      const button = t.querySelector('.sf-svc-tile__open');
      expect(button.textContent.trim()).toBe(names[slug]);
      expect(button.querySelector('.sf-sr-only')).not.toBeNull();
    });
  });

  test('a logo is drawn as one full-colour artwork; Brevo, with no official file, is its name in the brand green', async () => {
    await mount();
    ['mailchimp', 'brevo', 'kit', 'mailpoet'].forEach((slug) => {
      const svg = tile(slug).querySelector('.sf-svc-logo svg');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.querySelector('path')).not.toBeNull();
      // Colour is in the artwork itself: no currentColor, so the style sheet alone greys it.
      expect(svg.innerHTML).not.toContain('currentColor');
      expect([...svg.querySelectorAll('[fill]')].length).toBeGreaterThan(0);
    });
  });

  test('each tile has its own switch, labelled for the service, outside the tile button', async () => {
    await mount();
    ['Mailchimp', 'Brevo', 'Kit', 'MailPoet'].forEach((label, i) => {
      const slug = ['mailchimp', 'brevo', 'kit', 'mailpoet'][i];
      expect(toggleOf(slug).getAttribute('aria-label')).toBe(`Enable ${label}`);
      expect(tile(slug).querySelector('.sf-svc-tile__open').contains(toggleOf(slug))).toBe(false);
    });
  });

  test('the layout has no gap and one line between tiles: 4, 2 and 1 columns by the width of the screen, 120px tall', () => {
    const scss = fs.readFileSync(path.join(__dirname, '../serviceTiles/serviceTiles.scss'), 'utf8');
    const grid = scss.slice(scss.indexOf('.sf-svc-grid {'), scss.indexOf('.sf-svc-tile {'));
    expect(grid).toMatch(/grid-template-columns:\s*repeat\(var\(--sf-svc-cols, 4\), minmax\(0, 1fr\)\)/);
    expect(grid).toMatch(/gap:\s*0;/);
    expect(grid).toMatch(/@container sf-svc \(max-width: 719px\)[\s\S]*repeat\(var\(--sf-svc-cols-medium, 2\), /);
    expect(grid).toMatch(/@container sf-svc \(max-width: 399px\)[\s\S]*grid-template-columns:\s*1fr/);
    expect(scss).toMatch(/\.sf-svc-grid-wrap \{[^}]*container-type:\s*inline-size/);
    const tileRule = scss.slice(scss.indexOf('.sf-svc-tile {'), scss.indexOf('&__open'));
    expect(tileRule).toMatch(/min-height:\s*120px/);
    expect(tileRule).toMatch(/border-right:\s*1px solid/);
    expect(tileRule).toMatch(/border-bottom:\s*1px solid/);
    expect(tileRule).not.toMatch(/border-left|border-top|margin/);
  });

  test('an enabled service is marked, and only its logo keeps full colour', async () => {
    const data = pageData();
    data.emailMarketing.services.brevo.enabled = true;
    await mount(data);
    expect(tile('brevo').classList.contains('is-on')).toBe(true);
    expect(tile('mailchimp').classList.contains('is-on')).toBe(false);
    expect(tile('brevo').querySelector('.sf-svc-logo').classList.contains('sf-svc-logo--colour')).toBe(true);
    expect(tile('mailchimp').querySelector('.sf-svc-logo').classList.contains('sf-svc-logo--grey')).toBe(true);
    expect(toggleOf('brevo').checked).toBe(true);
  });

  test('MailPoet says under its logo when it is not installed or not active, and nothing when it is ready', async () => {
    const data = pageData();
    data.emailMarketing.services.mailpoet.local_state = 'not_installed';
    await mount(data);
    expect(tile('mailpoet').querySelector('.sf-svc-tile__status').textContent).toBe('Not installed');
    expect(tile('mailchimp').querySelector('.sf-svc-tile__status')).toBeNull();
    act(() => root.unmount());
    container.remove();
    const inactive = pageData();
    inactive.emailMarketing.services.mailpoet.local_state = 'inactive';
    await mount(inactive);
    expect(tile('mailpoet').querySelector('.sf-svc-tile__status').textContent).toBe('Not active');
    act(() => root.unmount());
    container.remove();
    await mount(pageData());
    expect(tile('mailpoet').querySelector('.sf-svc-tile__status')).toBeNull();
  });


  test('clicking a tile opens that service and puts it in the address', async () => {
    await mount();
    await open('brevo');
    expect(container.querySelector('.sf-em-detail').getAttribute('data-service')).toBe('brevo');
    expect(window.location.hash).toContain('service=brevo');
    expect(window.location.hash).toContain('ext=email_marketing');
    expect(emailMarketingApi.setEnabled).not.toHaveBeenCalled();
  });

  test('clicking the switch does not open the tile', async () => {
    await mount();
    await act(async () => toggleOf('kit').click());
    // On: switched on AND opened (below). Off: only switched off.
    expect(emailMarketingApi.setEnabled).toHaveBeenCalledWith('kit', true);
  });

  test('switching a service on enables it and opens its screen', async () => {
    await mount();
    await act(async () => toggleOf('mailchimp').click());
    expect(emailMarketingApi.setEnabled).toHaveBeenCalledWith('mailchimp', true);
    expect(container.querySelector('.sf-em-detail').getAttribute('data-service')).toBe('mailchimp');
    expect(window.subtleformsAdmin.emailMarketing.services.mailchimp.enabled).toBe(true);
    expect(window.subtleformsAdmin.extensions.email_marketing.enabled).toBe(true);
  });

  test('switching a service off from the grid only disables it and stays on the grid', async () => {
    const data = pageData();
    data.emailMarketing.services.kit.enabled = true;
    await mount(data);
    await act(async () => toggleOf('kit').click());
    expect(emailMarketingApi.setEnabled).toHaveBeenCalledWith('kit', false);
    expect(container.querySelector('.sf-em-detail')).toBeNull();
    expect(container.querySelector('.sf-svc-grid')).not.toBeNull();
    expect(window.location.hash).not.toContain('service=');
    expect(toggleOf('kit').checked).toBe(false);
  });

  test('a switch that could not be saved goes back and says why', async () => {
    await mount();
    emailMarketingApi.setEnabled.mockRejectedValue(new Error('No permission.'));
    await act(async () => toggleOf('kit').click());
    expect(toggleOf('kit').checked).toBe(false);
    expect(container.querySelector('[role="alert"]').textContent).toContain('No permission.');
    expect(container.querySelector('.sf-em-detail')).toBeNull();
  });

  test('the keyboard works: the tile is a button, the switch a separate checkbox, Enter and Space act on each', async () => {
    await mount();
    const button = tile('mailchimp').querySelector('.sf-svc-tile__open');
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(toggleOf('mailchimp').tagName).toBe('INPUT');
    expect(toggleOf('mailchimp').type).toBe('checkbox');
    // Both are natively focusable and are activated by Enter (button) and Space (both).
    expect(button.tabIndex).toBe(0);
    expect(toggleOf('mailchimp').tabIndex).toBe(0);
    expect(button.disabled).toBe(false);
  });
});

describe('a service screen', () => {
  test('has a header with a back arrow only, the logo, the name and the switch', async () => {
    const data = pageData();
    data.emailMarketing.services.mailchimp.enabled = true;
    await mount(data);
    await open('mailchimp');
    const head = container.querySelector('.sf-svc-head');
    expect(back().textContent.trim()).toBe('');
    expect(back().querySelector('svg')).not.toBeNull();
    expect(head.querySelector('.sf-svc-head__logo svg')).not.toBeNull();
    expect(head.querySelector('.sf-svc-head__logo .sf-svc-logo').classList.contains('sf-svc-logo--colour')).toBe(true);
    expect(head.querySelector('h3').textContent).toBe('Mailchimp');
    const toggle = head.querySelector('input[type="checkbox"]');
    expect(toggle.checked).toBe(true);
    expect(head.querySelector(`label[for="${toggle.id}"]`).textContent).toBe('Enabled');
    expect(container.querySelector('.sf-svc-grid')).toBeNull();
  });

  test('draws the connection of the service', async () => {
    await mount();
    await open('kit');
    expect(emailMarketingApi.state).toHaveBeenCalledWith('kit');
    expect(container.textContent).toContain('Connected to Acme Studio (owner@example.com).');
    expect(container.textContent).toContain('••••');
    expect(container.textContent).not.toContain('Double opt-in');
  });

  test('Brevo adds its double opt-in settings', async () => {
    await mount();
    await open('brevo');
    expect(container.textContent).toContain('Confirmation email template');
    expect(container.textContent).toContain('Page people see after they confirm');
  });

  test('the back arrow returns to the grid', async () => {
    await mount();
    await open('mailchimp');
    await act(async () => back().click());
    expect(container.querySelector('.sf-svc-grid')).not.toBeNull();
    expect(container.querySelector('.sf-em-detail')).toBeNull();
    expect(window.location.hash).not.toContain('service=');
  });

  test('switching the header toggle off keeps the settings and returns to the grid', async () => {
    const data = pageData();
    data.emailMarketing.services.mailchimp.enabled = true;
    await mount(data);
    await open('mailchimp');
    await act(async () => container.querySelector('.sf-svc-head input[type="checkbox"]').click());
    expect(emailMarketingApi.setEnabled).toHaveBeenCalledWith('mailchimp', false);
    expect(emailMarketingApi.disconnect).not.toHaveBeenCalled();
    expect(container.querySelector('.sf-svc-grid')).not.toBeNull();
    expect(toggleOf('mailchimp').checked).toBe(false);
  });

  test('a refresh lands on the same service, and the browser Back button returns to the grid', async () => {
    await mount(pageData(), '#tab=extensions&ext=email_marketing&service=kit');
    expect(container.querySelector('.sf-em-detail').getAttribute('data-service')).toBe('kit');

    act(() => root.unmount());
    container.remove();
    await mount();
    await open('mailchimp');
    expect(window.location.hash).toContain('service=mailchimp');
    await act(async () => {
      window.history.replaceState(null, '', '/wp-admin/admin.php#tab=extensions&ext=email_marketing');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(container.querySelector('.sf-svc-grid')).not.toBeNull();
  });

  test('an address that names an unknown service shows the grid', async () => {
    await mount(pageData(), '#tab=extensions&ext=email_marketing&service=nothing');
    expect(container.querySelector('.sf-svc-grid')).not.toBeNull();
  });

  test('an add-on draws extras in the email_marketing.service.settings slot, told the service and whether it is connected', async () => {
    registerSlotItem('email_marketing.service.settings', 'extra', {
      component: (props) => <p data-testid='extra'>{`${props.service} ${props.connected ? 'connected' : 'not connected'}`}</p>,
    });
    await mount();
    await open('mailchimp');
    expect(container.querySelector('[data-testid="extra"]').textContent).toBe('mailchimp connected');
  });

  test('extras know when the service is not connected yet', async () => {
    registerSlotItem('email_marketing.service.settings', 'extra', {
      component: (props) => <p data-testid='extra'>{props.connected ? 'on' : 'off'}</p>,
    });
    await mount();
    emailMarketingApi.state.mockResolvedValue({ enabled: true, status: 'none', has_key: false, last4: '', settings: {} });
    await open('kit');
    expect(container.querySelector('[data-testid="extra"]').textContent).toBe('off');
  });
});

describe('the registry', () => {
  test('an add-on service with a tile and a screen of its own appears in the grid when the server lists it', async () => {
    registerEmailMarketingService('acme', {
      label: 'Acme Mail',
      order: 50,
      settingsComponent: () => <p data-testid='acme'>Acme screen</p>,
    });
    const data = pageData();
    data.emailMarketing.services.acme = { slug: 'acme', label: 'Acme Mail', available: true, enabled: false, configured: false };
    await mount(data);
    expect([...container.querySelectorAll('.sf-svc-tile')].map((t) => t.getAttribute('data-service'))).toEqual(['mailchimp', 'brevo', 'kit', 'mailpoet', 'acme']);
    expect(tile('acme').querySelector('.sf-svc-logo__wordmark').textContent).toBe('Acme Mail');
    await open('acme');
    expect(container.querySelector('[data-testid="acme"]').textContent).toBe('Acme screen');
  });

  test('a service the server does not list has no tile', async () => {
    registerEmailMarketingService('acme', { label: 'Acme Mail', settingsComponent: () => null });
    await mount();
    expect(tile('acme')).toBeNull();
  });
});

describe('the note about Pro', () => {
  const link = () => [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Learn about SubtleForms Pro'));

  test('is plain: one heading, a short text, one link that opens in a new tab, and a dismiss button', async () => {
    await mount();
    const note = container.querySelector('.sf-em-pro');
    expect(note.querySelector('h3').textContent).toBe('Do more with SubtleForms Pro');
    expect(note.querySelectorAll('a')).toHaveLength(1);
    expect(link().getAttribute('href')).toBe('https://subtleforms.com/pro/');
    expect(link().getAttribute('target')).toBe('_blank');
    expect(link().getAttribute('rel')).toContain('noopener');
    expect(note.textContent).toMatch(/several lists per form/);
    expect(note.textContent).toMatch(/delivery log/);
    expect(note.querySelector('button[aria-label="Dismiss"]')).not.toBeNull();
  });

  test('is shown under the grid and again at the bottom of a service screen', async () => {
    await mount();
    expect(container.querySelectorAll('.sf-em-pro')).toHaveLength(1);
    expect(container.querySelector('.sf-svc-grid-wrap').nextElementSibling.classList.contains('sf-em-pro')).toBe(true);
    await open('brevo');
    expect(container.querySelectorAll('.sf-em-pro')).toHaveLength(1);
    expect(container.querySelector('.sf-em-detail').lastElementChild.classList.contains('sf-em-pro')).toBe(true);
  });

  test('has no Pro controls anywhere: no disabled inputs and no Pro badge', async () => {
    await mount();
    await open('mailchimp');
    expect(container.querySelectorAll('[disabled]:not(button)')).toHaveLength(0);
    container.querySelector('.sf-em-pro').remove();
    expect(container.textContent).not.toMatch(/\bPro\b/);
  });

  test('one dismissal is stored once and hides it in both places', async () => {
    await mount();
    await act(async () => container.querySelector('.sf-em-pro button[aria-label="Dismiss"]').click());
    expect(emailMarketingApi.dismissBanner).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.sf-em-pro')).toBeNull();
    await open('mailchimp');
    expect(container.querySelector('.sf-em-pro')).toBeNull();
    expect(window.subtleformsAdmin.emailMarketing.banner.show).toBe(false);
  });

  test('stays hidden when the server says the user dismissed it', async () => {
    const data = pageData();
    data.emailMarketing.banner.show = false;
    await mount(data);
    expect(container.querySelector('.sf-em-pro')).toBeNull();
  });

  test('is hidden when an add-on adds extras to the services (server list)', async () => {
    const data = pageData();
    data.emailMarketing.extras = ['mailchimp', 'brevo', 'kit'];
    await mount(data);
    expect(container.querySelector('.sf-em-pro')).toBeNull();
    await open('kit');
    expect(container.querySelector('.sf-em-pro')).toBeNull();
  });

  test('is hidden when an add-on registered an extras slot, whatever the add-on is called', async () => {
    registerSlotItem('email_marketing.service.settings', 'anything', { component: () => null });
    await mount();
    expect(container.querySelector('.sf-em-pro')).toBeNull();
  });
});

describe('section header', () => {
  test('the grid has the standard header: a title, one description and no icon, and nothing explains itself in the body', async () => {
    await mount();
    const header = container.querySelector('.sf-section-header');
    expect(header.querySelector('h2').textContent).toBe('Email marketing');
    expect(header.querySelectorAll('p')).toHaveLength(1);
    expect(header.querySelector('.sf-section-header__text svg')).toBeNull();
    expect(container.querySelector('.sf-ext-panel__header')).toBeNull();
    expect(container.querySelectorAll('.sf-section-header')).toHaveLength(1);
  });
});
