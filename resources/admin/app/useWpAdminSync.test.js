import { adminUrlToRoute, historyMode } from './adminHistory';

describe('historyMode', () => {
  it('pushes only when an entry is opened on the same admin page', () => {
    expect(historyMode(null, { page: 'subtleforms-submissions', submission_id: '4' })).toBe('replace');
    expect(historyMode(
      { page: 'subtleforms-submissions', submission_id: '' },
      { page: 'subtleforms-submissions', submission_id: '4' }
    )).toBe('push');
    expect(historyMode(
      { page: 'subtleforms-submissions', submission_id: '4' },
      { page: 'subtleforms-submissions', submission_id: '5' }
    )).toBe('replace');
  });
});

describe('adminUrlToRoute', () => {
  it('keeps the tab and search when going back to the list', () => {
    window.subtleformsAdmin = { submissionsView: { reading_pane: 'right' } };
    const path = adminUrlToRoute('http://example.com/wp-admin/admin.php?page=subtleforms-submissions&tab=unread&search=ada');
    expect(path).toBe('/submissions?tab=unread&search=ada');
  });
});
