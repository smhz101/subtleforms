import { registerAdminPage, getAdminPage } from './extend';

afterEach(() => {
  Object.keys(window.__subtleformsExtend.adminPages).forEach((k) => delete window.__subtleformsExtend.adminPages[k]);
});

describe('registerAdminPage', () => {
  const component = () => null;

  test('keeps a page by menu slug', () => {
    registerAdminPage('subtleforms-pro-orders', { component, title: 'Orders', description: 'Payments' });
    expect(getAdminPage('subtleforms-pro-orders').title).toBe('Orders');
  });

  test('is on window.SubtleFormsExtend for add-on scripts', () => {
    expect(typeof window.SubtleFormsExtend.registerAdminPage).toBe('function');
  });

  test('ignores a bad slug or a missing component', () => {
    registerAdminPage('Bad Slug', { component });
    registerAdminPage('subtleforms-x', {});
    expect(getAdminPage('Bad Slug')).toBeNull();
    expect(getAdminPage('subtleforms-x')).toBeNull();
  });
});
