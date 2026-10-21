/**
 * An empty list keeps its footer when the table asks for it: "0 results",
 * previous and next disabled, and the rows-per-page select.
 */
jest.mock('./DataTable.scss', () => ({}));
jest.mock('./IconAction.scss', () => ({}));
jest.mock('./TableSkeleton', () => () => null);
jest.mock('../hooks/usePhoneLayout', () => () => false);
jest.mock('../ui/Icon', () => {
  const stub = () => null;
  const Icon = new Proxy({}, { get: () => stub });
  return { __esModule: true, default: Icon, Icon };
});
import { act } from 'react';
import { createElement, render, unmountComponentAtNode } from '@wordpress/element';
import { screen, fireEvent } from '@testing-library/dom';
import DataTable, { rangeText } from './DataTable';

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});

describe('rangeText with no rows', () => {
  test('reads "0 results"', () => {
    expect(rangeText(1, 20, 0)).toBe('0 results');
  });
});

describe('DataTable with no rows', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    unmountComponentAtNode(host);
    host.remove();
  });

  const mount = (props) =>
    act(() => {
      render(
        createElement(DataTable, {
          columns: [{ key: 'title', title: 'Title' }],
          data: [],
          totalItems: 0,
          currentPage: 1,
          perPage: 20,
          onPageChange: jest.fn(),
          onPerPageChange: jest.fn(),
          emptyMessage: 'Nothing here',
          ...props,
        }),
        host
      );
    });

  test.each([['compact', true], ['table', false]])('%s layout shows the footer', (_name, compact) => {
    const onPerPageChange = jest.fn();
    mount({ alwaysShowPagination: true, compact, renderCompactRow: () => null, onPerPageChange });

    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByText('0 results')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' }).getAttribute('aria-disabled') === 'true' || screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Next page' }).getAttribute('aria-disabled') === 'true' || screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);

    const select = screen.getByLabelText('Rows per page');
    expect(select.value).toBe('20');
    act(() => {
      fireEvent.change(select, { target: { value: '50' } });
    });
    expect(onPerPageChange).toHaveBeenCalledWith(50);
  });

  test('without the prop an empty list shows only the message', () => {
    mount({});
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.queryByText('0 results')).toBeNull();
    expect(screen.queryByLabelText('Rows per page')).toBeNull();
  });
});
