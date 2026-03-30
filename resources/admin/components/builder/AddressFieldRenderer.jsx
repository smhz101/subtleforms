/**
 * AddressFieldRenderer
 *
 * Builder canvas preview for the address_group composite field.
 * Reads sub-field config from field.fields — label, placeholder and
 * enabled state are all driven by stored config with seeded defaults.
 * All inputs are read-only: this is a layout preview, not a live form.
 */

const DEFAULTS = {
	street:  { enabled: true,  label: 'Street Address',        placeholder: '' },
	street2: { enabled: false, label: 'Street Address Line 2', placeholder: 'Apt, Suite, etc.' },
	city:    { enabled: true,  label: 'City',                  placeholder: '' },
	state:   { enabled: true,  label: 'State / Province',      placeholder: '' },
	postal:  { enabled: true,  label: 'Postal Code',           placeholder: '' },
	country: { enabled: true,  label: 'Country',               placeholder: '' },
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

function SubInput( { sub, cls } ) {
	return (
		<div className={ `${ cls }__col` }>
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

export default function AddressFieldRenderer( { field } ) {
	const { fields } = field || {};
	const cls = 'sf-composite-field';

	const street  = getSub( fields, 'street' );
	const street2 = getSub( fields, 'street2' );
	const city    = getSub( fields, 'city' );
	const state   = getSub( fields, 'state' );
	const postal  = getSub( fields, 'postal' );
	const country = getSub( fields, 'country' );

	return (
		<div className={ cls }>
			{ /* Street (always) */ }
			<div className={ `${ cls }__row` }>
				<SubInput sub={ street } cls={ cls } />
			</div>

			{ /* Street 2 — optional */ }
			{ street2.enabled && (
				<div className={ `${ cls }__row` }>
					<SubInput sub={ street2 } cls={ cls } />
				</div>
			) }

			{ /* City (always) + State (optional) */ }
			<div className={ `${ cls }__row` }>
				<SubInput sub={ city } cls={ cls } />
				{ state.enabled && <SubInput sub={ state } cls={ cls } /> }
			</div>

			{ /* Postal + Country — shown only when at least one is enabled */ }
			{ ( postal.enabled || country.enabled ) && (
				<div className={ `${ cls }__row` }>
					{ postal.enabled  && <SubInput sub={ postal }  cls={ cls } /> }
					{ country.enabled && <SubInput sub={ country } cls={ cls } /> }
				</div>
			) }
		</div>
	);
}
