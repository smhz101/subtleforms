/**
 * The shared service tile grid and service header: the logo is in colour while
 * the service is on and grey while it is off (and in colour on hover or focus,
 * which the style sheet does), the controls call back, and both are on the
 * public extension object for add-ons.
 */
import fs from 'fs';
import path from 'path';
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { ServiceTileGrid, ServiceDetailHeader, logoClass } from './index';
import { columnCounts } from './ServiceTileGrid';
import { exposeServiceTiles } from './expose';

jest.mock('./serviceTiles.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const Square = ({ size }) => <svg data-size={size} viewBox='0 0 10 10'><rect width='10' height='10' fill='#f00' /></svg>;

const SERVICES = [
  { slug: 'one', label: 'One', logo: Square, enabled: true },
  { slug: 'two', label: 'Two', logo: Square, enabled: false, statusLabel: 'Not installed' },
  { slug: 'three', label: 'Three', logo: null, brandColor: '#123456', enabled: false },
];

async function mount(node) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(node));
}

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    container.remove();
    root = null;
  }
});

const scss = fs.readFileSync(path.join(__dirname, 'serviceTiles.scss'), 'utf8');

describe('logoClass', () => {
  test('an enabled service is coloured, a disabled one is grey', () => {
    expect(logoClass(true)).toBe('sf-svc-logo--colour');
    expect(logoClass(false)).toBe('sf-svc-logo--grey');
    expect(logoClass(undefined)).toBe('sf-svc-logo--grey');
  });
});

describe('the logo look in the style sheet', () => {
  test('grey is a grayscale filter with a little fade, not a second artwork', () => {
    const grey = scss.slice(scss.indexOf('&--grey {'), scss.indexOf('}', scss.indexOf('&--grey {')));
    expect(grey).toMatch(/filter:\s*grayscale\(1\)/);
    expect(grey).toMatch(/opacity:\s*0\.75/);
  });

  test('hover and keyboard focus on a tile bring the colour back', () => {
    expect(scss).toMatch(/\.sf-svc-tile:hover \.sf-svc-logo--grey,\s*\.sf-svc-tile:focus-within \.sf-svc-logo--grey \{\s*filter:\s*none;\s*opacity:\s*1;/);
  });

  test('the change takes 150ms and none for people who ask for less motion', () => {
    expect(scss).toMatch(/transition:\s*filter 150ms ease, opacity 150ms ease/);
    expect(scss).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.sf-svc-logo \{ transition: none; \}/);
  });
});

describe('ServiceTileGrid columns', () => {
  const make = (n) => Array.from({ length: n }, (_, i) => ({ slug: `s${i}`, label: `S${i}`, enabled: false }));

  it('counts min(tiles, 4) wide and min(tiles, 2) on a tablet', () => {
    expect(columnCounts(2)).toEqual({ wide: 2, medium: 2 });
    expect(columnCounts(3)).toEqual({ wide: 3, medium: 2 });
    expect(columnCounts(4)).toEqual({ wide: 4, medium: 2 });
    expect(columnCounts(7)).toEqual({ wide: 4, medium: 2 });
    expect(columnCounts(1)).toEqual({ wide: 1, medium: 1 });
  });

  it.each([2, 3, 4])('puts the count of %i tiles on the grid, so no cell is left empty', async (n) => {
    await mount(<ServiceTileGrid services={make(n)} />);
    const grid = container.querySelector('.sf-svc-grid');
    expect(grid.classList.contains(`sf-svc-grid--cols-${n}`)).toBe(true);
    expect(grid.style.getPropertyValue('--sf-svc-cols')).toBe(String(n));
    expect(grid.style.getPropertyValue('--sf-svc-cols-medium')).toBe(String(Math.min(n, 2)));
  });

  it('reads its columns from those variables in the style sheet', () => {
    const css = fs.readFileSync(path.join(__dirname, 'serviceTiles.scss'), 'utf8');
    expect(css).toContain('repeat(var(--sf-svc-cols, 4)');
    expect(css).toContain('repeat(var(--sf-svc-cols-medium, 2)');
  });
});

