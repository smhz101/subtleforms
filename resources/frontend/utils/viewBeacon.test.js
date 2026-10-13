import { sendView, observeView, resetViewBeacon } from './viewBeacon';

describe('viewBeacon', () => {
  beforeEach(() => {
    resetViewBeacon();
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
  });

  afterEach(() => {
    delete global.fetch;
    delete window.IntersectionObserver;
  });

  it('posts once per form per page load', () => {
    const config = { restUrl: 'https://example.test/wp-json/subtleforms/v1/', nonce: 'abc' };
    expect(sendView(7, config)).toBe(true);
    expect(sendView(7, config)).toBe(false);
    expect(sendView(8, config)).toBe(true);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://example.test/wp-json/subtleforms/v1/forms/7/view');
    expect(options.method).toBe('POST');
    expect(options.headers['X-WP-Nonce']).toBe('abc');
    expect(options.body).toBe('{}');
  });

  it('does nothing when view tracking is off', () => {
    const el = document.createElement('div');
    observeView(el, 3, { restUrl: '/x', trackViews: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('waits until the form is visible', () => {
    let callback;
    const disconnect = jest.fn();
    window.IntersectionObserver = jest.fn((cb) => {
      callback = cb;
      return { observe: jest.fn(), disconnect };
    });

    const el = document.createElement('div');
    observeView(el, 5, { restUrl: '/wp-json/subtleforms/v1', trackViews: true });
    expect(global.fetch).not.toHaveBeenCalled();

    callback([{ isIntersecting: false }]);
    expect(global.fetch).not.toHaveBeenCalled();

    callback([{ isIntersecting: true }]);
    expect(disconnect).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('/wp-json/subtleforms/v1/forms/5/view');
  });
});
