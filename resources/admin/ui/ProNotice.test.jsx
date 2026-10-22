import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ProNotice, { ProUpgradeLink } from './ProNotice';

jest.mock('./ProNotice.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

afterEach(() => {
  delete window.subtleformsAdmin;
});

test('shows the label, a Pro tag, the help and an upgrade link, and no control', () => {
  window.subtleformsAdmin = { proUrl: 'https://example.test/pro' };
  const { container, unmount } = mount(<ProNotice label='Allow several files' help='Part of Pro.' feature='uploads.multiple' />);
  expect(container.textContent).toContain('Allow several files');
  expect(container.querySelector('.sf-pro-tag').textContent).toBe('Pro');
  expect(container.querySelectorAll('input, select, textarea, [role="switch"]')).toHaveLength(0);
  const link = container.querySelector('a');
  expect(link.getAttribute('href')).toContain('example.test/pro');
  expect(link.getAttribute('href')).toContain('uploads.multiple');
  unmount();
});

test('the link opens the upgrade modal for the feature', () => {
  const seen = jest.fn();
  window.addEventListener('sf:upgrade:required', seen);
  const { container, unmount } = mount(<ProUpgradeLink feature='fields.picture_choice' label='Picture Choice' />);
  act(() => container.querySelector('a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  expect(seen).toHaveBeenCalledTimes(1);
  expect(seen.mock.calls[0][0].detail).toEqual({ featureKey: 'fields.picture_choice', label: 'Picture Choice' });
  window.removeEventListener('sf:upgrade:required', seen);
  unmount();
});

test('white label sites show no upgrade link or tag', () => {
  window.subtleformsAdmin = { branding: { hideUpgrade: true } };
  const { container, unmount } = mount(<ProNotice label='Allow several files' feature='uploads.multiple' />);
  expect(container.querySelector('a')).toBeNull();
  expect(container.querySelector('.sf-pro-tag')).toBeNull();
  unmount();
});
