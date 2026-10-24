/**
 * UI system.
 *
 * Single entry point for shared admin UI. Primitives live at this level;
 * grouped concerns (feedback, modals, loading) live in subdirectories and are
 * re-exported here so callers have one import path to remember.
 */

export * from './feedback';
export * from './modals';
export * from './loading';

// Primitives
export { default as Icon } from './Icon';
export { default as ContextualTip } from './ContextualTip';
export { default as PanelSection } from './PanelSection';
export { default as ErrorState } from './ErrorState';
