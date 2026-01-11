/**
 * Builder Keyboard Shortcuts Hook
 *
 * Handles keyboard shortcuts for undo/redo operations.
 */

import { useEffect } from '@wordpress/element';
import { BUILDER_ACTIONS } from '../useBuilderReducer';

export default function useBuilderKeyboardShortcuts({
  dispatch,
  isHydrating,
  saving,
  autoSaving,
  canUndo,
  canRedo,
}) {
  useEffect(() => {
    function isTypingTarget(target) {
      if (!target) {
        return false;
      }

      const tagName = target.tagName ? target.tagName.toLowerCase() : '';
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return true;
      }

      if (target.isContentEditable) {
        return true;
      }

      return false;
    }

    function onKeyDown(event) {
      if (event.defaultPrevented) {
        return;
      }

      if (isHydrating || saving || autoSaving) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const key = String(event.key || '').toLowerCase();
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) {
        return;
      }

      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo =
        (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey);

      if (isUndo && canUndo) {
        event.preventDefault();
        dispatch({ type: BUILDER_ACTIONS.UNDO_SCHEMA });
      }

      if (isRedo && canRedo) {
        event.preventDefault();
        dispatch({ type: BUILDER_ACTIONS.REDO_SCHEMA });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [autoSaving, canRedo, canUndo, dispatch, isHydrating, saving]);
}
