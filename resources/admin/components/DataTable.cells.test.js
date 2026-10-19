jest.mock('./DataTable.scss', () => ({}));
jest.mock('./TableSkeleton', () => () => null);
import { cellProps } from './DataTable';

describe('DataTable cells on a phone (UX2-19)', () => {
  test('the first column is the card title and has no label', () => {
    expect(cellProps({ key: 'title', title: 'Form Name' }, 0)).toEqual({
      role: 'cell',
      'data-column': 'title',
      'data-label': undefined,
      'data-primary': 'true',
    });
  });

  test('other columns carry their name for the card line', () => {
    expect(cellProps({ key: 'status', title: 'Status' }, 2)['data-label']).toBe('Status');
  });

  test('a column without a text title (row actions) has no label', () => {
    expect(cellProps({ key: 'actions', title: null }, 5)['data-label']).toBeUndefined();
    expect(cellProps({ key: 'x', title: null, label: 'Extra' }, 3)['data-label']).toBe('Extra');
  });
});
