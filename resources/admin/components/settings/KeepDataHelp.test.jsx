/**
 * The keep-data toggle on Advanced settings explains what deleting the plugin does.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../../data/apiClient', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({})) },
}));

import AdvancedSettings from './AdvancedSettings';

global.IS_REACT_ACT_ENVIRONMENT = true;

test('the help text says what deleting the plugin does with the data', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <AdvancedSettings
      settings={{ keep_data_on_uninstall: true }}
      updateSetting={() => {}}
      fieldErrors={{}}
    />
  ));
  const text = container.textContent;
  expect(text).toContain('Keep my data when the plugin is deleted');
  expect(text).toContain('When this is on, deleting SubtleForms from the Plugins screen leaves its forms, entries, settings and uploaded files in place, so reinstalling brings them back.');
  expect(text).toContain('When it is off, deleting removes them for good. Data that other plugins store is never removed.');
  expect(text).not.toContain('Off by default.');
  expect(text).not.toContain(String.fromCharCode(8212));
  act(() => root.unmount());
  container.remove();
});
