/**
 * The section panel: a list of sections with status dots, the chosen section
 * on the right, the choice kept in the address, and the standard header. It
 * is on the public extension object for add-ons.
 */
import { act } from 'react';
import { createRoot } from '@wordpress/element';
import SectionPanel, { readHashParam, writeHashParam } from './SectionPanel';
import SectionHeader from './SectionHeader';
import { exposeSectionPanel } from './expose';

jest.mock('./sectionPanel.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function mount(node) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(node));
}

afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  root = null;
  container = null;
  window.location.hash = '';
});

const SECTIONS = [
  { id: 'one', label: 'One', status: 'on', order: 10, render: () => <p className='body-one'>Body one</p> },
  { id: 'two', label: 'Two', status: 'warn', order: 20, render: () => <p className='body-two'>Body two</p> },
  { id: 'three', label: 'Three', status: 'off', order: 30, render: () => <p className='body-three'>Body three</p> },
  { id: 'four', label: 'Four', status: null, order: 40, render: () => <p className='body-four'>Body four</p> },
];

const click = (label) =>
  act(async () => {
    [...container.querySelectorAll('.sf-section-panel__item')].find((b) => b.textContent.startsWith(label)).click();
  });

describe('SectionPanel', () => {
  test('lists every section and shows the first one', async () => {
    await mount(<SectionPanel sections={SECTIONS} />);
    const labels = [...container.querySelectorAll('.sf-section-panel__item-label')].map((el) => el.textContent);
    expect(labels).toEqual(['One', 'Two', 'Three', 'Four']);
    expect(container.querySelector('.body-one')).not.toBeNull();
    expect(container.querySelector('.body-two')).toBeNull();
    expect(container.querySelector('.sf-section-panel__item--active').textContent).toContain('One');
  });

  test('sections are placed by order, then by the order given', async () => {
    const shuffled = [
      { id: 'b', label: 'B', order: 20, render: () => null },
      { id: 'a', label: 'A', order: 10, render: () => null },
      { id: 'c', label: 'C', render: () => null },
      { id: 'd', label: 'D', render: () => null },
    ];
    await mount(<SectionPanel sections={shuffled} />);
    expect([...container.querySelectorAll('.sf-section-panel__item-label')].map((el) => el.textContent)).toEqual(['A', 'B', 'C', 'D']);
  });

  test('choosing a section shows it, marks it current and tells the caller', async () => {
    const onChange = jest.fn();
    await mount(<SectionPanel sections={SECTIONS} onChange={onChange} />);
    await click('Two');
    expect(container.querySelector('.body-two')).not.toBeNull();
    expect(container.querySelector('.body-one')).toBeNull();
    expect(container.querySelector('.sf-section-panel__item--active').getAttribute('aria-current')).toBe('true');
    expect(onChange).toHaveBeenCalledWith('two');
  });

  test('the chosen section is kept in the address under the url parameter', async () => {
    window.location.hash = '#tab=logs';
    await mount(<SectionPanel sections={SECTIONS} />);
    await click('Three');
    expect(readHashParam('section')).toBe('three');
    expect(readHashParam('tab')).toBe('logs');
  });

  test('a custom url parameter is used, and other parameters of the old section are dropped', async () => {
    window.location.hash = '#tab=extensions&ext=one&service=brevo';
    await mount(<SectionPanel sections={SECTIONS} urlParam='ext' />);
    expect(container.querySelector('.body-one')).not.toBeNull();
    await click('Two');
    expect(window.location.hash).toBe('#tab=extensions&ext=two');
  });

  test('a section named in the address opens first, an unknown one falls back to the first section', async () => {
    window.location.hash = '#tab=logs&section=three';
    await mount(<SectionPanel sections={SECTIONS} />);
    expect(container.querySelector('.body-three')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
    window.location.hash = '#tab=logs&section=nope';
    await mount(<SectionPanel sections={SECTIONS} />);
    expect(container.querySelector('.body-one')).not.toBeNull();
  });

  test('follows `current` when the caller controls it', async () => {
    await mount(<SectionPanel sections={SECTIONS} current='four' onChange={() => {}} />);
    expect(container.querySelector('.body-four')).not.toBeNull();
  });

  test('status dots: on is green, warn is amber, off is grey, none draws no dot; each has words', async () => {
    await mount(<SectionPanel sections={SECTIONS} />);
    const dots = [...container.querySelectorAll('.sf-section-panel__item')].map((b) => b.querySelector('.sf-ext-status'));
    expect(dots[0].className).toContain('sf-ext-status--active');
    expect(dots[1].className).toContain('sf-ext-status--warning');
    expect(dots[2].className).toContain('sf-ext-status--inactive');
    expect(dots[3]).toBeNull();
    expect(dots[0].textContent).toBe('Active');
    expect(dots[1].textContent).toBe('Needs setup');
    expect(dots[2].textContent).toBe('Off');
  });

  test('a section an add-on supplies is listed and drawn like the others', async () => {
    const addOn = { id: 'addon', label: 'From an add-on', status: 'on', order: 5, render: () => <p className='body-addon'>Add-on body</p> };
    await mount(<SectionPanel sections={[...SECTIONS, addOn]} current='addon' onChange={() => {}} />);
    const labels = [...container.querySelectorAll('.sf-section-panel__item-label')].map((el) => el.textContent);
    expect(labels[0]).toBe('From an add-on');
    expect(container.querySelector('.body-addon').textContent).toBe('Add-on body');
  });
});

describe('writeHashParam', () => {
  test('keeps only the parameters it is told to keep', () => {
    window.location.hash = '#tab=extensions&ext=a&service=b&crm=c';
    writeHashParam('ext', 'z', ['tab']);
    expect(window.location.hash).toBe('#tab=extensions&ext=z');
  });
});

describe('SectionHeader', () => {
  test('is a title and one line, with no icon and no extra paragraph', async () => {
    await mount(<SectionHeader title='Webhooks' description='Send each entry to a URL.' />);
    expect(container.querySelector('h2').textContent).toBe('Webhooks');
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  test('draws the actions on the right when given, and nothing when not', async () => {
    await mount(<SectionHeader title='CRM' description='Send entries to a CRM.' actions={<span className='badge'>Connected</span>} />);
    expect(container.querySelector('.sf-section-header__actions .badge').textContent).toBe('Connected');
    act(() => root.unmount());
    container.remove();
    await mount(<SectionHeader title='CRM' />);
    expect(container.querySelector('.sf-section-header__actions')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('public extension object', () => {
  test('SectionPanel and SectionHeader are added to it', () => {
    const target = {};
    exposeSectionPanel(target);
    expect(target.SectionPanel).toBe(SectionPanel);
    expect(target.SectionHeader).toBe(SectionHeader);
  });
});

test('follows a change of the address while the panel is open', async () => {
  window.location.hash = '#tab=logs&section=one';
  await mount(<SectionPanel sections={SECTIONS} />);
  expect(container.querySelector('.body-one')).not.toBeNull();

  await act(async () => {
    window.history.replaceState(null, '', '#tab=logs&section=three');
    window.dispatchEvent(new Event('hashchange'));
  });
  expect(container.querySelector('.body-three')).not.toBeNull();
  expect(container.querySelector('.body-one')).toBeNull();

  await act(async () => {
    window.history.replaceState(null, '', '#tab=logs&section=two');
    window.dispatchEvent(new Event('popstate'));
  });
  expect(container.querySelector('.body-two')).not.toBeNull();
});
