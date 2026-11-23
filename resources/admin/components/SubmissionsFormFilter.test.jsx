/**
 * Submissions Form filter: every form is listed (not only the newest 20), the
 * list can be searched and picking a form sets the filter.
 */
jest.mock('../../shared/allForms', () => ({ fetchAllForms: jest.fn() }));
import { act } from 'react';
import { createElement, render, unmountComponentAtNode, useState } from '@wordpress/element';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, fireEvent } from '@testing-library/dom';
import { fetchAllForms } from '../../shared/allForms';
import { useAllForms } from '../data/queries/forms';
import SubmissionsFormFilter, { buildFormOptions } from './SubmissionsFormFilter';

global.IS_REACT_ACT_ENVIRONMENT = true;
window.HTMLElement.prototype.scrollIntoView = jest.fn();

const forms = Array.from({ length: 120 }, (_, i) => ({
  id: i + 1,
  title: i === 0 ? 'Legacy survey' : `Form ${String(i + 1).padStart(3, '0')}`,
}));

function Harness({ onPick }) {
  const [value, setValue] = useState('all');
  const { data } = useAllForms();
  return createElement(SubmissionsFormFilter, {
    forms: data || [],
    value,
    onChange: (next) => {
      setValue(next);
      onPick(next);
    },
  });
}

describe('Submissions form filter', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    fetchAllForms.mockResolvedValue(forms);
  });
  afterEach(() => {
    unmountComponentAtNode(host);
    host.remove();
  });

  test('options are All forms first, then every form with its id', () => {
    const options = buildFormOptions([
      { id: 4, title: 'Contact' },
      { id: 9, title: '' },
    ]);
    expect(options.map((o) => o.label)).toEqual(['All forms', 'Contact (#4)', '(no title) (#9)']);
    expect(options.map((o) => o.value)).toEqual(['all', '4', '9']);
  });

  async function mount(onPick) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      render(
        createElement(QueryClientProvider, { client }, createElement(Harness, { onPick })),
        host
      );
    });
  }

  test('lists all 120 forms plus All forms, search narrows, selecting sets the filter', async () => {
    const onPick = jest.fn();
    await mount(onPick);
    const input = screen.getByRole('combobox', { name: 'Form' });
    await act(async () => {
      fireEvent.focus(input);
      fireEvent.click(input);
    });
    expect(screen.getAllByRole('option')).toHaveLength(121);

    await act(async () => {
      fireEvent.change(input, { target: { value: 'legacy' } });
    });
    const matches = screen.getAllByRole('option');
    expect(matches).toHaveLength(1);
    expect(matches[0].textContent).toContain('Legacy survey (#1)');

    await act(async () => {
      fireEvent.click(matches[0]);
    });
    expect(onPick).toHaveBeenCalledWith('1');
  });
});
