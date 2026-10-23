import { registerFormIntegration, formIntegrations } from './extend';

afterEach(() => {
  delete window.__subtleformsExtend.slots['form.integrations'];
});

describe('registerFormIntegration', () => {
  const component = () => null;

  test('keeps panels in order, then by id', () => {
    registerFormIntegration('b', { component });
    registerFormIntegration('a', { component, order: 5 });
    registerFormIntegration('c', { component });
    expect(formIntegrations().map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });

  test('is on window.SubtleFormsExtend for add-on scripts', () => {
    expect(typeof window.SubtleFormsExtend.registerFormIntegration).toBe('function');
  });

  test('ignores a bad slug or a missing component', () => {
    registerFormIntegration('Bad Slug', { component });
    registerFormIntegration('', { component });
    registerFormIntegration('ok', {});
    registerFormIntegration('ok2');
    expect(formIntegrations()).toEqual([]);
  });
});

describe('one slot mechanism', () => {
  const component = () => null;

  test('registerFormIntegration and registerSlotItem fill the same slot', () => {
    registerFormIntegration('crm_one', { component, order: 20 });
    window.SubtleFormsExtend.registerSlotItem('form.integrations', 'analytics', { component, order: 10 });
    expect(formIntegrations().map((p) => p.slug)).toEqual(['analytics', 'crm_one']);
  });
});
