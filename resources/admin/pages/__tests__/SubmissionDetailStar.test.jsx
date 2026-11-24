/**
 * The Star button on the entry detail shows whether the entry is starred (#124).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SubmissionDetailPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => {
  const Shell = ({ children, actions }) => <div><div className='actions'>{ actions }</div>{ children }</div>;
  Shell.displayName = 'AdminShellMock';
  return Shell;
});
jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));
jest.mock('../../data', () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}));

import { apiClient } from '../../data';
import SubmissionDetailPage from '../SubmissionDetailPage';
import { isOn } from '../../utils/isOn';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const entry = (starred) => ({
  id: 7,
  form_id: 3,
  status: 'completed',
  is_read: 1,
  starred,
  created_at: '2026-01-01 10:00:00',
  data: { name: 'Ada' },
  meta: {},
});

async function mountWith(starred, extra = {}) {
  apiClient.get.mockImplementation((path) => {
    if (path.endsWith('/logs')) return Promise.resolve([]);
    if (path.includes('/adjacent')) return Promise.resolve({ next: null, prev: null });
    return Promise.resolve({ data: entry(starred) });
  });
  apiClient.put.mockResolvedValue({});
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (props = {}) =>
    act(async () => { root.render(<SubmissionDetailPage submissionId={7} formId={3} onBack={() => {}} { ...extra } { ...props } />); });
  await render();
  await flush();
  return { container, render, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const starButton = (container) =>
  Array.from(container.querySelectorAll('button')).find((b) => /^Star(red)?$/.test(b.textContent.trim()));

describe('isOn', () => {
  test.each([[1, true], ['1', true], [true, true], ['true', true], [0, false], ['0', false], [false, false], [null, false], [undefined, false], ['', false]])(
    'isOn(%p) is %p',
    (value, expected) => expect(isOn(value)).toBe(expected)
  );
});

describe('Star button on the entry detail (#124)', () => {
  beforeEach(() => { apiClient.get.mockReset(); apiClient.put.mockReset(); });

  test.each([[1], ['1'], [true]])('starred %p shows Starred and is pressed', async (value) => {
    const { container, unmount } = await mountWith(value);
    const button = starButton(container);
    expect(button.textContent.trim()).toBe('Starred');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    unmount();
  });

  test.each([[0], ['0'], [false]])('starred %p shows Star and is not pressed', async (value) => {
    const { container, unmount } = await mountWith(value);
    const button = starButton(container);
    expect(button.textContent.trim()).toBe('Star');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    unmount();
  });

  test('clicking toggles the state both ways and saves it', async () => {
    const { container, unmount } = await mountWith('0');
    await act(async () => { starButton(container).click(); });
    await flush();
    expect(apiClient.put).toHaveBeenLastCalledWith('/submissions/7', { starred: true });
    expect(starButton(container).textContent.trim()).toBe('Starred');
    expect(starButton(container).getAttribute('aria-pressed')).toBe('true');
    await act(async () => { starButton(container).click(); });
    await flush();
    expect(apiClient.put).toHaveBeenLastCalledWith('/submissions/7', { starred: false });
    expect(starButton(container).textContent.trim()).toBe('Star');
    expect(starButton(container).getAttribute('aria-pressed')).toBe('false');
    unmount();
  });

  test('a failed save shows the error and never claims the entry is starred', async () => {
    const { container, unmount } = await mountWith(0, { embedded: true });
    apiClient.put.mockRejectedValue(new Error('no'));
    await act(async () => { starButton(container).click(); });
    await flush();
    expect(container.textContent).toContain('Failed to update status');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Starred')).toBe(false);
    unmount();
  });

  test('a star set in the list shows in the panel', async () => {
    const { container, render, unmount } = await mountWith(0);
    await render({ listPatch: { id: 7, patch: { starred: 1 } } });
    expect(starButton(container).textContent.trim()).toBe('Starred');
    expect(starButton(container).getAttribute('aria-pressed')).toBe('true');
    await render({ listPatch: { id: 7, patch: { starred: 0 } } });
    expect(starButton(container).textContent.trim()).toBe('Star');
    await render({ listPatch: { id: 99, patch: { starred: 1 } } });
    expect(starButton(container).textContent.trim()).toBe('Star');
    unmount();
  });
});
