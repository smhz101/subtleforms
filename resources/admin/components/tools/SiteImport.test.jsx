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
import SiteImport, { resultSummary, consentLabel, entriesSummary } from './SiteImport';

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
    expect(container.textContent).toContain('Payment settings are not imported, no emails are sent, and your original forms are not changed. Entries are copied only if you tick the box below.');
    expect(container.textContent).toContain('Entries are copied only if you tick the box.');
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

  test('a slow answer for an earlier plugin does not replace the current plugin forms', async () => {
    const pending = {};
    apiGet.mockImplementation((path) => {
      if (path === '/tools/migrate/sources') {
        return Promise.resolve(ok(SOURCES));
      }
      const id = path.match(/sources\/([a-z0-9]+)\/forms/)[1];
      return new Promise((resolve) => { pending[id] = resolve; });
    });
    const { container, unmount } = await mount();
    expect(pending.cf7).toBeDefined();
    click(container.querySelectorAll('input[name="sf-import-source"]')[1]);
    await flush();
    expect(pending.gravity).toBeDefined();

    // Gravity answers first, then the older Contact Form 7 answer arrives.
    await act(async () => { pending.gravity(ok([ { id: '3', title: 'Job application', fields: 21, notes: 14, imported: [] } ])); });
    await act(async () => { pending.cf7(ok(CF7_FORMS)); });
    await flush();

    const list = container.querySelector('.sf-import__list').textContent;
    expect(list).toContain('Job application');
    expect(list).not.toContain('Contact form 1');
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
    expect(container.textContent).toContain('No Contact Form 7, Gravity Forms, Fluent Forms, WPForms or Ninja Forms forms were found on this site.');
    expect(container.querySelector('.sf-import__list')).toBeNull();
    unmount();
  });

  test('the summary counts only lines that need attention', () => {
    expect(resultSummary({ fields: 1, notes: [ { level: 'info', text: 'x' } ] })).toBe('Imported with 1 field.');
    expect(resultSummary({ fields: 12, notes: [ { level: 'skipped' }, { level: 'changed' }, { level: 'info' } ] })).toBe('Imported with 12 fields, 2 notes.');
  });
});

