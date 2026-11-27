/**
 * Extensions shell: lists what the endpoint returns and shows an error when it fails.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../components/AdminShell', () => function AdminShellMock({ children, title, description, isLoading, error }) {
  return (
    <div data-title={title}>
      <p className='mock-description'>{description}</p>
      {isLoading ? <p className='mock-loading'>loading</p> : null}
      {error ? <p className='mock-error'>{error}</p> : null}
      {children}
    </div>
  );
});
jest.mock('../data', () => ({ useExtensions: jest.fn() }));

import { useExtensions } from '../data';
import ExtensionsPage from './ExtensionsPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function mount(result) {
  useExtensions.mockReturnValue({ data: undefined, isLoading: false, error: null, ...result });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ExtensionsPage />);
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('lists title, plan and status of each entry', async () => {
  await mount({
    data: {
      entries: [
        { slug: 'mailchimp', title: 'Mailchimp', plan: 'free', status: 'included' },
        { slug: 'payments', title: 'Payments', plan: 'starter', status: 'locked' },
      ],
    },
  });
  const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
  expect(items).toEqual(['Mailchimp Free, Included', 'Payments Starter, Locked']);
  expect(container.querySelector('.mock-description').textContent).toBe('Add what this site needs to SubtleForms.');
});

test('shows an error message when the request fails', async () => {
  await mount({ error: new Error('Request failed') });
  expect(container.querySelector('.mock-error').textContent).toBe('Request failed');
  expect(container.querySelectorAll('li')).toHaveLength(0);
});
