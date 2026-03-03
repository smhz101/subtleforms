/**
 * ValidationContext - Validation  State
 *
 * Provides validation errors for the current schema.
 * Changes occasionally (on validation runs).
 */

import { createContext, useContext } from '@wordpress/element';

export const ValidationContext = createContext(null);

export function useValidation() {
	const context = useContext(ValidationContext);
	if (!context) {
		throw new Error('useValidation must be used within BuilderProvider');
	}
	return context;
}
