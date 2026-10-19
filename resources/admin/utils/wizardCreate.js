/**
 * Body for POST /forms from the Quick Start wizard.
 *
 * The create schema accepts title and schema only. status belongs to update.
 *
 * @param {{goal?: string, type?: string, fields?: Array}} formData Wizard result.
 * @return {{title: string, schema: Object}}
 */
export function wizardCreateBody( formData ) {
	const goal = typeof formData?.goal === 'string' ? formData.goal : '';
	const titled = goal
		? goal.charAt( 0 ).toUpperCase() + goal.slice( 1 )
		: 'Form';
	return {
		title: `My ${ titled }`,
		schema: {
			schema_version: 1,
			metadata: {
				name: goal || 'new_form',
				type: formData?.type || 'regular',
				title: `My ${ titled }`,
			},
			fields: Array.isArray( formData?.fields ) ? formData.fields : [],
		},
	};
}
