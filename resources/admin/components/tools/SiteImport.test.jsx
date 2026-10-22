/**
 * One-click import (2.6.0): sources with counts, a checkbox list of forms,
 * progress, one result card per form with its report, and the "import again
 * as a copy" question for a form imported before.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./SiteImport.scss', () => ({}));
jest.mock('../../utils/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

import { apiGet, apiPost } from '../../utils/api';
import SiteImport, { resultSummary } from './SiteImport';

global.IS_REACT_ACT_ENVIRONMENT = true;

const ok = (data) => ({ ok: true, status: 200, body: { data } });

const SOURCES = [
  { id: 'cf7', label: 'Contact Form 7', active: false, count: 2 },
  { id: 'gravity', label: 'Gravity Forms', active: true, count: 1 },
  { id: 'fluent', label: 'Fluent Forms', active: false, count: 0 },
];

const CF7_FORMS = [
  { id: '11', title: 'Contact form 1', fields: 4, notes: 1, imported: [] },
  { id: '12', title: 'Book a visit', fields: 16, notes: 8, imported: [ { id: 90, title: 'Book a visit', status: 'draft', edit_url: '/edit?form_id=90' } ] },
];

const imported = ( id, title, formId, notes = [] ) => ( {
  source_id: id,
  title,
  status: 'imported',
  form_id: formId,
  edit_url: `/wp-admin/admin.php?page=subtleforms-new-form&form_id=${ formId }`,
  fields: 4,
  notes,
  existing: [],
  error: '',
} );

const flush = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

async function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<SiteImport />));
  await flush();
  await flush();
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

function click(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function routes(forms = { cf7: CF7_FORMS, gravity: [ { id: '3', title: 'Job application', fields: 21, notes: 14, imported: [] } ] }) {
  apiGet.mockImplementation((path) => {
    if (path === '/tools/migrate/sources') {
      return Promise.resolve(ok(SOURCES));
    }
    const match = path.match(/sources\/([a-z0-9]+)\/forms/);
    return Promise.resolve(ok(forms[ match[1] ] || []));
  });
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  window.requestAnimationFrame = (cb) => cb();
});

describe('one-click import', () => {
  test('lists each plugin with its count and the first plugin with forms is chosen', async () => {
    routes();
    const { container, unmount } = await mount();
    const radios = [ ...container.querySelectorAll('input[name="sf-import-source"]') ];
    expect(radios.map((r) => r.closest('label').textContent)).toEqual([
      'Contact Form 72 formsplugin not active',
      'Gravity Forms1 form',
      'Fluent FormsNo forms found',
    ]);
    expect(radios[0].checked).toBe(true);
    expect(radios[2].disabled).toBe(true);
    expect(apiGet).toHaveBeenCalledWith('/tools/migrate/sources/cf7/forms');
    expect(container.textContent).toContain('Entries and payment settings are not imported, no emails are sent, and your original forms are not changed.');
    expect(container.textContent).toContain('Entries are not imported in this version.');
    unmount();
  });

  test('shows a checkbox per form with its field count and earlier imports', async () => {
    routes();
    const { container, unmount } = await mount();
    const rows = [ ...container.querySelectorAll('.sf-import__list li') ];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toBe('Contact form 14 fields');
    expect(rows[1].textContent).toContain('Imported before');
    expect(rows[0].querySelector('input[type="checkbox"]')).not.toBeNull();
    const button = [ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import');
    expect(button.disabled).toBe(true);
    unmount();
  });

  test('choosing another plugin loads its forms', async () => {
    routes();
    const { container, unmount } = await mount();
    click(container.querySelectorAll('input[name="sf-import-source"]')[1]);
    await flush();
    expect(apiGet).toHaveBeenCalledWith('/tools/migrate/sources/gravity/forms');
    expect(container.querySelector('.sf-import__list').textContent).toContain('Job application21 fields');
    unmount();
  });

  test('imports the ticked forms one at a time and shows a card with the report', async () => {
    routes();
    let release;
    apiPost
      .mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(ok([ imported('11', 'Contact form 1', 101, [
        { level: 'skipped', text: "The Reply-To address \"[your-email]\" of the email 'Mail' was not copied." },
        { level: 'info', text: '1 email notification was copied.' },
      ]) ])); }))
      .mockResolvedValueOnce(ok([ { ...imported('12', 'Book a visit', 0), status: 'exists', form_id: 0, edit_url: '', existing: [ { id: 90, title: 'Book a visit', status: 'draft', edit_url: '/edit?form_id=90' } ] } ]));
    const { container, unmount } = await mount();

    click(container.querySelector('.sf-import__all input'));
    const button = [ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 2 forms');
    expect(button).toBeTruthy();
    click(button);
    await flush();
    expect(container.querySelector('[role="status"]').textContent).toContain('Importing 1 of 2');
    expect(container.querySelector('.sf-import__forms').disabled).toBe(true);
    await act(async () => { release(); });
    await flush();
    await flush();

    expect(apiPost).toHaveBeenNthCalledWith(1, '/tools/migrate/sources/cf7/import', { ids: [ '11' ], copies: [] });
    expect(apiPost).toHaveBeenNthCalledWith(2, '/tools/migrate/sources/cf7/import', { ids: [ '12' ], copies: [] });
    const cards = container.querySelectorAll('.sf-import__result');
    expect(cards).toHaveLength(2);
    const done = container.querySelector('.sf-import__result.is-imported');
    expect(done.textContent).toContain('Imported with 4 fields, 1 note.');
    expect(done.querySelector('a').getAttribute('href')).toContain('form_id=101');
    expect(done.querySelector('details summary').textContent).toBe('Show the report');
    expect(done.querySelector('details li.is-skipped').textContent).toContain('Not copied');
    expect(document.activeElement.textContent).toBe('Import results');
    expect(container.querySelector('[role="status"]').textContent).toBe('');
    unmount();
  });

  test('a form imported before asks first and imports a copy only when asked', async () => {
    routes();
    apiPost
      .mockResolvedValueOnce(ok([ { ...imported('12', 'Book a visit', 0), status: 'exists', existing: [ { id: 90, title: 'Book a visit', status: 'draft', edit_url: '/edit?form_id=90' } ] } ]))
      .mockResolvedValueOnce(ok([ imported('12', 'Book a visit (copy)', 102) ]));
    const { container, unmount } = await mount();
    click(container.querySelectorAll('.sf-import__list input')[1]);
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 1 form'));
    await flush();
    await flush();

    const ask = container.querySelector('.sf-import__result.is-exists');
    expect(ask.textContent).toContain('Import again as a copy?');
    expect(ask.querySelector('a').getAttribute('href')).toBe('/edit?form_id=90');
    click([ ...ask.querySelectorAll('button') ].find((b) => b.textContent === 'Import a copy'));
    await flush();
    await flush();
    expect(apiPost).toHaveBeenLastCalledWith('/tools/migrate/sources/cf7/import', { ids: [ '12' ], copies: [ '12' ] });
    expect(container.querySelector('.sf-import__result.is-exists')).toBeNull();
    expect(container.querySelector('.sf-import__result.is-imported').textContent).toContain('Book a visit (copy)');
    unmount();
  });

  test('keeping the one I have dismisses the question', async () => {
    routes();
    apiPost.mockResolvedValueOnce(ok([ { ...imported('12', 'Book a visit', 0), status: 'exists', existing: [ { id: 90, title: 'Book a visit', edit_url: '/x' } ] } ]));
    const { container, unmount } = await mount();
    click(container.querySelectorAll('.sf-import__list input')[1]);
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 1 form'));
    await flush();
    await flush();
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Keep the one I have'));
    expect(container.querySelector('.sf-import__result')).toBeNull();
    expect(apiPost).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('a failed request still gives that form a card', async () => {
    routes();
    apiPost.mockResolvedValueOnce({ ok: false, status: 500, body: { message: 'Server error' } });
    const { container, unmount } = await mount();
    click(container.querySelectorAll('.sf-import__list input')[0]);
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 1 form'));
    await flush();
    await flush();
    const card = container.querySelector('.sf-import__result.is-failed');
    expect(card.textContent).toContain('Contact form 1');
    expect(card.textContent).toContain('Server error');
    unmount();
  });

  test('says so when no other form plugin left forms', async () => {
    apiGet.mockResolvedValue(ok(SOURCES.map((s) => ({ ...s, count: 0 }))));
    const { container, unmount } = await mount();
    expect(container.textContent).toContain('No Contact Form 7, Gravity Forms or Fluent Forms forms were found on this site.');
    expect(container.querySelector('.sf-import__list')).toBeNull();
    unmount();
  });

  test('the summary counts only lines that need attention', () => {
    expect(resultSummary({ fields: 1, notes: [ { level: 'info', text: 'x' } ] })).toBe('Imported with 1 field.');
    expect(resultSummary({ fields: 12, notes: [ { level: 'skipped' }, { level: 'changed' }, { level: 'info' } ] })).toBe('Imported with 12 fields, 2 notes.');
  });
});