describe('entries and consent', () => {
  const WP_SOURCES = [
    { id: 'wpforms', label: 'WPForms', active: false, count: 2 },
    { id: 'ninja', label: 'Ninja Forms', active: false, count: 1 },
  ];
  const WP_FORMS = [
    { id: '101', title: 'Contact request', fields: 14, notes: 4, entries: 450, imported: [] },
    { id: '102', title: 'Tiny form', fields: 1, notes: 0, entries: 0, imported: [] },
  ];

  function wpRoutes() {
    apiGet.mockImplementation((path) => {
      if (path === '/tools/migrate/sources') {
        return Promise.resolve(ok(WP_SOURCES));
      }
      return Promise.resolve(ok(path.includes('/wpforms/') ? WP_FORMS : []));
    });
  }

  const tick = (box) => click(box);

  test('lists WPForms and Ninja Forms with their counts and the entries of each form', async () => {
    wpRoutes();
    const { container, unmount } = await mount();
    const radios = [ ...container.querySelectorAll('input[name="sf-import-source"]') ];
    expect(radios.map((r) => r.closest('label').textContent)).toEqual([
      'WPForms2 formsplugin not active',
      'Ninja Forms1 formplugin not active',
    ]);
    const rows = [ ...container.querySelectorAll('.sf-import__list li') ];
    expect(rows[0].textContent).toBe('Contact request14 fields450 entries');
    expect(rows[1].textContent).toBe('Tiny form1 field');
    unmount();
  });

  test('the consent box is hidden until a form with entries is ticked, then unticked by default', async () => {
    wpRoutes();
    const { container, unmount } = await mount();
    expect(container.querySelector('.sf-import__consent')).toBeNull();
    tick(container.querySelectorAll('.sf-import__list input')[1]);
    expect(container.querySelector('.sf-import__consent')).toBeNull();
    tick(container.querySelectorAll('.sf-import__list input')[0]);
    const consent = container.querySelector('.sf-import__consent');
    expect(consent.textContent).toBe(consentLabel(450));
    expect(consent.textContent).toBe('Also import 450 entries. Entries contain personal data your visitors sent. They are copied into SubtleForms; the originals are not changed or deleted.');
    expect(consent.querySelector('input').checked).toBe(false);
    unmount();
  });

  test('without the box ticked no entries are requested', async () => {
    wpRoutes();
    apiPost.mockResolvedValue(ok([ { ...imported('101', 'Contact request', 55), entries: 450 } ]));
    const { container, unmount } = await mount();
    tick(container.querySelectorAll('.sf-import__list input')[0]);
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 1 form'));
    await flush();
    await flush();
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost.mock.calls[0][0]).toBe('/tools/migrate/sources/wpforms/import');
    expect(container.querySelector('.sf-import__entries')).toBeNull();
    unmount();
  });

  test('with the box ticked entries are copied in batches with a progress bar and summed in the report', async () => {
    wpRoutes();
    let resolveSecond;
    apiPost.mockImplementation((path, body) => {
      if (path.endsWith('/import')) {
        return Promise.resolve(ok([ { ...imported('101', 'Contact request', 55), entries: 450 } ]));
      }
      if (body.after === 0) {
        return Promise.resolve(ok({ imported: 200, skipped: 0, failed: 0, files: 3, next: 200, done: false, error: '' }));
      }
      return new Promise((resolve) => {
        resolveSecond = () => resolve(ok({ imported: 248, skipped: 2, failed: 0, files: 1, next: 452, done: true, error: '' }));
      });
    });
    const { container, unmount } = await mount();
    tick(container.querySelectorAll('.sf-import__list input')[0]);
    tick(container.querySelector('.sf-import__consent input'));
    expect(container.querySelector('.sf-import__consent input').checked).toBe(true);
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 1 form'));
    await flush();
    await flush();

    const bar = container.querySelector('.sf-import__status progress');
    expect(bar.getAttribute('max')).toBe('450');
    expect(bar.getAttribute('value')).toBe('200');
    expect(container.querySelector('.sf-import__status').textContent).toContain('Copying entries: 200 of 450');
    const calls = apiPost.mock.calls.filter(([ path ]) => path.endsWith('/entries'));
    expect(calls[0][1]).toEqual({ id: '101', form_id: 55, after: 0, consent: true });

    await act(async () => { resolveSecond(); });
    await flush();
    expect(apiPost.mock.calls.filter(([ path ]) => path.endsWith('/entries'))[1][1].after).toBe(200);
    const report = container.querySelector('.sf-import__entries').textContent;
    expect(report).toContain('448 entries copied, 2 already there and skipped.');
    expect(report).toContain('4 uploaded files were not copied');
    // The box starts unticked again for the next run.
    expect(container.querySelector('.sf-import__consent')).toBeNull();
    unmount();
  });

  test('a failed batch stops that form and says so', async () => {
    wpRoutes();
    apiPost.mockImplementation((path) => (path.endsWith('/import')
      ? Promise.resolve(ok([ { ...imported('101', 'Contact request', 55), entries: 450 } ]))
      : Promise.resolve({ ok: false, status: 500, body: { message: 'Server broke.' } })));
    const { container, unmount } = await mount();
    tick(container.querySelectorAll('.sf-import__list input')[0]);
    tick(container.querySelector('.sf-import__consent input'));
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 1 form'));
    await flush();
    await flush();
    expect(container.querySelector('.sf-import__entries').textContent).toContain('Server broke.');
    unmount();
  });

  test('a form imported before takes its entries into the form you already have', async () => {
    apiGet.mockImplementation((path) => Promise.resolve(ok(path === '/tools/migrate/sources'
      ? WP_SOURCES
      : [ { ...WP_FORMS[0], imported: [ { id: 77, title: 'Contact request', status: 'draft', edit_url: '/edit?form_id=77' } ] } ])));
    apiPost.mockImplementation((path) => (path.endsWith('/import')
      ? Promise.resolve(ok([ { source_id: '101', title: 'Contact request', status: 'exists', existing: [ { id: 77, title: 'Contact request', edit_url: '/edit?form_id=77' } ], entries: 450, notes: [] } ]))
      : Promise.resolve(ok({ imported: 12, skipped: 438, failed: 0, files: 0, next: 450, done: true, error: '' }))));
    const { container, unmount } = await mount();
    tick(container.querySelectorAll('.sf-import__list input')[0]);
    tick(container.querySelector('.sf-import__consent input'));
    click([ ...container.querySelectorAll('button') ].find((b) => b.textContent === 'Import 1 form'));
    await flush();
    await flush();
    const entryCall = apiPost.mock.calls.find(([ path ]) => path.endsWith('/entries'));
    expect(entryCall[1]).toEqual({ id: '101', form_id: 77, after: 0, consent: true });
    expect(container.querySelector('.sf-import__result.is-exists .sf-import__entries').textContent).toContain('12 entries copied, 438 already there and skipped.');
    unmount();
  });

  test('the sentences', () => {
    expect(consentLabel(1)).toContain('Also import 1 entry.');
    expect(entriesSummary({ imported: 1, skipped: 0, failed: 2, files: 0 })).toBe('1 entry copied, 2 could not be copied.');
  });
});
