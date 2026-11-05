import { createContext, useContext } from '@wordpress/element';

/**
 * The page slot in the shell footer.
 *
 * `undefined` means there is no shell around (a story, a test): components
 * draw their controls where they are. `null` means a shell is mounting and its
 * footer slot is not in the DOM yet. An element is the slot to draw into.
 */
const ShellFooterContext = createContext(undefined);

export const ShellFooterProvider = ShellFooterContext.Provider;

export function useShellFooterSlot() {
  return useContext(ShellFooterContext);
}

export default ShellFooterContext;
