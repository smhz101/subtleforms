/**
 * UI Extension Slots
 * 
 * Allows extensions to inject UI components at predefined locations.
 * Slots are React component injection points with controlled rendering.
 * 
 * Available Slots:
 * 
 * builder.toolbar.actions - Builder header toolbar (right side)
 * builder.sidebar.top - Top of builder sidebar
 * builder.sidebar.bottom - Bottom of builder sidebar
 * builder.inspector.field - Field inspector additional panels
 * forms.list.actions - Forms list bulk actions
 * forms.list.columns - Custom columns in forms table
 * templates.categories - Template selector categories
 * 
 * @version 1.0.0
 */

import React from 'react';
import { isValidSlotComponent } from './safetyGuards';

/**
 * UI slot registry
 * @private
 */
const slots = new Map();

/**
 * Register a component for a UI slot
 * 
 * @param {string} slotName - Slot identifier
 * @param {React.ComponentType} component - React component to render
 * @param {Object} [options] - Rendering options
 * @param {number} [options.priority=10] - Render order (lower first)
 * @param {Function} [options.shouldRender] - Conditional rendering function
 * @returns {Function} Unregister function
 * 
 * @example
 * registerUISlot('builder.toolbar.actions', MyToolbarButton, {
 *   priority: 5,
 *   shouldRender: (context) => context.formType === 'payment'
 * });
 */
export function registerUISlot(slotName, component, options = {}) {
  if (typeof slotName !== 'string') {
    throw new Error('Slot name must be a string');
  }
  
  if (!isValidSlotComponent(component)) {
    throw new Error('Slot component must be a valid React component');
  }
  
  const { priority = 10, shouldRender } = options;
  
  if (!slots.has(slotName)) {
    slots.set(slotName, []);
  }
  
  const slotComponents = slots.get(slotName);
  const entry = { component, priority, shouldRender };
  slotComponents.push(entry);
  slotComponents.sort((a, b) => a.priority - b.priority);
  
  return () => {
    const index = slotComponents.indexOf(entry);
    if (index !== -1) {
      slotComponents.splice(index, 1);
    }
  };
}

/**
 * Get components registered for a slot
 * 
 * @param {string} slotName - Slot identifier
 * @param {Object} [context] - Context for conditional rendering
 * @returns {Array} Filtered components
 */
export function getSlotComponents(slotName, context = {}) {
  const slotComponents = slots.get(slotName) || [];
  
  return slotComponents.filter(({ shouldRender }) => {
    if (typeof shouldRender !== 'function') {
      return true;
    }
    
    try {
      return shouldRender(context);
    } catch (error) {
      console.error(`[SubtleForms] Slot "${slotName}" shouldRender error:`, error);
      return false;
    }
  });
}

/**
 * React component to render a UI slot
 * 
 * @example
 * <UISlot name="builder.toolbar.actions" context={{ formId: 123 }} />
 */
export function UISlot({ name, context = {}, fallback = null }) {
  const components = getSlotComponents(name, context);
  
  if (components.length === 0) {
    return fallback;
  }
  
  return (
    <>
      {components.map(({ component: Component }, index) => (
        <Component key={index} context={context} />
      ))}
    </>
  );
}

/**
 * Available UI slots
 */
export const UI_SLOTS = {
  // Builder
  BUILDER_TOOLBAR_ACTIONS: 'builder.toolbar.actions',
  BUILDER_SIDEBAR_TOP: 'builder.sidebar.top',
  BUILDER_SIDEBAR_BOTTOM: 'builder.sidebar.bottom',
  BUILDER_INSPECTOR_FIELD: 'builder.inspector.field',
  
  // Forms list
  FORMS_LIST_ACTIONS: 'forms.list.actions',
  FORMS_LIST_COLUMNS: 'forms.list.columns',
  
  // Templates
  TEMPLATES_CATEGORIES: 'templates.categories',
  
  // Settings
  SETTINGS_TABS: 'settings.tabs',
};
