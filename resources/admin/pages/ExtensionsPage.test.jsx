/**
 * Extensions page: tabs, search, chips, recommendations, cards and actions.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { fireEvent } from '@testing-library/dom';

jest.mock('./ExtensionsPage.scss', () => ({}));
jest.mock('../components/extensions/ExtensionCard.scss', () => ({}));
jest.mock('../components/AdminShell', () => function AdminShellMock({ children, title, actions, actionBarLeft, isLoading, error }) {
  return (
    <div data-title={title}>
      <div className='mock-actions'>{actions}</div>
      <div className='mock-toolbar'>{actionBarLeft}</div>
      {isLoading ? <p className='mock-loading'>loading</p> : null}
      {error ? <p className='mock-error'>{error}</p> : null}
      {children}
    </div>
  );
});
jest.mock('../data', () => ({ useExtensions: jest.fn() }));
jest.mock('../data/apiClient', () => ({ apiClient: { post: jest.fn() } }));

import { useExtensions } from '../data';
import { apiClient } from '../data/apiClient';
import ExtensionsPage from './ExtensionsPage';
import ExtensionCard from '../components/extensions/ExtensionCard';
import { recommend } from '../components/extensions/catalog';

global.IS_REACT_ACT_ENVIRONMENT = true;

const plansAction = { label: 'See plans', url: 'https://example.com/plans', kind: 'plans' };
const e = (slug, extra = {}) => ({
  slug,
  title: slug.charAt(0).toUpperCase() + slug.slice(1),
  description: `About ${slug}`,
  category: 'fields',
  plan: 'starter',
  icon: 'edit',
  settingsUrl: '',
  status: 'locked',
  action: plansAction,
  ...extra,
});

const categories = [
  { id: 'payments', label: 'Payments' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'fields', label: 'Fields' },
];

let container;
let root;
let refetch;

async function render(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
}

async function mount(data, result = {}) {
  refetch = jest.fn().mockResolvedValue({});
  useExtensions.mockReturnValue({ data, isLoading: false, error: null, refetch, ...result });
  await render(<ExtensionsPage />);
}

const click = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};
const byText = (sel, text) => [...container.querySelectorAll(sel)].find((n) => n.textContent.trim() === text);
const titles = () => [...container.querySelectorAll('.sf-ext-card__title')].map((n) => n.textContent);
const search = async (value) => {
  await act(async () => {
    fireEvent.change(container.querySelector('input[type="search"]'), { target: { value } });
  });
};

const catalog = {
  hasAddon: false,
  wooActive: false,
  categories,
  entries: [
    e('mailchimp', { category: 'integrations', plan: 'free', status: 'included', action: { label: 'Settings', url: '/s', kind: 'settings' } }),
    e('signature', { description: 'Sign with a finger' }),
    e('woocommerce', { category: 'payments', plan: 'pro' }),
    e('payments', { category: 'payments' }),
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  apiClient.post.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('switches tabs and remembers the last one', async () => {
  await mount(catalog);
  expect(container.querySelector('.sf-ext-section')).not.toBeNull();
  await click(byText('[role=tab]', 'All extensions'));
  expect(container.querySelector('.sf-ext-chips')).not.toBeNull();
  expect(window.localStorage.getItem('subtleforms_extensions_tab')).toBe('all');
  act(() => root.unmount());
  container.remove();
  await mount(catalog);
  expect(container.querySelector('.sf-ext-chips')).not.toBeNull();
});

test('search filters title and description and shows the empty state', async () => {
  await mount(catalog);
  await click(byText('[role=tab]', 'All extensions'));
  await search('FINGER');
  expect(titles()).toEqual(['Signature']);
  await search('zzz');
  expect(container.textContent).toContain('No extensions match "zzz".');
  await click(byText('button', 'Clear search'));
  expect(titles()).toHaveLength(4);
});

test('plan and category chips combine', async () => {
  await mount(catalog);
  await click(byText('[role=tab]', 'All extensions'));
  await click(byText('.sf-ext-chip', 'Starter'));
  expect(titles().sort()).toEqual(['Payments', 'Signature']);
  await click(byText('.sf-ext-chip', 'Payments'));
  expect(titles()).toEqual(['Payments']);
  await click(byText('.sf-ext-chip', 'All'));
  expect(titles()).toHaveLength(4);
});

test('See all jumps to All extensions with the category chip on', async () => {
  await mount(catalog);
  const section = [...container.querySelectorAll('.sf-ext-section')].find((s) => s.textContent.includes('Take payments'));
  await click(section.querySelector('button'));
  expect(byText('.sf-ext-chip', 'Payments').getAttribute('aria-pressed')).toBe('true');
  expect(titles().sort()).toEqual(['Payments', 'Woocommerce']);
});

test('all extensions sorts active before locked', async () => {
  await mount({ ...catalog, entries: [e('zeta'), e('beta', { status: 'active', action: null })] });
  await click(byText('[role=tab]', 'All extensions'));
  expect(titles()).toEqual(['Beta', 'Zeta']);
});

test('recommendations: woo first, then available or update, then next plan', () => {
  const entries = [
    e('payments', { category: 'payments' }),
    e('woocommerce', { category: 'payments', plan: 'pro' }),
    e('own', { status: 'available', plan: 'free' }),
    e('upd', { status: 'update', plan: 'free' }),
    e('pro-thing', { plan: 'pro' }),
  ];
  expect(recommend(entries, true).map((x) => x.slug)).toEqual(['woocommerce', 'upd', 'own']);
  expect(recommend(entries, false).map((x) => x.slug)).toEqual(['upd', 'own', 'payments']);
});

test('recommended row is hidden when nothing qualifies', async () => {
  await mount({ ...catalog, entries: [e('x', { plan: 'agency' })] });
  expect(container.textContent).not.toContain('Recommended for this site');
});

test('My plan without the add-on shows the free state and the included list', async () => {
  await mount(catalog);
  await click(byText('[role=tab]', 'My plan'));
  expect(container.textContent).toContain('You are using the free plugin.');
  expect(container.querySelector('li').textContent).toBe('Mailchimp');
  expect(byText('a', 'See plans').getAttribute('href')).toBe('https://example.com/plans');
});

test('My plan with the add-on groups by status with counts', async () => {
  await mount({
    ...catalog,
    hasAddon: true,
    entries: [e('a', { status: 'active', action: null }), e('b', { status: 'available' }), e('c', { status: 'installed' })],
  });
  await click(byText('[role=tab]', 'My plan'));
  const heads = [...container.querySelectorAll('.sf-ext-section__title')].map((n) => n.textContent);
  expect(heads).toEqual(['Active (1)', 'Ready to install (2)']);
});

describe('card', () => {
  const act1 = (kind) => ({ label: 'Install', url: 'https://example.com', kind });

  test('renders status pill, plan badge and footer text per status', async () => {
    await render(<ExtensionCard entry={e('a', { status: 'update', plan: 'pro', action: act1('update') })} />);
    expect(container.textContent).toContain('Pro');
    expect(container.textContent).toContain('Update available');
    expect(container.textContent).toContain('In your plan');
    act(() => root.unmount());
    container.remove();
    await render(<ExtensionCard entry={e('b', { plan: 'agency' })} />);
    expect(container.textContent).toContain('Agency plan');
    act(() => root.unmount());
    container.remove();
    await render(<ExtensionCard entry={e('c', { status: 'included', plan: 'free', action: { label: 'Settings', url: '/s', kind: 'settings' } })} />);
    expect(container.querySelector('.sf-ext-card__footer').textContent).toContain('Included');
    expect(byText('a', 'Settings').getAttribute('href')).toBe('/s');
  });

  test('plans link opens a new tab with noopener', async () => {
    await render(<ExtensionCard entry={e('a')} />);
    const a = container.querySelector('a.sf-ext-card__link');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  test('install posts the slug, is busy, then refetches and offers settings', async () => {
    let finish;
    apiClient.post.mockReturnValue(new Promise((r) => { finish = r; }));
    const onChanged = jest.fn();
    await render(<ExtensionCard onChanged={onChanged} entry={e('sig', { status: 'available', settingsUrl: '/open', action: act1('install') })} />);
    await click(byText('button', 'Install'));
    expect(apiClient.post).toHaveBeenCalledWith('/extensions/install', { slug: 'sig' });
    expect(container.querySelector('button').disabled).toBe(true);
    await act(async () => finish({ status: 'installed', settingsUrl: '/open' }));
    expect(onChanged).toHaveBeenCalled();
    expect(container.querySelector('button').disabled).toBe(false);
    expect(byText('a', 'Open settings').getAttribute('href')).toBe('/open');
  });

  test('an error shows inline and a 409 offers the zip', async () => {
    const err = Object.assign(new Error('File changes are off.'), { status: 409, data: { downloadUrl: 'https://example.com/z.zip' } });
    apiClient.post.mockRejectedValue(err);
    const onChanged = jest.fn();
    await render(<ExtensionCard onChanged={onChanged} entry={e('sig', { status: 'available', action: act1('install') })} />);
    await click(byText('button', 'Install'));
    const alert = container.querySelector('[role=alert]');
    expect(alert.textContent).toContain('File changes are off.');
    expect(byText('a', 'Download the zip').getAttribute('href')).toBe('https://example.com/z.zip');
    expect(onChanged).not.toHaveBeenCalled();
  });

  test('a 409 in the envelope shape (meta) offers the zip too, and other 409s do not', async () => {
    apiClient.post.mockRejectedValue(Object.assign(new Error('Off.'), { status: 409, code: 'file_mods_disabled', meta: { downloadUrl: 'https://example.com/m.zip' } }));
    await render(<ExtensionCard entry={e('sig', { status: 'available', action: act1('install') })} />);
    await click(byText('button', 'Install'));
    expect(byText('a', 'Download the zip').getAttribute('href')).toBe('https://example.com/m.zip');
    apiClient.post.mockRejectedValue(Object.assign(new Error('Needs a newer WordPress.'), { status: 409, code: 'requirements_not_met', data: { status: 409 } }));
    await click(byText('button', 'Install'));
    expect(container.querySelector('[role=alert]').textContent).toBe('Needs a newer WordPress.');
    expect(byText('a', 'Download the zip')).toBeUndefined();
  });

  test('a plain error has no download link', async () => {
    apiClient.post.mockRejectedValue(new Error('No route'));
    await render(<ExtensionCard entry={e('sig', { status: 'installed', action: act1('activate') })} />);
    await click(byText('button', 'Install'));
    expect(container.querySelector('[role=alert]').textContent).toBe('No route');
  });
});

test('shows an error message when the request fails', async () => {
  await mount(undefined, { error: new Error('Request failed') });
  expect(container.querySelector('.mock-error').textContent).toBe('Request failed');
});
