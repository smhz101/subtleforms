/**
 * ConfigContext - Builder Configuration
 *
 * Provides field definitions, form type, and read-only state.
 * Changes rarely (mostly on mount).
 */

import { createContext, useContext } from '@wordpress/element';

export const ConfigContext = createContext(null);

export function useConfig() {
	const context = useContext(ConfigContext);
	if (!context) {
		throw new Error('useConfig must be used within BuilderProvider');
	}
	return context;
}
