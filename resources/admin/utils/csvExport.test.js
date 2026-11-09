import {
  csvExportUrl,
  startCsvDownload,
  startCsvDownloadOfIds,
  freshExportNonce,
  exportFlagNotice,
  readExportFlag,
} from './csvExport';
import { apiPost } from './api';

jest.mock('./api', () => ({ apiPost: jest.fn() }));

describe('csvExport', () => {
  beforeEach(() => {
    window.subtleformsAdmin = {
      exportCsvUrl: 'http://localhost/wp-admin/admin-post.php?action=subtleforms_export_csv',
      exportCsvNonce: 'abc123',
    };
    apiPost.mockReset();
    apiPost.mockResolvedValue({ ok: true, status: 200, body: { data: { nonce: 'fresh456' } } });
  });
  afterEach(() => {
    delete window.subtleformsAdmin;
    jest.restoreAllMocks();
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

  it('leaves out empty filters and the "all" of the status and range dropdowns', () => {
    const url = new URL(csvExportUrl({ form_id: null, status: 'all', search: '', range: 'all', after: undefined }));
    expect([...url.searchParams.keys()].sort()).toEqual(['_wpnonce', 'action']);
  });

  it('keeps a search for the word "all"', () => {
    const url = new URL(csvExportUrl({ status: 'all', range: 'all', search: 'all' }));
    expect(url.searchParams.get('search')).toBe('all');
    expect(url.searchParams.has('status')).toBe(false);
    expect(url.searchParams.has('range')).toBe(false);
  });

  it('uses the nonce it is given instead of the one from page load', () => {
    expect(new URL(csvExportUrl({}, 'other')).searchParams.get('_wpnonce')).toBe('other');
  });

  describe('freshExportNonce', () => {
    it('asks the server for a new nonce and remembers it', async () => {
      await expect(freshExportNonce()).resolves.toBe('fresh456');
      expect(apiPost).toHaveBeenCalledWith('/submissions/export-nonce', {});
      expect(window.subtleformsAdmin.exportCsvNonce).toBe('fresh456');
    });

    it('falls back to the page nonce when the call fails', async () => {
      apiPost.mockResolvedValue({ ok: false, status: 403, body: null });
      await expect(freshExportNonce()).resolves.toBe('abc123');
    });

    describe('when the REST nonce of a long open screen has expired', () => {
      afterEach(() => {
        delete window.wp;
        delete global.fetch;
      });

      it('renews the REST nonce the way core does, then asks again', async () => {
        const middleware = { nonce: 'old' };
        window.wp = { apiFetch: { nonceMiddleware: middleware, nonceEndpoint: 'http://localhost/wp-admin/admin-ajax.php?action=rest-nonce' } };
        global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('0a1b2c3d4e\n') });
        apiPost
          .mockResolvedValueOnce({ ok: false, status: 403, body: { code: 'rest_cookie_invalid_nonce' } })
          .mockResolvedValueOnce({ ok: true, status: 200, body: { data: { nonce: 'fresh789' } } });
        await expect(freshExportNonce()).resolves.toBe('fresh789');
        expect(global.fetch).toHaveBeenCalledWith('http://localhost/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'same-origin' });
        expect(middleware.nonce).toBe('0a1b2c3d4e');
        expect(apiPost).toHaveBeenCalledTimes(2);
      });

      it('uses the page nonce when the REST nonce cannot be renewed', async () => {
        window.wp = { apiFetch: { nonceMiddleware: { nonce: 'old' }, nonceEndpoint: 'http://localhost/x' } };
        global.fetch = jest.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('') });
        apiPost.mockResolvedValue({ ok: false, status: 403, body: null });
        await expect(freshExportNonce()).resolves.toBe('abc123');
        expect(apiPost).toHaveBeenCalledTimes(1);
      });

      it('does not renew for an error that is not a 403', async () => {
        global.fetch = jest.fn();
        window.wp = { apiFetch: { nonceMiddleware: { nonce: 'old' }, nonceEndpoint: 'http://localhost/x' } };
        apiPost.mockResolvedValue({ ok: false, status: 500, body: null });
        await expect(freshExportNonce()).resolves.toBe('abc123');
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    it('falls back to the page nonce when the call throws or answers without a nonce', async () => {
      apiPost.mockRejectedValueOnce(new Error('offline'));
      await expect(freshExportNonce()).resolves.toBe('abc123');
      apiPost.mockResolvedValueOnce({ ok: true, status: 200, body: { data: {} } });
      await expect(freshExportNonce()).resolves.toBe('abc123');
    });
  });

  describe('startCsvDownload', () => {
    it('follows the address with the fresh nonce, as a navigation that can be redirected back', async () => {
      const seen = [];
      jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
        seen.push({ href: this.href, download: this.hasAttribute('download') });
      });
      global.fetch = jest.fn();
      await expect(startCsvDownload({ form_id: 3 })).resolves.toBe('started');
      expect(seen).toHaveLength(1);
      expect(seen[0].href).toContain('action=subtleforms_export_csv');
      expect(seen[0].href).toContain('form_id=3');
      expect(seen[0].href).toContain('_wpnonce=fresh456');
      expect(seen[0].download).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('still downloads with the page nonce when the new one cannot be had', async () => {
      apiPost.mockRejectedValue(new Error('offline'));
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
        expect(this.href).toContain('_wpnonce=abc123');
      });
      await expect(startCsvDownload({})).resolves.toBe('started');
      expect(click).toHaveBeenCalledTimes(1);
    });

    it('starts nothing when the list shows no matching entries', async () => {
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      await expect(startCsvDownload({ status: 'spam' }, { total: 0 })).resolves.toBe('empty');
      expect(click).not.toHaveBeenCalled();
      expect(apiPost).not.toHaveBeenCalled();
    });

    it('downloads when the count is not known yet or is above zero', async () => {
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      await expect(startCsvDownload({}, { total: null })).resolves.toBe('started');
      await expect(startCsvDownload({}, { total: 12 })).resolves.toBe('started');
      expect(click).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the page has no download address', async () => {
      delete window.subtleformsAdmin;
      await expect(startCsvDownload()).resolves.toBe('unavailable');
    });
  });

  describe('startCsvDownloadOfIds', () => {
    it('posts the ids and the fresh nonce to the download address', async () => {
      let posted = null;
      jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function () {
        posted = {
          method: this.method,
          action: this.action,
          fields: [...this.querySelectorAll('input')].map((input) => [input.name, input.value]),
        };
      });
      await expect(startCsvDownloadOfIds([4, '9', 0, 'x'])).resolves.toBe('started');
      expect(posted.method).toBe('post');
      expect(posted.action).toContain('action=subtleforms_export_csv');
      expect(posted.fields).toEqual([
        ['_wpnonce', 'fresh456'],
        ['ids[]', '4'],
        ['ids[]', '9'],
      ]);
      expect(document.querySelector('form')).toBeNull();
    });

    it('starts nothing for an empty selection', async () => {
      const submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
      await expect(startCsvDownloadOfIds([])).resolves.toBe('empty');
      expect(submit).not.toHaveBeenCalled();
    });

    it('does nothing when the page has no download address', async () => {
      delete window.subtleformsAdmin;
      await expect(startCsvDownloadOfIds([1])).resolves.toBe('unavailable');
    });
  });

  describe('the notice for a refused download', () => {
    it('words each flag the server sends back', () => {
      expect(exportFlagNotice('empty').message).toBe('No submissions to export');
      expect(exportFlagNotice('expired').message).toBe('The export link expired, reload the page and try again');
      expect(exportFlagNotice('forbidden').message).toBe('You do not have permission to export');
      expect(exportFlagNotice('expired').type).toBe('error');
    });

    it('ignores a missing or unknown flag', () => {
      expect(exportFlagNotice(null)).toBeNull();
      expect(exportFlagNotice('nonsense')).toBeNull();
    });

    it('reads the flag from the page address', () => {
      expect(readExportFlag('?page=subtleforms-submissions&sf_export=empty')).toBe('empty');
      expect(readExportFlag('?page=subtleforms-submissions')).toBeNull();
    });
  });
});
