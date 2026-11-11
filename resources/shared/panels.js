/**
 * Tabs and Accordion (2.9.0): the container types, the panel type each one
 * holds, and small helpers shared by the builder and the live form.
 */

/** Container type to the type of panel it holds. */
export const PANEL_OF = {
  tabs_container: 'tab_panel',
  accordion_container: 'accordion_panel',
};

/** Panel type to the container type that owns it. */
export const OWNER_OF = {
  tab_panel: 'tabs_container',
  accordion_panel: 'accordion_container',
};

/** Whether a type is Tabs or Accordion. */
export function isPanelContainerType(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(PANEL_OF, type);
}

/** Whether a type is a tab or an accordion section. */
export function isPanelType(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(OWNER_OF, type);
}
