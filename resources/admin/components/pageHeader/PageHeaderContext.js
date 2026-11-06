import { createContext, useContext } from '@wordpress/element';

/**
 * The actions area of the page header on screen.
 *
 * `undefined` means there is no header around (a story, a test, an older
 * SubtleForms): `PageHeaderActions` then draws its children where it stands.
 * `null` means the header is mounting and its actions area is not in the DOM
 * yet. An element is the area to draw into.
 */
const PageHeaderContext = createContext(undefined);

export const PageHeaderProvider = PageHeaderContext.Provider;

export function usePageHeaderActionsSlot() {
  return useContext(PageHeaderContext);
}

export default PageHeaderContext;
