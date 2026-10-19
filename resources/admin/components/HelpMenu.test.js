/**
 * UX2-25: choosing an item in the Help & tour menu closes the menu.
 */
jest.mock('./HelpMenu.scss', () => ({}));
jest.mock('./merge-tags/MergeTagsHelp', () => ({ MergeTagsModal: () => null }));
import { act } from 'react';
import { createElement, render, unmountComponentAtNode } from '@wordpress/element';
import { screen, fireEvent } from '@testing-library/dom';
import HelpMenu from './HelpMenu';

describe('HelpMenu (UX2-25)', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    unmountComponentAtNode(host);
    host.remove();
  });

  async function openAndChoose(label, props) {
    await act(async () => {
      render(createElement(HelpMenu, props), host);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Help & tour' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
    });
  }

  test('Start Tour starts the tour and closes the menu', async () => {
    const onStartTour = jest.fn();
    await openAndChoose('Start Tour', { onStartTour });
    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: 'Start Tour' })).toBeNull();
  });

  test('Quick Start Wizard opens the wizard and closes the menu', async () => {
    const onOpenWizard = jest.fn();
    await openAndChoose('Quick Start Wizard', { onOpenWizard, showWizard: true });
    expect(onOpenWizard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: 'Quick Start Wizard' })).toBeNull();
  });

  test('View Documentation opens the docs and closes the menu', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    await openAndChoose('View Documentation', {});
    expect(open).toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: 'View Documentation' })).toBeNull();
    open.mockRestore();
  });
});
