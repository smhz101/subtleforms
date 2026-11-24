/**
 * A skipped step in the entry log shows its reason as a neutral note, not as
 * an error, with readable text for the conditions code (#134).
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
jest.mock('../../data', () => ({ apiClient: { get: jest.fn(), put: jest.fn() } }));

import { PipelineStepCard } from '../SubmissionDetailPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render(entries) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<PipelineStepCard step={{ stepId: 'mail_1', actionType: 'email', entries }} />));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const entry = (status, error) => ({ status, level: 'info', data: {}, error, createdAt: '2026-11-23 10:00:00' });

test('a skipped step shows the stored message in the neutral style', () => {
  const { container, unmount } = render([ entry('started', null), entry('skipped', 'Submitter emails are turned off in Settings, Email.') ]);
  expect(container.querySelector('.sf-pipe-status--skipped').textContent).toBe('Skipped');
  const note = container.querySelector('.sf-pipe-step__skip-note');
  expect(note.textContent).toBe('Submitter emails are turned off in Settings, Email.');
  expect(container.querySelector('.sf-pipe-error-msg')).toBeNull();
  unmount();
});

test('the conditions code reads as plain text', () => {
  const { container, unmount } = render([ entry('skipped', 'conditions_not_met') ]);
  expect(container.querySelector('.sf-pipe-step__skip-note').textContent).toBe('Its conditions did not match this entry.');
  unmount();
});

test('a failed step still shows its error in the error style', () => {
  const { container, unmount } = render([ entry('started', null), entry('failed', 'missing_recipient') ]);
  expect(container.querySelector('.sf-pipe-step__skip-note')).toBeNull();
  unmount();
});
