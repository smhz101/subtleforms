/**
 * Tools keeps transfer and migration. The three logs moved to Settings > Logs.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../ToolsPage.scss', () => ({}));
jest.mock('../../components/tools/SiteImport', () => function Mock() { return <p>site import</p>; });
jest.mock('../../utils/api', () => ({
  apiGet: jest.fn(() => Promise.resolve({ ok: true, body: { data: [] } })),
  apiPost: jest.fn(),
}));

import ToolsPanel from '../ToolsPage';

global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

test('Tools lists Transfer and Migrate and no log', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<ToolsPanel embedded />));
  const labels = [...container.querySelectorAll('.sf-tools__nav-item')].map((b) => b.textContent.trim());
  expect(labels).toEqual(['Transfer', 'Migrate']);
  expect(container.textContent).not.toMatch(/What happened after each entry|Calls this site made|REST calls/);
  act(() => root.unmount());
  container.remove();
});

test('a Tools link to a log section opens Transfer, not a missing screen', async () => {
  window.location.hash = '#tab=tools&section=activity';
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<ToolsPanel embedded />));
  expect(container.querySelector('.sf-tools__nav-item.is-active').textContent.trim()).toBe('Transfer');
  act(() => root.unmount());
  container.remove();
  window.location.hash = '';
});
