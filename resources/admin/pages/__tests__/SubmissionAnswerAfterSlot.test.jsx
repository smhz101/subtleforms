/**
 * The entry.answer.after slot: a registered item gets the answer, its field
 * node and the submission; with nothing registered the wrapper stays empty
 * (and the stylesheet hides an empty wrapper, so it adds no margin).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SubmissionDetailPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => {
  const Shell = ({ children }) => <div>{ children }</div>;
  Shell.displayName = 'AdminShellMock';
  return Shell;
});
jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));
jest.mock('../../data', () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}));

import { apiClient } from '../../data';
import { registerSlotItem } from '../../../shared/extend';
import SubmissionDetailPage from '../SubmissionDetailPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const address = { street_address: '1 Main', city: 'Lahore' };

async function mount() {
  apiClient.get.mockImplementation((path) => {
    if (path.endsWith('/logs')) return Promise.resolve([]);
    if (path.includes('/adjacent')) return Promise.resolve({ next: null, prev: null });
    return Promise.resolve({
      data: {
        id: 7, form_id: 3, status: 'completed', is_read: 1, starred: 0,
        created_at: '2026-01-01 10:00:00',
        payload: { addr: address, name: 'Ada' },
        meta: {},
        schema: { fields: [ { key: 'addr', type: 'address_group', label: 'Address' }, { key: 'name', type: 'text', label: 'Name' } ] },
      },
    });
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<SubmissionDetailPage submissionId={7} formId={3} onBack={() => {}} />); });
  await flush();
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe('entry.answer.after slot', () => {
  beforeEach(() => { apiClient.get.mockReset(); });

  test('draws nothing inside the wrapper when the slot is empty', async () => {
    const { container, unmount } = await mount();
    const wrappers = container.querySelectorAll('.sf-answers__value .sf-answers__after');
    expect(wrappers.length).toBe(2);
    wrappers.forEach((w) => expect(w.childNodes.length).toBe(0));
    unmount();
  });

  test('a registered item gets the answer, field node, type and submission', async () => {
    const seen = [];
    registerSlotItem('entry.answer.after', 'test-map', {
      component: (props) => {
        seen.push(props);
        return props.fieldType === 'address_group' ? <a className='test-map' href='https://example.com'>Map</a> : null;
      },
    });
    const { container, unmount } = await mount();
    const links = container.querySelectorAll('.sf-answers__after .test-map');
    expect(links.length).toBe(1);
    const addr = seen.find((p) => p.fieldKey === 'addr');
    expect(addr.value).toEqual(address);
    expect(addr.fieldType).toBe('address_group');
    expect(addr.field.label).toBe('Address');
    expect(addr.submission.id).toBe(7);
    const name = container.querySelectorAll('.sf-answers__after')[1];
    expect(name.childNodes.length).toBe(0);
    unmount();
  });
});
