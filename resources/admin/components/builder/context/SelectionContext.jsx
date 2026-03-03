/**
 * SelectionContext - Selection State
 *
 * Manages which field/step is currently selected.
 * Changes frequently (on every click).
 * Separated to prevent tree re-renders on selection changes.
 */

import { createContext, useContext } from '@wordpress/element';

export const SelectionContext = createContext(null);

export function useSelection() {
	const context = useContext(SelectionContext);
	if (!context) {
		throw new Error('useSelection must be used within BuilderProvider');
	}
	return context;
}
