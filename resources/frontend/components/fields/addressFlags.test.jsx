/**
 * Country flags on the Address field (2.9.0): the Country part draws flag
 * images only when an add-on declares the `address_flags` feature and the
 * field's `showFlags` setting is on.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from '../FieldRenderer';
import AddressFieldRenderer from '../../../admin/components/builder/AddressFieldRenderer';
import { flagsOn } from '../../../shared/flagsOn';
import { fieldGroups, loadAllFieldGroups } from './lazyFields';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => loadAllFieldGroups());

// An add-on declares the feature; the live form reads it from its own data.
const declare = () => {
  window.subtleformsFrontend.addonFeatures = ['address_flags'];
};

beforeEach(() => {
  window.subtleformsFrontend = { assetsUrl: 'https://example.test/wp-content/plugins/subtleforms/build/frontend/' };
  window.subtleformsAdmin = { flagBaseUrl: 'https://example.test/wp-content/plugins/subtleforms/build/frontend/flags/' };
  Element.prototype.scrollIntoView = () => {};
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

const address = (extra = {}) => ({ type: 'address_group', key: 'addr', label: 'Address', ...extra });

function draw(field, values = {}) {
  return mount(<FieldRenderer field={field} values={values} onChange={() => {}} errors={{}} />);
}

describe('address country with flags', () => {
  test('on with the feature: the selected country shows a flag image and the open list has flags', () => {
    declare();
    const { container, unmount } = draw(address({ showFlags: true }), { addr: { country: 'PK' } });
    const trigger = container.querySelector('.subtleforms-address-group .subtleforms-picker__trigger');
    expect(trigger.querySelector('img.subtleforms-flag')).not.toBeNull();
    act(() => trigger.click());
    expect(container.querySelectorAll('.subtleforms-picker__list img.subtleforms-flag').length).toBeGreaterThan(100);
    unmount();
  });

  test('the option alone, without the feature: letters, no flag image', () => {
    const { container, unmount } = draw(address({ showFlags: true }), { addr: { country: 'PK' } });
    const trigger = container.querySelector('.subtleforms-address-group .subtleforms-picker__trigger');
    expect(trigger.textContent).toContain('PK');
    act(() => trigger.click());
    expect(container.querySelectorAll('img.subtleforms-flag')).toHaveLength(0);
    unmount();
  });

  test.each([[undefined], [false], ['no'], ['0']])('feature declared, option off (%p): letters, no flag image', (value) => {
    declare();
    const { container, unmount } = draw(address(value === undefined ? {} : { showFlags: value }), { addr: { country: 'PK' } });
    const trigger = container.querySelector('.subtleforms-address-group .subtleforms-picker__trigger');
    expect(trigger.textContent).toContain('PK');
    expect(container.querySelectorAll('img.subtleforms-flag')).toHaveLength(0);
    act(() => trigger.click());
    expect(container.querySelectorAll('img.subtleforms-flag')).toHaveLength(0);
    unmount();
  });

  test('a wrapped node reads the setting from its config', () => {
    declare();
    const { container, unmount } = draw(address({ config: { showFlags: true } }), { addr: { country: 'DE' } });
    expect(container.querySelector('.subtleforms-picker__trigger img.subtleforms-flag')).not.toBeNull();
    unmount();
  });
});

describe('flagsOn and the flags group for an address', () => {
  test('flagsOn is true for the option and false otherwise', () => {
    expect(flagsOn(address({ showFlags: true }).showFlags)).toBe(true);
    expect(flagsOn(address().showFlags)).toBe(false);
  });

  test('without the feature the flags code is never listed for an address', () => {
    expect(fieldGroups({ fields: [address({ showFlags: true })] }).has('flags')).toBe(false);
  });

  test('with the feature the flags code is listed only for an address that asks', () => {
    declare();
    expect(fieldGroups({ fields: [address()] }).has('flags')).toBe(false);
    expect(fieldGroups({ fields: [address({ showFlags: false })] }).has('flags')).toBe(false);
    const on = fieldGroups({ fields: [address({ showFlags: true })] });
    expect(on.has('flags')).toBe(true);
    expect(on.has('geo')).toBe(true);
  });
});

describe('builder canvas', () => {
  test('on with the feature: a flag stands beside the Country placeholder; off or no feature: none', () => {
    const bare = mount(<AddressFieldRenderer field={address({ showFlags: true })} />);
    expect(bare.container.querySelectorAll('img.subtleforms-flag')).toHaveLength(0);
    bare.unmount();
    declare();
    const on = mount(<AddressFieldRenderer field={address({ showFlags: true })} />);
    expect(on.container.querySelectorAll('img.subtleforms-flag')).toHaveLength(1);
    on.unmount();
    const off = mount(<AddressFieldRenderer field={address()} />);
    expect(off.container.querySelectorAll('img.subtleforms-flag')).toHaveLength(0);
    off.unmount();
    const hidden = mount(<AddressFieldRenderer field={address({ showFlags: true, fields: { country: { enabled: false } } })} />);
    expect(hidden.container.querySelectorAll('img.subtleforms-flag')).toHaveLength(0);
    hidden.unmount();
  });
});
