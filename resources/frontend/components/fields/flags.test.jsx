/**
 * Country flags (2.7.2): the "Show country flags" setting of the Phone and
 * Country fields. Flags are decorative images from one sprite file; with the
 * setting off nothing changes.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import fs from 'fs';
import path from 'path';
import PhoneField from './PhoneField';
import CountrySelect from './CountrySelect';
import FlagIcon from './FlagIcon';
import { fieldGroups, FIELD_GROUPS } from './lazyFields';
import { flagCode, flagHref, flagSpriteUrl, forgetInlineSprite, isCrossOrigin } from '../../../shared/flagSprite';
import { flagsOn } from '../../../shared/flagsOn';
import { COUNTRIES } from '../../../shared/countries';
import { phoneCountries } from '../../../shared/phone';

const { buildSprite } = require('../../../../bin/build-flag-sprite');

global.IS_REACT_ACT_ENVIRONMENT = true;

const SPRITE = 'https://example.test/wp-content/plugins/subtleforms/build/frontend/flags.svg';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, text: () => Promise.resolve('') }));
  forgetInlineSprite(document);
  window.subtleformsFrontend = { assetsUrl: 'https://example.test/wp-content/plugins/subtleforms/build/frontend/' };
  delete window.subtleformsAdmin;
});

afterEach(() => {
  delete window.subtleformsFrontend;
  delete window.subtleformsAdmin;
});

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const click = (el) => act(() => el.click());

function type(input, text) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const useHref = (el) => el.querySelector('use').getAttribute('href');

describe('phone country list with flags', () => {
  const phone = (props = {}) =>
    mount(<PhoneField inputId='p1' name='p' config={{ enableCountryCode: true, defaultCountry: 'PK' }} value='' onChange={() => {}} {...props} />);

  test('on: the button and every option show a flag that is hidden from screen readers', () => {
    const { container, unmount } = phone({ flagImages: true });
    const trigger = container.querySelector('.subtleforms-phone__trigger');
    const flag = trigger.querySelector('.subtleforms-phone__flag');
    expect(flag.getAttribute('aria-hidden')).toBe('true');
    expect(flag.querySelector('svg.subtleforms-flag').getAttribute('aria-hidden')).toBe('true');
    expect(useHref(flag)).toBe(`${SPRITE}#sf-pk`);
    expect(trigger.querySelector('.subtleforms-phone__dial').textContent).toBe('+92');

    click(trigger);
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(100);
    options.forEach((option) => {
      expect(option.querySelectorAll('svg.subtleforms-flag')).toHaveLength(1);
      expect(option.querySelector('.subtleforms-phone__flag').getAttribute('aria-hidden')).toBe('true');
    });
    const pakistan = [...options].find((option) => option.textContent.includes('Pakistan'));
    expect(pakistan.textContent).toContain('+92');
    expect(useHref(pakistan)).toBe(`${SPRITE}#sf-pk`);
    unmount();
  });

  test('off: no image anywhere, the letters stay as before', () => {
    const { container, unmount } = phone();
    const trigger = container.querySelector('.subtleforms-phone__trigger');
    expect(trigger.querySelector('svg.subtleforms-flag')).toBeNull();
    expect(trigger.querySelector('.subtleforms-phone__flag').textContent).toBe('PK');
    click(trigger);
    expect(container.querySelector('svg.subtleforms-flag')).toBeNull();
    expect(container.querySelector('use')).toBeNull();
    unmount();
  });

  test('the accessible name of the button is the same with and without flags', () => {
    const off = phone();
    const nameOff = off.container.querySelector('.subtleforms-phone__trigger').getAttribute('aria-label');
    off.unmount();
    const on = phone({ flagImages: true });
    const nameOn = on.container.querySelector('.subtleforms-phone__trigger').getAttribute('aria-label');
    on.unmount();
    expect(nameOn).toBe('Country code, Pakistan +92');
    expect(nameOn).toBe(nameOff);
  });

  test('search by name and by code still works, and the results keep their flags', () => {
    const { container, unmount } = phone({ flagImages: true });
    click(container.querySelector('.subtleforms-phone__trigger'));
    const search = container.querySelector('.subtleforms-phone__search');
    type(search, 'pakis');
    let options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Pakistan');
    expect(options[0].querySelector('svg.subtleforms-flag')).not.toBeNull();
    type(search, '+44');
    options = [...container.querySelectorAll('[role="option"]')];
    expect(options.some((option) => option.textContent.includes('United Kingdom'))).toBe(true);
    unmount();
  });

  test('picking a country shows its flag and dial code, and stores the number as before', () => {
    const onChange = jest.fn();
    const { container, unmount } = phone({ flagImages: true, onChange, config: { enableCountryCode: true, defaultCountry: 'US' } });
    click(container.querySelector('.subtleforms-phone__trigger'));
    const pakistan = [...container.querySelectorAll('[role="option"]')].find((o) => o.textContent.includes('Pakistan'));
    click(pakistan);
    const trigger = container.querySelector('.subtleforms-phone__trigger');
    expect(trigger.querySelector('.subtleforms-phone__dial').textContent).toBe('+92');
    expect(useHref(trigger)).toBe(`${SPRITE}#sf-pk`);
    expect(onChange).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('Appearance can still hide the flags', () => {
    const { container, unmount } = phone({ flagImages: true, showFlags: false });
    expect(container.querySelector('.subtleforms-phone__flag')).toBeNull();
    unmount();
  });
});

describe('country field with flags', () => {
  test('on: the selected country and the list show flags; off: letters only', () => {
    const on = mount(<CountrySelect inputId='c1' name='c' value='PK' onChange={() => {}} flagImages />);
    const trigger = on.container.querySelector('#c1');
    expect(trigger.querySelector('.subtleforms-picker__flag').getAttribute('aria-hidden')).toBe('true');
    expect(useHref(trigger)).toBe(`${SPRITE}#sf-pk`);
    click(trigger);
    const options = on.container.querySelectorAll('[role="option"]');
    expect(on.container.querySelectorAll('.subtleforms-picker__list svg.subtleforms-flag').length).toBeGreaterThan(100);
    expect(options.length).toBeGreaterThan(100);
    const search = on.container.querySelector('.subtleforms-picker__search');
    type(search, 'pak');
    const found = [...on.container.querySelectorAll('[role="option"]')].filter(
      (option) => !option.textContent.includes('Clear selection')
    );
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toContain('Pakistan');
    expect(found[0].querySelector('svg.subtleforms-flag')).not.toBeNull();
    on.unmount();

    const off = mount(<CountrySelect inputId='c2' name='c' value='PK' onChange={() => {}} />);
    expect(off.container.querySelector('svg.subtleforms-flag')).toBeNull();
    expect(off.container.querySelector('.subtleforms-picker__flag').textContent).toBe('PK');
    off.unmount();
  });
});

describe('FlagIcon', () => {
  test('falls back to the two letters when the sprite address is unknown', () => {
    delete window.subtleformsFrontend;
    const { container, unmount } = mount(<span><FlagIcon code='pk' /></span>);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('PK');
    unmount();
  });

  test('the builder gets the sprite address from the admin data', () => {
    delete window.subtleformsFrontend;
    window.subtleformsAdmin = { flagSpriteUrl: 'https://example.test/admin/flags.svg' };
    expect(flagSpriteUrl()).toBe('https://example.test/admin/flags.svg');
    const { container, unmount } = mount(<FlagIcon code='GB' />);
    expect(useHref(container)).toBe('https://example.test/admin/flags.svg#sf-gb');
    unmount();
  });

  test('only a two-letter code can become a fragment', () => {
    expect(flagCode('pk')).toBe('PK');
    ['', 'pak', 'p', 'p1', '../x', 'pk"><script>', null, undefined].forEach((bad) => {
      expect(flagCode(bad)).toBe('');
      expect(flagHref(bad, SPRITE)).toBe('');
    });
    expect(flagHref('pk', SPRITE)).toBe(`${SPRITE}#sf-pk`);
    expect(flagHref('pk', SPRITE, true)).toBe('#sf-pk');
    const { container, unmount } = mount(<span><FlagIcon code='x"/><script>' /></span>);
    expect(container.querySelector('use')).toBeNull();
    unmount();
  });

  test('a sprite on another origin is fetched once and copied into the page', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve('<svg><symbol id="sf-pk" viewBox="0 0 640 480"></symbol></svg>') })
    );
    const { container, unmount } = mount(<span><FlagIcon code='PK' /><FlagIcon code='GB' /></span>);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(document.getElementById('subtleforms-flag-sprite')).not.toBeNull();
    expect(container.querySelector('use').getAttribute('href')).toBe('#sf-pk');
    document.getElementById('subtleforms-flag-sprite').remove();
    unmount();
  });

  test('a sprite on another origin is recognised', () => {
    expect(isCrossOrigin('https://cdn.example.net/flags.svg', document)).toBe(true);
    expect(isCrossOrigin(`${window.location.origin}/flags.svg`, document)).toBe(false);
    expect(isCrossOrigin('/wp-content/flags.svg', document)).toBe(false);
  });
});

describe('the flags feature in the browser', () => {
  const phone = (extra) => ({ type: 'phone', key: 'p', enableCountryCode: true, ...extra });

  test('is requested only when a field turns flags on', () => {
    expect(FIELD_GROUPS).toContain('flags');
    expect([...fieldGroups({ fields: [phone()] })]).toEqual(['geo']);
    expect([...fieldGroups({ fields: [phone({ showFlags: false })] })]).toEqual(['geo']);
    expect([...fieldGroups({ fields: [phone({ showFlags: true })] })].sort()).toEqual(['flags', 'geo']);
    expect([...fieldGroups({ fields: [{ type: 'country', key: 'c', showFlags: true }] })].sort()).toEqual(['flags', 'geo']);
    expect([...fieldGroups({ fields: [{ type: 'phone', key: 'p', showFlags: true }] })]).toEqual([]);
    expect([...fieldGroups({ fields: [{ type: 'text', key: 't', showFlags: true }] })]).toEqual([]);
  });

  test('flagsOn reads a true setting only', () => {
    expect([true, 1, '1', 'true'].every(flagsOn)).toBe(true);
    expect([false, 0, '0', 'false', '', null, undefined, {}].some(flagsOn)).toBe(false);
  });
});

describe('the flag sprite', () => {
  const source = path.join(__dirname, '../../../../node_modules/flag-icons/flags/4x3');
  const { svg, codes } = buildSprite(source);

  test('has a symbol for every country the pickers offer', () => {
    const missing = [...new Set([...COUNTRIES, ...phoneCountries()].map((country) => country.code))]
      .filter((code) => !codes.includes(code.toLowerCase()));
    expect(missing).toEqual([]);
    codes.forEach((code) => expect(svg).toContain(`<symbol id="sf-${code}" viewBox="0 0 640 480">`));
  });

  test('is valid and no id is used twice', () => {
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(svg).not.toMatch(/<script|<image|data:|javascript:/i);
    const opens = (svg.match(/<symbol\b/g) || []).length;
    expect(opens).toBe((svg.match(/<\/symbol>/g) || []).length);
    expect(opens).toBe(codes.length);
  });

  test('stays small enough to download on demand', () => {
    const gzip = require('zlib').gzipSync(Buffer.from(svg), { level: 9 }).length;
    expect(gzip).toBeLessThan(160 * 1024);
  });

  test('the built file, when there is one, is the same sprite', () => {
    const built = path.join(__dirname, '../../../../build/frontend/flags.svg');
    if (fs.existsSync(built)) {
      expect(fs.readFileSync(built, 'utf8')).toBe(svg);
    }
  });
});
