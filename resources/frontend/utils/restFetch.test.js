describe('restFetch (FF-03)', () => {
  afterEach(() => {
    delete window.subtleformsFrontend;
    jest.resetModules();
  });

  const json = (status, body) => ({
    status,
    ok: status < 400,
    json: async () => body,
    clone() {
      return this;
    },
  });

  test('visitors send no nonce', async () => {
    window.subtleformsFrontend = { restUrl: '/wp-json/subtleforms/v1', nonce: '' };
    global.fetch = jest.fn(async () => json(200, {}));
    const { restFetch } = require('./restFetch');
    await restFetch('/submit', { method: 'POST', body: { a: 1 } });
    expect(global.fetch.mock.calls[0][1].headers['X-WP-Nonce']).toBeUndefined();
  });

  test('a stale nonce is retried once without it', async () => {
    window.subtleformsFrontend = { restUrl: '/wp-json/subtleforms/v1', nonce: 'old' };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(json(403, { code: 'rest_cookie_invalid_nonce' }))
      .mockResolvedValueOnce(json(200, { data: { success: true } }));
    const { restFetch } = require('./restFetch');
    const res = await restFetch('/submit', { method: 'POST', body: {} });
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][1].headers['X-WP-Nonce']).toBe('old');
    expect(global.fetch.mock.calls[1][1].headers['X-WP-Nonce']).toBeUndefined();
  });

  test('the page language goes with every request (PRO-04)', async () => {
    window.subtleformsFrontend = { restUrl: '/wp-json/subtleforms/v1', nonce: '', lang: 'fr' };
    global.fetch = jest.fn(async () => json(200, {}));
    const { restFetch } = require('./restFetch');
    await restFetch('/forms/66/schema');
    await restFetch('/submit', { method: 'POST', body: {} });
    expect(global.fetch.mock.calls[0][0]).toBe('/wp-json/subtleforms/v1/forms/66/schema?lang=fr');
    expect(global.fetch.mock.calls[1][0]).toBe('/wp-json/subtleforms/v1/submit?lang=fr');
  });

  test('plain permalinks get the language as an extra query argument', async () => {
    window.subtleformsFrontend = { restUrl: '/index.php?rest_route=/subtleforms/v1', lang: 'pt-br' };
    global.fetch = jest.fn(async () => json(200, {}));
    const { restFetch } = require('./restFetch');
    await restFetch('/forms/7/schema');
    expect(global.fetch.mock.calls[0][0]).toBe('/index.php?rest_route=/subtleforms/v1/forms/7/schema&lang=pt-br');
  });

  test('no language, no extra argument', async () => {
    window.subtleformsFrontend = { restUrl: '/wp-json/subtleforms/v1' };
    global.fetch = jest.fn(async () => json(200, {}));
    const { restFetch } = require('./restFetch');
    await restFetch('/forms/7/schema');
    expect(global.fetch.mock.calls[0][0]).toBe('/wp-json/subtleforms/v1/forms/7/schema');
  });
});
