/**
 * Files uploaded inside a Repeater group get download links in the entry
 * (FA-03).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SubmissionDetailPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => () => null);
jest.mock('../../data', () => ({ apiClient: {} }));
jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));

import { RepeaterTable } from '../SubmissionDetailPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

test('a file in a group is a download link, not its stored record', () => {
  window.subtleformsAdmin = { ajaxUrl: '/wp-admin/admin-ajax.php', fileNonce: 'n1' };
  const id = 'a'.repeat(32);
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(
      <RepeaterTable
        node={{ type: 'repeat_container', children: [{ type: 'file_upload', key: 'doc', label: 'Document' }] }}
        groups={[{ doc: [{ id, name: 'small.txt', size: 12, type: 'text/plain' }] }]}
        submissionId={807}
      />
    );
  });
  const link = container.querySelector('a');
  expect(link.textContent).toContain('small.txt');
  expect(link.getAttribute('href')).toContain(`file=${id}`);
  expect(link.getAttribute('href')).toContain('entry=807');
  expect(container.textContent).not.toContain('"id"');
  act(() => root.unmount());
});
