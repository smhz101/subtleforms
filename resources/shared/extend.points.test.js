/**
 * The extension points SubtleForms Pro builds picture choice, multi-file
 * uploads, advanced logic and analytics on (docs/hooks.md).
 */
import {
  registerFieldOverride,
  getFieldOverride,
  registerLogicEditor,
  getLogicEditor,
  registerSlotItem,
  getSlotItems,
  registerFormMountHook,
  runFormMountHooks,
  addonProvides,
} from './extend';

const store = () => window.__subtleformsExtend;

afterEach(() => {
  store().overrides = {};
  store().slots = {};
  store().mountHooks = [];
  store().logicEditor = null;
  delete window.subtleformsAdmin;
});

test('every extension point is on window.SubtleFormsExtend for add-on scripts', () => {
  [
    'registerFieldType',
    'registerFieldOverride',
    'registerLogicExtension',
    'registerLogicEditor',
    'registerSlotItem',
    'registerFormMountHook',
    'registerInspectorControl',
    'registerCanvasPreview',
  ].forEach((name) => expect(typeof window.SubtleFormsExtend[name]).toBe('function'));
});

describe('field overrides', () => {
  const component = () => null;

  test('the first override that applies wins', () => {
    registerFieldOverride('file_upload', { applies: (f, c) => c.multiple === true, component });
    expect(getFieldOverride({ type: 'file_upload' }, { multiple: true }).component).toBe(component);
    expect(getFieldOverride({ type: 'file_upload' }, { multiple: false })).toBeNull();
    expect(getFieldOverride({ type: 'text' }, { multiple: true })).toBeNull();
  });

  test('a throwing check counts as not applying', () => {
    registerFieldOverride('file_upload', {
      applies: () => {
        throw new Error('boom');
      },
      component,
    });
    expect(getFieldOverride({ type: 'file_upload' }, {})).toBeNull();
  });

  test('ignores a definition without a check or a component', () => {
    registerFieldOverride('file_upload', { component });
    registerFieldOverride('file_upload', { applies: () => true });
    expect(getFieldOverride({ type: 'file_upload' }, {})).toBeNull();
  });
});

test('a logic editor replaces the built-in one and can be removed', () => {
  const editor = () => null;
  registerLogicEditor(editor);
  expect(getLogicEditor()).toBe(editor);
  registerLogicEditor(null);
  expect(getLogicEditor()).toBeNull();
});

describe('slots', () => {
  test('lists items by order, then id', () => {
    const a = () => null;
    const b = () => null;
    registerSlotItem('reports.panels', 'b', { component: b, order: 20 });
    registerSlotItem('reports.panels', 'a', { component: a, order: 20 });
    registerSlotItem('reports.panels', 'first', { component: a, order: 1 });
    expect(getSlotItems('reports.panels').map((i) => i.id)).toEqual(['first', 'a', 'b']);
    expect(getSlotItems('dashboard.panels')).toEqual([]);
  });

  test('ignores an item without a component', () => {
    registerSlotItem('reports.panels', 'x', {});
    expect(getSlotItems('reports.panels')).toEqual([]);
  });
});

describe('form mount hooks', () => {
  test('run with the container, the form id and the front end config', () => {
    const fn = jest.fn();
    registerFormMountHook(fn);
    registerFormMountHook(fn);
    const container = document.createElement('div');
    runFormMountHooks({ container, formId: 7, config: { restUrl: '/x' } });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ container, formId: 7, config: { restUrl: '/x' } });
  });

  test('a throwing hook does not stop the others', () => {
    const ok = jest.fn();
    registerFormMountHook(() => {
      throw new Error('boom');
    });
    registerFormMountHook(ok);
    runFormMountHooks({ formId: 1 });
    expect(ok).toHaveBeenCalled();
  });
});

test('addonProvides reads the features the server says an add-on runs', () => {
  expect(addonProvides('analytics')).toBe(false);
  window.subtleformsAdmin = { addonFeatures: ['analytics'] };
  expect(addonProvides('analytics')).toBe(true);
  expect(addonProvides('advanced_logic')).toBe(false);
});
