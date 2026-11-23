/**
 * Free #145: the builder sends the version of the form it loaded with every
 * save, and keeps the version its own save returns.
 */
import apiFetch from '@wordpress/api-fetch';
import { apiPost, apiPut } from './api';
import { storeFormETag, getFormETag, clearFormETag } from '../data/apiClient';

jest.mock('@wordpress/api-fetch', () => {
  const fn = jest.fn();
  fn.use = jest.fn();
  return { __esModule: true, default: fn };
});

const reply = (status, body, etag) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name === 'ETag' && etag ? etag : null) },
  text: async () => JSON.stringify(body),
});

const sentHeaders = (call) => apiFetch.mock.calls[call][0].headers || {};

describe('form version on builder saves', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    clearFormETag(7);
  });

  it('sends the loaded version with a schema save', async () => {
    storeFormETag(7, 'W/"loaded"');
    apiFetch.mockResolvedValue(reply(200, { data: { draft: true } }, 'W/"next"'));

    await apiPost('/forms/7/schema', { schema: {}, activate: false });

    expect(sentHeaders(0)['If-Match']).toBe('W/"loaded"');
  });

  it('stores the version a successful save returns and sends it on the next save', async () => {
    storeFormETag(7, 'W/"loaded"');
    apiFetch
      .mockResolvedValueOnce(reply(200, { data: { draft: true } }, 'W/"after-first"'))
      .mockResolvedValueOnce(reply(200, { data: { draft: true } }, 'W/"after-second"'));

    await apiPost('/forms/7/schema', { schema: {}, activate: false });
    expect(getFormETag(7)).toBe('W/"after-first"');

    await apiPost('/forms/7/schema', { schema: {}, activate: true });
    expect(sentHeaders(1)['If-Match']).toBe('W/"after-first"');
    expect(getFormETag(7)).toBe('W/"after-second"');
  });

  it('takes the version from the response body when the header is missing', async () => {
    apiFetch.mockResolvedValue(reply(200, { data: { etag: 'W/"in-body"' } }));
    await apiPost('/forms/7/schema', { schema: {} });
    expect(getFormETag(7)).toBe('W/"in-body"');
  });

  it('sends the version with a form update as well', async () => {
    storeFormETag(7, 'W/"loaded"');
    apiFetch.mockResolvedValue(reply(200, { data: { success: true } }, 'W/"renamed"'));

    await apiPut('/forms/7', { status: 'published' });

    expect(sentHeaders(0)['If-Match']).toBe('W/"loaded"');
    expect(getFormETag(7)).toBe('W/"renamed"');
  });

  it('sends nothing when no version is known, so the server still accepts the save', async () => {
    apiFetch.mockResolvedValue(reply(200, { data: {} }));
    await apiPost('/forms/7/schema', { schema: {} });
    expect(sentHeaders(0)['If-Match']).toBeUndefined();
  });

  it('leaves the version check off when asked to replace', async () => {
    storeFormETag(7, 'W/"loaded"');
    apiFetch.mockResolvedValue(reply(201, { data: { active: true } }, 'W/"replaced"'));

    await apiPost('/forms/7/schema', { schema: {} }, { ifMatch: false });

    expect(sentHeaders(0)['If-Match']).toBeUndefined();
    expect(apiFetch.mock.calls[0][0].ifMatch).toBeUndefined();
    expect(getFormETag(7)).toBe('W/"replaced"');
  });

  it('keeps its version when a save is refused', async () => {
    storeFormETag(7, 'W/"loaded"');
    apiFetch.mockRejectedValue(
      reply(409, { error: { code: 'version_conflict', meta: { current_etag: 'W/"theirs"' } } }, 'W/"theirs"')
    );

    const result = await apiPost('/forms/7/schema', { schema: {} });

    expect(result.status).toBe(409);
    expect(getFormETag(7)).toBe('W/"loaded"');
  });

  it('does not touch other requests', async () => {
    storeFormETag(7, 'W/"loaded"');
    apiFetch.mockResolvedValue(reply(200, { data: {} }));
    await apiPost('/forms/8/schema', { schema: {} });
    await apiPost('/submissions/bulk', {});
    expect(sentHeaders(0)['If-Match']).toBeUndefined();
    expect(sentHeaders(1)['If-Match']).toBeUndefined();
  });
});
