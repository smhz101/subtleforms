jest.mock('./AdminFooter.scss', () => ({}));
jest.mock('./DataTable.scss', () => ({}));
jest.mock('./IconAction.scss', () => ({}));
jest.mock('./TableSkeleton.scss', () => ({}));
import { act } from 'react';
import { createElement, render, unmountComponentAtNode, useState } from '@wordpress/element';
import AdminFooter from './AdminFooter';
import DataTable from './DataTable';
import { ShellFooterProvider } from './ShellFooterContext';
import { registerSlotItem } from '../../shared/extend';

describe('AdminFooter', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    window.subtleformsAdmin = { version: '2.7.4' };
  });
  afterEach(() => {
    unmountComponentAtNode(host);
    host.remove();
    window.__subtleformsExtend.slots = {};
    delete window.subtleformsAdmin;
  });

  test('shows the version and the two links, and nothing else by default', async () => {
    await act(async () => {
      render(createElement(AdminFooter, {}), host);
    });
    expect(host.textContent).toContain('SubtleForms 2.7.4');
    const links = Array.from(host.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Documentation', 'https://subtleforms.com/docs/'],
      ['Support', 'https://wordpress.org/support/plugin/subtleforms/'],
    ]);
    expect(host.textContent).not.toMatch(/pro|upgrade/i);
  });

  test('draws what an add-on registered in footer.meta', async () => {
    registerSlotItem('footer.meta', 'demo', { component: ({ version }) => createElement('span', { className: 'demo' }, `Add-on for ${version}`) });
    await act(async () => {
      render(createElement(AdminFooter, {}), host);
    });
    expect(host.querySelector('.demo').textContent).toBe('Add-on for 2.7.4');
  });

  test('the list pagination is drawn in the footer slot and still works', async () => {
    const onPageChange = jest.fn();
    function Shell() {
      const [slot, setSlot] = useState(null);
      return createElement(
        ShellFooterProvider,
        { value: slot },
        createElement('div', { className: 'content' }, createElement(DataTable, {
          columns: [{ key: 'name', title: 'Name' }],
          data: [{ id: 1, name: 'A' }],
          totalItems: 45,
          currentPage: 1,
          perPage: 20,
          onPageChange,
          paginationInFooter: true,
        })),
        createElement(AdminFooter, { slotRef: setSlot })
      );
    }
    await act(async () => {
      render(createElement(Shell), host);
    });
    await act(async () => {});
    const footer = host.querySelector('.sf-footer__page');
    expect(footer.querySelector('.sf-data-table__pagination')).not.toBeNull();
    expect(host.querySelector('.content .sf-data-table__pagination')).toBeNull();
    expect(footer.textContent).toContain('Page 1 of 3');
    const next = footer.querySelector('button[aria-label="Next page"]');
    await act(async () => {
      next.click();
    });
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test('without a shell the pagination stays under the table', async () => {
    await act(async () => {
      render(createElement(DataTable, {
        columns: [{ key: 'name', title: 'Name' }],
        data: [{ id: 1, name: 'A' }],
        totalItems: 45,
        currentPage: 1,
        perPage: 20,
        paginationInFooter: true,
      }), host);
    });
    expect(host.querySelector('.sf-data-table .sf-data-table__pagination')).not.toBeNull();
  });
});
