/**
 * Upgrade page: what Pro adds, one button to the Pro site, nothing that
 * pushes (no reviews, no countdown).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./UpgradePage.scss', () => ({}));
jest.mock('../components/AdminShell', () => function AdminShellMock({ children, title, actions }) {
  return (
    <div data-title={title}>
      <div className='mock-actions'>{actions}</div>
      {children}
    </div>
  );
});

import UpgradePage from './UpgradePage';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('UpgradePage', () => {
  let container;
  let root;
  beforeEach(() => {
    window.subtleformsAdmin = { upgradeUrl: 'https://subtleforms.com/pro/?utm_source=wp-admin&utm_medium=menu' };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<UpgradePage />));
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.subtleformsAdmin;
  });

  it('lists the nine things Pro adds', () => {
    const text = container.textContent;
    ['Fields', 'Payments', 'CRM', 'Automation', 'Analytics', 'MCP', 'PDF', 'WooCommerce', 'Translation'].forEach((name) => {
      expect(text).toContain(name);
    });
  });

  it('has one button, to the Pro site, in a new tab', () => {
    const links = container.querySelectorAll('a[href^="https://subtleforms.com/pro/"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain('utm_medium=menu');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toContain('noopener');
  });

  it('has no countdown or review wording', () => {
    expect(container.textContent).not.toMatch(/limited time|only \d+ left|hurry|★|reviews?/i);
  });
});
