/**
 * CommandsContext - Command Functions & Actions
 *
 * Provides stable command functions and action handlers.
 * Never changes (functions are memoized by parent).
 */

import { createContext, useContext } from '@wordpress/element';

export const CommandsContext = createContext(null);

export function useCommands() {
	const context = useContext(CommandsContext);
	if (!context) {
		throw new Error('useCommands must be used within BuilderProvider');
	}
	return context;
}
