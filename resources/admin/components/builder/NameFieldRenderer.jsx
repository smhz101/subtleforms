/**
 * NameFieldRenderer
 *
 * Builder canvas preview for the name_group composite field.
 * Reads sub-field config from field.fields — label, placeholder, and
 * enabled state are all driven by stored config with seeded defaults.
 * All inputs are read-only: this is a layout preview, not a live form.
 */

const DEFAULTS = {
	first_name:  { enabled: true,  label: 'First Name',  placeholder: '' },
	last_name:   { enabled: true,  label: 'Last Name',   placeholder: '' },
	middle_name: { enabled: false, label: 'Middle Name', placeholder: '' },
	suffix:      { enabled: false, label: 'Suffix',      placeholder: '' },
};

function getSub( fields, key ) {
	const stored = ( fields && typeof fields === 'object' ) ? ( fields[ key ] ?? {} ) : {};
	const def    = DEFAULTS[ key ] ?? {};
	return {
		enabled:     stored.enabled     ?? def.enabled     ?? true,
		label:       stored.label       || def.label       || key,
		placeholder: stored.placeholder || def.placeholder || '',
	};
}

function SubInput( { sub, narrow, cls } ) {
	return (
		<div className={ `${ cls }__col${ narrow ? ` ${ cls }__col--narrow` : '' }` }>
			<div className={ `${ cls }__sub-label` }>{ sub.label }</div>
			<input
				type='text'
				placeholder={ sub.placeholder || sub.label }
				className='sf-field-renderer__input'
				readOnly
				tabIndex='-1'
			/>
		</div>
	);
}

export default function NameFieldRenderer( { field } ) {
	const { fields } = field || {};
	const cls = 'sf-composite-field';

	const first  = getSub( fields, 'first_name' );
	const last   = getSub( fields, 'last_name' );
	const middle = getSub( fields, 'middle_name' );
	const suffix = getSub( fields, 'suffix' );

	return (
		<div className={ cls }>
			<div className={ `${ cls }__row` }>
				<SubInput sub={ first } cls={ cls } />
				{ middle.enabled && <SubInput sub={ middle } cls={ cls } /> }
				<SubInput sub={ last } cls={ cls } />
			</div>

			{ suffix.enabled && (
				<div className={ `${ cls }__row` }>
					<SubInput sub={ suffix } cls={ cls } narrow />
				</div>
			) }
		</div>
	);
}
