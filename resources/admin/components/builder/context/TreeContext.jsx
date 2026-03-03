/**
 * TreeContext - Schema Tree State
 *
 * Provides read-only access to the current form schema tree.
 * Changes infrequently (only on schema mutations).
 */

import { createContext, useContext } from '@wordpress/element';

export const TreeContext = createContext(null);

export function useTree() {
	const context = useContext(TreeContext);
	if (!context) {
		throw new Error('useTree must be used within BuilderProvider');
	}
	return context;
}
