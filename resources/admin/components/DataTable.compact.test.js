/**
 * Compact list (a narrow pane): bulk bar of icon buttons with names, a
 * compact footer, no table.
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
import { screen, fireEvent, within } from '@testing-library/dom';
import DataTable, { rangeText } from './DataTable';

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});

describe('rangeText', () => {
  test('reads "1 to 20 of 739"', () => {
    expect(rangeText(1, 20, 739)).toBe('1 to 20 of 739');
    expect(rangeText(37, 20, 739)).toBe('721 to 739 of 739');
  });
});

describe('DataTable compact mode', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    unmountComponentAtNode(host);
    host.remove();
  });

  const rows = [
    { id: 1, title: 'One' },
    { id: 2, title: 'Two' },
  ];
  const actions = () => [
    { key: 'read', label: 'Mark read', icon: createElement('i'), onClick: jest.fn() },
    { key: 'star', label: 'Star', icon: createElement('i'), onClick: jest.fn() },
    { key: 'trash', label: 'Move to Trash', icon: createElement('i'), onClick: jest.fn(), isDestructive: true },
    { key: 'flag', label: 'Mark as flagged', inMenu: true, onClick: jest.fn() },
  ];

  const mount = async (props) => {
    await act(async () => {
      render(
        createElement(DataTable, {
          columns: [{ key: 'title', title: 'Title', sortable: true }],
          data: rows,
          totalItems: 739,
          currentPage: 1,
          perPage: 20,
          selectable: true,
          compact: true,
          renderCompactRow: (row) => createElement('span', null, row.title),
          ...props,
        }),
        host
      );
    });
  };

  test('draws list items, not a table, with the compact footer', async () => {
    await mount({});
    expect(host.querySelector('table')).toBeNull();
    expect(host.querySelectorAll('.sf-data-table__row--compact')).toHaveLength(2);
    expect(screen.getByText('1 to 20 of 739')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeTruthy();
  });

  test('selecting shows "N selected" and icon buttons that each carry their name', async () => {
    const list = actions();
    await mount({ selectedItems: [1, 2], bulkActions: list });
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(within(bar).getByText('2 selected')).toBeTruthy();
    ['Mark read', 'Star', 'Move to Trash'].forEach((name) => {
      expect(within(bar).getByRole('button', { name })).toBeTruthy();
    });
    // The flag action is not an icon: it lives in the More menu.
    expect(within(bar).queryByRole('button', { name: 'Mark as flagged' })).toBeNull();
    expect(within(bar).getByRole('button', { name: 'More actions' })).toBeTruthy();

    await act(async () => {
      fireEvent.click(within(bar).getByRole('button', { name: 'Star' }));
    });
    expect(list[1].onClick).toHaveBeenCalledWith([1, 2]);
  });

  test('Clear empties the selection', async () => {
    const onSelectionChange = jest.fn();
    await mount({ selectedItems: [1], bulkActions: actions(), onSelectionChange });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    });
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  test('the rows-per-page select reports the new size', async () => {
    const onPerPageChange = jest.fn();
    await mount({ onPerPageChange });
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '50' } });
    });
    expect(onPerPageChange).toHaveBeenCalledWith(50);
  });

  test('previous is off on page 1 and next is off on the last page', async () => {
    await mount({});
    expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
    unmountComponentAtNode(host);
    await mount({ currentPage: 37 });
    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);
  });
});
