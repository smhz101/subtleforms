import { csvExportUrl, startCsvDownload } from './csvExport';

describe('csvExport', () => {
  beforeEach(() => {
    window.subtleformsAdmin = {
      exportCsvUrl: 'http://localhost/wp-admin/admin-post.php?action=subtleforms_export_csv',
      exportCsvNonce: 'abc123',
    };
  });
  afterEach(() => {
    delete window.subtleformsAdmin;
  });

  it('builds the download address from the filters and the nonce', () => {
    const url = new URL(csvExportUrl({ form_id: 7, status: 'completed', search: 'a b', range: '30days' }));
    expect(url.pathname).toBe('/wp-admin/admin-post.php');
    expect(url.searchParams.get('action')).toBe('subtleforms_export_csv');
    expect(url.searchParams.get('form_id')).toBe('7');
    expect(url.searchParams.get('status')).toBe('completed');
    expect(url.searchParams.get('search')).toBe('a b');
    expect(url.searchParams.get('range')).toBe('30days');
    expect(url.searchParams.get('_wpnonce')).toBe('abc123');
  });

  it('leaves out empty and "all" filters', () => {
    const url = new URL(csvExportUrl({ form_id: null, status: 'all', search: '', range: undefined }));
    expect([...url.searchParams.keys()].sort()).toEqual(['_wpnonce', 'action']);
  });

  it('starts a download by clicking a link, without fetching JSON', () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.href).toContain('action=subtleforms_export_csv');
      expect(this.hasAttribute('download')).toBe(true);
    });
    global.fetch = jest.fn();
    expect(startCsvDownload({ form_id: 3 })).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('does nothing when the page has no download address', () => {
    delete window.subtleformsAdmin;
    expect(startCsvDownload()).toBe(false);
  });
});
