/**
 * BuilderProvider
 *
 * Wraps builder components and provides shared state/commands via separate contexts.
 * Contexts are split to minimize re-renders:
 * - TreeContext: Schema tree (changes infrequently)
 * - SelectionContext: Selected field/step (changes frequently)
 * - ValidationContext: Validation errors (changes occasionally)
 * - CommandsContext: Command functions (never changes)
 * - ConfigContext: Field definitions, form type, etc. (rarely changes)
 */

import { useMemo } from '@wordpress/element';
import { TreeContext } from './TreeContext';
import { SelectionContext } from './SelectionContext';
import { ValidationContext } from './ValidationContext';
import { CommandsContext } from './CommandsContext';
import { ConfigContext } from './ConfigContext';
import {
	insertNode,
	deleteNode,
	updateNodeConfig,
	moveNode,
	duplicateNode,
} from '../schema/commands';

export function BuilderProvider({
	children,
	tree,
	selectedId,
	setSelectedId,
	selectedStepId,
	setSelectedStepId,
	validationErrors = [],
	validationErrorsByFieldKey = {},
	fieldDefinitions = {},
	formType = 'regular',
	fieldDefaults = null,
	// The form's own currency, '' for the site currency (2.4.0).
	currency = '',
	onInsert,
	onDelete,
	onUpdate,
	onMove,
	onDuplicate,
	onRequestInsert,
	onMoveToStep,
	onRenameKey,
	entryCount = 0,
	isReadOnly = false,
}) {
	// Tree context - changes on schema mutations
	const treeValue = useMemo(() => tree, [tree]);

	// Selection context - changes frequently
	const selectionValue = useMemo(
		() => ({
			selectedId,
			setSelectedId,
			selectedStepId,
			setSelectedStepId,
		}),
		[selectedId, setSelectedId, selectedStepId, setSelectedStepId]
	);

	// Validation context - changes on validation runs
	const validationValue = useMemo(
		() => ({
			validationErrors,
			validationErrorsByFieldKey,
		}),
		[validationErrors, validationErrorsByFieldKey]
	);

	// Commands context - stable (never changes)
	const commandsValue = useMemo(
		() => ({
			// Pure command functions
			commands: {
				insertNode,
				deleteNode,
				updateNodeConfig,
				moveNode,
				duplicateNode,
			},
			// Action handlers with side effects
			actions: {
				onInsert,
				onDelete,
				onUpdate,
				onMove,
				onDuplicate,
				onRequestInsert,
				onMoveToStep,
				// Change a field's ID everywhere the form uses it (2.4.1).
				onRenameKey,
			},
		}),
		[onInsert, onDelete, onUpdate, onMove, onDuplicate, onRequestInsert, onMoveToStep, onRenameKey]
	);

	// Config context - rarely changes
	const configValue = useMemo(
		() => ({
			fieldDefinitions,
			formType,
			isReadOnly,
			// Form-level label visibility and help text placement (2.3.2).
			fieldDefaults,
			currency,
			// Entries the form has, for the field ID editor's note (2.4.1).
			entryCount,
		}),
		[fieldDefinitions, formType, isReadOnly, fieldDefaults, currency, entryCount]
	);

	return (
		<ConfigContext.Provider value={configValue}>
			<TreeContext.Provider value={treeValue}>
				<SelectionContext.Provider value={selectionValue}>
					<ValidationContext.Provider value={validationValue}>
						<CommandsContext.Provider value={commandsValue}>
							{children}
						</CommandsContext.Provider>
					</ValidationContext.Provider>
				</SelectionContext.Provider>
			</TreeContext.Provider>
		</ConfigContext.Provider>
	);
}

