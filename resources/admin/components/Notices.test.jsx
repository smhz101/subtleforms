/**
 * Notices follow WordPress core: the shared Notices component renders core's
 * Notice and Snackbar with status classes, and no notice style in the app
 * has rounded corners.
 */
import fs from 'fs';
import path from 'path';
import { createRoot } from '@wordpress/element';
import { act } from 'react';

// WordPress provides the notices store at run time (wp.notices); here it is a
// small store holding whatever list the test sets.
jest.mock('@wordpress/notices', () => ({ store: 'core/notices' }), { virtual: true });

import { createReduxStore, register, dispatch } from '@wordpress/data';
import Notices from './Notices';

global.IS_REACT_ACT_ENVIRONMENT = true;

register(
  createReduxStore('core/notices', {
    reducer: (state = [], action) => (action.type === 'SET' ? action.notices : state),
    selectors: { getNotices: (state) => state },
    actions: {
      setNotices: (notices) => ({ type: 'SET', notices }),
      removeNotice: () => ({ type: 'NOOP' }),
    },
  })
);

const root = path.resolve(__dirname, '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function mount(notices) {
  dispatch('core/notices').setNotices(notices);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const r = createRoot(container);
  act(() => r.render(<Notices />));
  return () => {
    act(() => r.unmount());
    container.remove();
  };
}

const notice = (extra) => ({
  id: 'n',
  content: 'Message',
  isDismissible: true,
  actions: [],
  spokenMessage: 'Message',
  type: 'default',
  ...extra,
});

describe('shared Notices component', () => {
  test('inline notices render with core status classes', () => {
    const unmount = mount([
      notice({ id: 'ok', status: 'success', content: 'Saved.' }),
      notice({ id: 'bad', status: 'error', content: 'Could not save.' }),
    ]);
    const ok = document.querySelector('.components-notice.is-success');
    const bad = document.querySelector('.components-notice.is-error');
    expect(ok).not.toBeNull();
    expect(bad).not.toBeNull();
    expect(ok.textContent).toContain('Saved.');
    expect(ok.querySelector('.components-notice__dismiss')).not.toBeNull();
    unmount();
  });

  test('snackbars carry the status class that sets the core colour', () => {
    const unmount = mount([
      notice({ id: 's1', status: 'success', type: 'snackbar', content: 'Form duplicated.' }),
      notice({ id: 's2', status: 'error', type: 'snackbar', content: 'Delete failed.' }),
    ]);
    expect(document.querySelector('.subtleforms-snackbars .components-snackbar.is-success')).not.toBeNull();
    expect(document.querySelector('.subtleforms-snackbars .components-snackbar.is-error')).not.toBeNull();
    unmount();
  });
});

describe('notice styles are core styles', () => {
  const block = (scss, selector) => {
    const start = scss.indexOf(selector);
    expect(start).toBeGreaterThan(-1);
    return scss.slice(start, scss.indexOf('\n  }\n', start) + 5);
  };

  test('the Notice override has core colours, a white surface and square corners', () => {
    const scss = read('resources/admin/styles/_components.scss');
    const notice = block(scss, '.components-notice {');
    expect(notice).toMatch(/border-radius:\s*0;/);
    expect(notice).toMatch(/background:\s*#fff;/);
    expect(notice).toMatch(/border-left:\s*4px solid #72aee6/);
    expect(notice).toContain('#00a32a');
    expect(notice).toContain('#dba617');
    expect(notice).toContain('#d63638');
  });

  test.each([
    'resources/admin/components/Notices.scss',
    'resources/admin/components/SiteNotices.scss',
  ])('%s has no rounded notice corners', (file) => {
    const scss = read(file);
    expect(scss).not.toMatch(/border-radius:\s*([1-9.]|var\()/);
  });

  test('the toast notice (sf-notice) is square with core colours', () => {
    const scss = read('resources/admin/ui/feedback/feedback.scss');
    const toast = scss.slice(scss.indexOf('.sf-notice {'), scss.indexOf('@keyframes'));
    expect(toast).toMatch(/border-radius:\s*0;/);
    expect(toast).toMatch(/background:\s*#fff;/);
    for (const colour of ['#00a32a', '#d63638', '#dba617', '#72aee6']) {
      expect(scss).toContain(colour);
    }
  });

  test.each([
    ['resources/admin/components/integrations/emailMarketing/emailMarketing.scss', '&__notice {'],
    ['resources/admin/components/settings/extensions/extensions.scss', '&__notice {'],
    ['resources/admin/components/FormPreviewModal.scss', '&__conversational-notice {'],
  ])('%s: the custom notice box is a core notice', (file, selector) => {
    const scss = read(file);
    const start = scss.indexOf(selector);
    const body = scss.slice(start, scss.indexOf('}', start));
    expect(body).toMatch(/border-radius:\s*0;/);
    expect(body).toMatch(/border-left:\s*4px solid/);
  });
});