describe('ServiceTileGrid', () => {
  test('puts the colour class on an enabled logo and the grey class on the others', async () => {
    await mount(<ServiceTileGrid services={SERVICES} onOpen={() => {}} onToggle={() => {}} />);
    const logo = (slug) => container.querySelector(`[data-service="${slug}"] .sf-svc-logo`);
    expect(logo('one').classList.contains('sf-svc-logo--colour')).toBe(true);
    expect(logo('one').classList.contains('sf-svc-logo--grey')).toBe(false);
    expect(logo('two').classList.contains('sf-svc-logo--grey')).toBe(true);
    expect(logo('three').classList.contains('sf-svc-logo--grey')).toBe(true);
  });

  test('draws the logo component, or the name in the brand colour without one', async () => {
    await mount(<ServiceTileGrid services={SERVICES} onOpen={() => {}} onToggle={() => {}} />);
    expect(container.querySelector('[data-service="one"] svg').getAttribute('data-size')).toBe('44');
    const word = container.querySelector('[data-service="three"] .sf-svc-logo__wordmark');
    expect(word.textContent).toBe('Three');
    expect(word.style.color).toBe('rgb(18, 52, 86)');
  });

  test('shows the status line under the logo only for a service that has one', async () => {
    await mount(<ServiceTileGrid services={SERVICES} onOpen={() => {}} onToggle={() => {}} />);
    expect(container.querySelector('[data-service="two"] .sf-svc-tile__status').textContent).toBe('Not installed');
    expect(container.querySelector('[data-service="one"] .sf-svc-tile__status')).toBeNull();
  });

  test('a tile opens its service, and the switch toggles it without opening', async () => {
    const onOpen = jest.fn();
    const onToggle = jest.fn();
    await mount(<ServiceTileGrid services={SERVICES} onOpen={onOpen} onToggle={onToggle} />);
    await act(async () => container.querySelector('[data-service="two"] .sf-svc-tile__open').click());
    expect(onOpen).toHaveBeenCalledWith('two');
    await act(async () => container.querySelector('[data-service="two"] input[type="checkbox"]').click());
    expect(onToggle).toHaveBeenCalledWith('two', true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('the switch is named for the service, or by the add-on', async () => {
    await mount(<ServiceTileGrid services={SERVICES.slice(0, 1)} onOpen={() => {}} onToggle={() => {}} toggleLabel={(l) => `Turn on ${l}`} />);
    expect(container.querySelector('input[type="checkbox"]').getAttribute('aria-label')).toBe('Turn on One');
  });
});

describe('ServiceDetailHeader', () => {
  test('has a back button without text, the small logo, the name and the switch', async () => {
    const onBack = jest.fn();
    const onToggle = jest.fn();
    await mount(<ServiceDetailHeader label='One' logo={Square} enabled onBack={onBack} onToggle={onToggle} backLabel='Back to things' id='sw' />);
    const back = container.querySelector('button[aria-label="Back to things"]');
    expect(back.textContent.trim()).toBe('');
    await act(async () => back.click());
    expect(onBack).toHaveBeenCalled();
    expect(container.querySelector('.sf-svc-head__logo .sf-svc-logo').classList.contains('sf-svc-logo--colour')).toBe(true);
    expect(container.querySelector('.sf-svc-head__logo svg').getAttribute('data-size')).toBe('24');
    expect(container.querySelector('h3').textContent).toBe('One');
    expect(container.querySelector('label[for="sw"]').textContent).toBe('Enabled');
    await act(async () => container.querySelector('#sw').click());
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  test('the logo is grey while the service is off', async () => {
    await mount(<ServiceDetailHeader label='One' logo={Square} enabled={false} onBack={() => {}} onToggle={() => {}} />);
    expect(container.querySelector('.sf-svc-head__logo .sf-svc-logo').classList.contains('sf-svc-logo--grey')).toBe(true);
    expect(container.querySelector('label').textContent).toBe('Disabled');
  });
});

describe('the public extension object', () => {
  test('carries both components for add-ons', () => {
    const target = {};
    exposeServiceTiles(target);
    expect(target.ServiceTileGrid).toBe(ServiceTileGrid);
    expect(target.ServiceDetailHeader).toBe(ServiceDetailHeader);
    expect(window.SubtleFormsExtend.ServiceTileGrid).toBe(ServiceTileGrid);
    expect(window.SubtleFormsExtend.ServiceDetailHeader).toBe(ServiceDetailHeader);
  });
});
