import { trackFunnel, fieldKeyOf, stepOf, SUBMITTED_EVENT } from './funnelTracker';

const CONFIG = { restUrl: 'https://example.test/wp-json/subtleforms/v1/', trackFunnel: true };

/** A window of our own, so listeners do not leak between tests. */
function fakeWindow(userAgent = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36') {
  const win = new EventTarget();
  win.document = new EventTarget();
  win.document.visibilityState = 'visible';
  win.navigator = { userAgent, sendBeacon: jest.fn(() => true) };
  win.fetch = jest.fn(() => Promise.resolve({ ok: true }));
  win.URLSearchParams = URLSearchParams;
  win.Blob = Blob;
  return win;
}

function buildForm({ steps = false } = {}) {
  const container = document.createElement('div');
  container.innerHTML = `
    <div ${steps ? 'data-sf-step="1"' : ''}>
      <form>
        <div data-sf-key="name"><input id="name" name="name" /></div>
        <div data-sf-key="address">
          <div data-sf-key="city"><input id="city" name="address[city]" /></div>
        </div>
        <div data-sf-key="phone"><input id="phone" name="phone" type="tel" /></div>
        <button id="send" type="submit">Send</button>
      </form>
    </div>`;
  document.body.appendChild(container);
  return container;
}

const focus = (el) => el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
const type = (el, value) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const sentParams = (win, call = 0) => {
  const [url, init] = win.fetch.mock.calls[call];
  return { url, params: Object.fromEntries(new URLSearchParams(init.body)) };
};

describe('funnelTracker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sends nothing when the visitor never touched the form', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    win.dispatchEvent(new Event('pagehide'));
    expect(win.fetch).not.toHaveBeenCalled();
  });

  it('records the start and the last field touched, and sends one beacon on leaving', () => {
    const win = fakeWindow();
    const container = buildForm();
    const handle = trackFunnel(container, 5, CONFIG, win);

    focus(container.querySelector('#name'));
    expect(handle.state().started).toBe(true);
    type(container.querySelector('#name'), 'Ada Lovelace');
    focus(container.querySelector('#phone'));
    type(container.querySelector('#phone'), '555 0100');

    win.document.visibilityState = 'hidden';
    win.document.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('pagehide'));

    expect(win.fetch).toHaveBeenCalledTimes(1);
    const { url, params } = sentParams(win);
    expect(url).toBe('https://example.test/wp-json/subtleforms/v1/forms/5/funnel');
    expect(params).toEqual({ a: 'drop', f: 'phone', s: '-1' });
  });

  it('never sends a value', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    type(container.querySelector('#name'), 'secret-answer@example.test');
    win.dispatchEvent(new Event('pagehide'));

    const [, init] = win.fetch.mock.calls[0];
    expect(String(init.body)).not.toContain('secret');
    expect(String(init.body)).not.toContain('example.test');
    expect(Object.keys(sentParams(win).params).sort()).toEqual(['a', 'f', 's']);
  });

  it('reports the outermost field and the step', () => {
    const win = fakeWindow();
    const container = buildForm({ steps: true });
    trackFunnel(container, 9, CONFIG, win);
    focus(container.querySelector('#city'));
    win.dispatchEvent(new Event('pagehide'));
    expect(sentParams(win).params).toEqual({ a: 'drop', f: 'address', s: '1' });
  });

  it('sends nothing after the form was sent', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    type(container.querySelector('#name'), 'Ada');
    win.document.dispatchEvent(new CustomEvent(SUBMITTED_EVENT, { detail: { formId: 5 } }));
    win.dispatchEvent(new Event('pagehide'));
    expect(win.fetch).not.toHaveBeenCalled();
  });

  it('ignores the sent event of another form on the page', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    type(container.querySelector('#name'), 'Ada');
    win.document.dispatchEvent(new CustomEvent(SUBMITTED_EVENT, { detail: { formId: 6 } }));
    win.dispatchEvent(new Event('pagehide'));
    expect(win.fetch).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while a classic post is leaving the page', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    type(container.querySelector('#name'), 'Ada');
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    win.dispatchEvent(new Event('pagehide'));
    expect(win.fetch).not.toHaveBeenCalled();
  });

  it('counts a failed submit followed by leaving as a drop', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    type(container.querySelector('#name'), 'Ada');
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // Validation puts focus back on a field.
    focus(container.querySelector('#phone'));
    win.dispatchEvent(new Event('pagehide'));
    expect(sentParams(win).params.f).toBe('phone');
  });

  it('takes back the drop when the visitor returns and sends the form', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    type(container.querySelector('#name'), 'Ada');
    win.document.visibilityState = 'hidden';
    win.document.dispatchEvent(new Event('visibilitychange'));
    win.document.visibilityState = 'visible';
    win.document.dispatchEvent(new CustomEvent(SUBMITTED_EVENT, { detail: { formId: 5 } }));

    expect(win.fetch).toHaveBeenCalledTimes(2);
    expect(sentParams(win, 1).params).toEqual({ a: 'undo', pf: 'name', ps: '-1' });
  });

  it('moves the drop when the visitor returns and leaves at another field', () => {
    const win = fakeWindow();
    const container = buildForm();
    trackFunnel(container, 5, CONFIG, win);
    type(container.querySelector('#name'), 'Ada');
    win.dispatchEvent(new Event('pagehide'));
    win.dispatchEvent(new Event('pagehide'));
    expect(win.fetch).toHaveBeenCalledTimes(1);

    focus(container.querySelector('#phone'));
    win.dispatchEvent(new Event('pagehide'));
    expect(sentParams(win, 1).params).toEqual({ a: 'move', f: 'phone', s: '-1', pf: 'name', ps: '-1' });
  });

  it('stays off when tracking is off, for robots and without fetch or sendBeacon', () => {
    const container = buildForm();
    expect(trackFunnel(container, 5, { ...CONFIG, trackFunnel: false }, fakeWindow())).toBeNull();
    expect(trackFunnel(container, 5, CONFIG, fakeWindow('Googlebot/2.1'))).toBeNull();
    expect(trackFunnel(container, 5, CONFIG, fakeWindow('Mozilla/5.0 HeadlessChrome/130.0'))).toBeNull();
    const noTransport = fakeWindow();
    delete noTransport.fetch;
    delete noTransport.navigator.sendBeacon;
    expect(trackFunnel(container, 5, CONFIG, noTransport)).toBeNull();
    expect(trackFunnel(container, 0, CONFIG, fakeWindow())).toBeNull();
  });

  it('reads keys and steps from the markup', () => {
    const container = buildForm({ steps: true });
    expect(fieldKeyOf(container.querySelector('#city'), container)).toBe('address');
    expect(fieldKeyOf(container.querySelector('#send'), container)).toBe('');
    expect(stepOf(container.querySelector('#city'))).toBe(1);
    expect(stepOf(document.body)).toBe(-1);
  });
});
