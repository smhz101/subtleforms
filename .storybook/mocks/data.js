/**
 * Mock for @wordpress/data
 */
export const useSelect = (fn) => fn(() => () => undefined);
export const useDispatch = () => ({});
export const select = () => ({});
export const dispatch = () => ({});
export const subscribe = () => () => {};
export const registerStore = () => {};
export const createRegistrySelector = (fn) => fn;
export const withSelect = () => (Component) => Component;
export const withDispatch = () => (Component) => Component;
