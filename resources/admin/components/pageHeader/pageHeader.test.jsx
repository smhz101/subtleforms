/**
 * The page header: title, description, actions, the phone class and the
 * actions an add-on page draws from its body. It is also on the public
 * extension object, with the data table and the row actions.
 */
import { act } from 'react';
import { createRoot } from '@wordpress/element';
import PageHeader, { PageHeaderActions } from './PageHeader';
import { PageHeaderProvider } from './PageHeaderContext';
import { exposePageHeader } from './expose';
import DataTable from '../DataTable';
import RowActions from '../RowActions';

jest.mock('./PageHeader.scss', () => ({}));
jest.mock('../RowActions.scss', () => ({}));
jest.mock('../DataTable.scss', () => ({}));

let mockPhone = false;
jest.mock('../../hooks/usePhoneLayout', () => ({
  __esModule: true,
  default: () => mockPhone,
}));

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
  mockPhone = false;
});

describe('PageHeader', () => {
  test('draws the title as the h1, the description and the actions', async () => {
    await mount(
      <PageHeader
        title='Orders'
        description='Every payment taken through your forms.'
        actions={
          <>
            <button type='button' className='components-button is-secondary'>Payments settings</button>
            <button type='button' className='components-button is-primary'>New coupon</button>
          </>
        }
      />
    );
    expect(container.querySelector('h1.sf-page-header__title').textContent).toBe('Orders');
    expect(container.querySelector('.sf-page-header__description').textContent).toBe(
      'Every payment taken through your forms.'
    );
    const actions = container.querySelectorAll('.sf-page-header__actions button');
    expect(actions).toHaveLength(2);
    // The primary action is the rightmost.
    expect(actions[actions.length - 1].textContent).toBe('New coupon');
  });

  test('has exactly one primary action', async () => {
    await mount(
      <PageHeader
        title='Coupons'
        actions={
          <>
            <button type='button' className='is-secondary'>Payments settings</button>
            <button type='button' className='is-primary'>New coupon</button>
          </>
        }
      />
    );
    expect(container.querySelectorAll('.sf-page-header__actions .is-primary')).toHaveLength(1);
  });

  test('shows the meta chip after the title and the breadcrumb above it', async () => {
    await mount(<PageHeader title='Forms' meta={<span className='chip'>12</span>} breadcrumb={<a href='#x'>Back</a>} />);
    const heading = container.querySelector('.sf-page-header__heading');
    expect([...heading.children].map((el) => el.className)).toEqual(['sf-page-header__title', 'sf-page-header__meta']);
    const header = container.querySelector('.sf-page-header');
    expect(header.firstElementChild.className).toBe('sf-page-header__breadcrumb');
  });

  test('leaves out the description and the actions area when there are none', async () => {
    await mount(<PageHeader title='Dashboard' />);
    expect(container.querySelector('.sf-page-header__description')).toBeNull();
    expect(container.querySelector('.sf-page-header__actions')).toBeNull();
  });

  test('has the phone class below 600px only', async () => {
    await mount(<PageHeader title='Reports' />);
    expect(container.querySelector('.sf-page-header').classList.contains('is-phone')).toBe(false);
    act(() => root.unmount());
    container.remove();
    mockPhone = true;
    await mount(<PageHeader title='Reports' />);
    expect(container.querySelector('.sf-page-header').classList.contains('is-phone')).toBe(true);
  });
});

describe('PageHeaderActions', () => {
  test('draws its children where it stands when there is no header', async () => {
    await mount(
      <PageHeaderActions>
        <button type='button'>Inline</button>
      </PageHeaderActions>
    );
    expect(container.querySelector('.sf-page-header__inline-actions button').textContent).toBe('Inline');
  });

  test('moves its children into the header actions area', async () => {
    function Page() {
      const [slot, setSlot] = require('@wordpress/element').useState(null);
      return (
        <PageHeaderProvider value={slot}>
          <PageHeader title='Coupons' actionsRef={setSlot} />
          <PageHeaderActions>
            <button type='button' className='from-body'>New coupon</button>
          </PageHeaderActions>
        </PageHeaderProvider>
      );
    }
    await mount(<Page />);
    expect(container.querySelector('.sf-page-header__actions .from-body').textContent).toBe('New coupon');
    expect(container.querySelectorAll('.from-body')).toHaveLength(1);
  });
});

describe('RowActions', () => {
  test('draws icon buttons, text buttons and a link, and skips hidden actions', async () => {
    const open = jest.fn();
    await mount(
      <RowActions
        actions={[
          { key: 'open', label: 'Open entry', href: '/entry/1' },
          { key: 'refund', label: 'Refund', onClick: open, isDestructive: true },
          { key: 'hidden', label: 'Hidden', hidden: true },
        ]}
      />
    );
    const strip = container.querySelector('.subtleforms-row-actions');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('Open entry');
    expect(strip.textContent).toContain('Refund');
    expect(strip.textContent).not.toContain('Hidden');
    expect(strip.querySelector('a').getAttribute('href')).toBe('/entry/1');
    await act(async () => {
      [...strip.querySelectorAll('button')].find((b) => b.textContent === 'Refund').click();
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('draws nothing when every action is hidden', async () => {
    await mount(<RowActions actions={[{ label: 'x', hidden: true }]} />);
    expect(container.querySelector('.subtleforms-row-actions')).toBeNull();
  });
});

describe('extension object', () => {
  test('gets the header, its actions, the data table and the row actions', () => {
    const target = {};
    exposePageHeader(target);
    expect(target.PageHeader).toBe(PageHeader);
    expect(target.PageHeaderActions).toBe(PageHeaderActions);
    expect(target.DataTable).toBe(DataTable);
    expect(target.RowActions).toBe(RowActions);
  });
});
