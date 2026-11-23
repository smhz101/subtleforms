import { renderHook } from '@testing-library/react-hooks';
import useBuilderKeyboardShortcuts from '../useBuilderKeyboardShortcuts';
import { BUILDER_ACTIONS } from '../../useBuilderReducer';

function press(init, target) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  (target || window).dispatchEvent(event);
  return event;
}

function setup(overrides = {}) {
  const dispatch = jest.fn();
  const props = {
    dispatch,
    isHydrating: false,
    saving: false,
    autoSaving: false,
    canUndo: true,
    canRedo: true,
    ...overrides,
  };
  const view = renderHook((p) => useBuilderKeyboardShortcuts(p), { initialProps: props });
  return { dispatch, view };
}

describe('useBuilderKeyboardShortcuts', () => {
  it('redoes with Ctrl+Shift+Z and Cmd+Shift+Z', () => {
    const { dispatch } = setup();
    press({ key: 'Z', ctrlKey: true, shiftKey: true });
    press({ key: 'z', metaKey: true, shiftKey: true });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({ type: BUILDER_ACTIONS.REDO_SCHEMA });
  });

  it('redoes with Ctrl+Y on non-mac', () => {
    const { dispatch } = setup();
    press({ key: 'y', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledWith({ type: BUILDER_ACTIONS.REDO_SCHEMA });
  });

  it('redo dispatches while autoSaving is true', () => {
    const { dispatch } = setup({ autoSaving: true });
    press({ key: 'z', ctrlKey: true, shiftKey: true });
    expect(dispatch).toHaveBeenCalledWith({ type: BUILDER_ACTIONS.REDO_SCHEMA });
  });

  it('undo dispatches while autoSaving is true', () => {
    const { dispatch } = setup({ autoSaving: true });
    press({ key: 'z', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledWith({ type: BUILDER_ACTIONS.UNDO_SCHEMA });
  });

  it('does nothing during a manual save or while hydrating', () => {
    const saving = setup({ saving: true });
    press({ key: 'z', ctrlKey: true, shiftKey: true });
    expect(saving.dispatch).not.toHaveBeenCalled();
    const hydrating = setup({ isHydrating: true });
    press({ key: 'z', ctrlKey: true });
    expect(hydrating.dispatch).not.toHaveBeenCalled();
  });

  it('undo and redo do nothing in a text input', () => {
    const { dispatch } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    press({ key: 'z', ctrlKey: true }, input);
    press({ key: 'z', ctrlKey: true, shiftKey: true }, input);
    press({ key: 'y', ctrlKey: true }, input);
    expect(dispatch).not.toHaveBeenCalled();
    input.remove();
  });
});
