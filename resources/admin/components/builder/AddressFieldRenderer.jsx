import { __ } from '@wordpress/i18n';

/**
 * AddressFieldRenderer
 *
 * Builder canvas preview for the address_group composite field.
 * Renders static sub-field inputs controlled by enable_* toggles.
 * City is always rendered; all other sub-fields default to true and
 * can be hidden via the inspector toggles.
 */
export default function AddressFieldRenderer( { field } ) {
	const {
		enable_street2,
		enable_state,
		enable_postal,
		enable_country,
	} = field || {};

	// Default-true fields: treat undefined as enabled
	const showState   = enable_state   !== false;
	const showPostal  = enable_postal  !== false;
	const showCountry = enable_country !== false;

	const cls = 'sf-composite-field';

	return (
		<div className={ cls }>
			{ /* Street Address — always shown */ }
			<div className={ `${ cls }__row` }>
				<div className={ `${ cls }__col` }>
					<div className={ `${ cls }__sub-label` }>
						{ __( 'Street Address', 'subtleforms' ) }
					</div>
					<input
						type='text'
						placeholder={ __( 'Street Address', 'subtleforms' ) }
						className='sf-field-renderer__input'
						readOnly
						tabIndex='-1'
					/>
				</div>
			</div>

			{ /* Street Address Line 2 — optional (default off) */ }
			{ enable_street2 && (
				<div className={ `${ cls }__row` }>
					<div className={ `${ cls }__col` }>
						<div className={ `${ cls }__sub-label` }>
							{ __( 'Street Address Line 2', 'subtleforms' ) }
						</div>
						<input
							type='text'
							placeholder={ __( 'Apt, Suite, etc.', 'subtleforms' ) }
							className='sf-field-renderer__input'
							readOnly
							tabIndex='-1'
						/>
					</div>
				</div>
			) }

			{ /* City (always) + State (optional) */ }
			<div className={ `${ cls }__row` }>
				<div className={ `${ cls }__col` }>
					<div className={ `${ cls }__sub-label` }>
						{ __( 'City', 'subtleforms' ) }
					</div>
					<input
						type='text'
						placeholder={ __( 'City', 'subtleforms' ) }
						className='sf-field-renderer__input'
						readOnly
						tabIndex='-1'
					/>
				</div>

				{ showState && (
					<div className={ `${ cls }__col` }>
						<div className={ `${ cls }__sub-label` }>
							{ __( 'State / Province', 'subtleforms' ) }
						</div>
						<input
							type='text'
							placeholder={ __( 'State / Province', 'subtleforms' ) }
							className='sf-field-renderer__input'
							readOnly
							tabIndex='-1'
						/>
					</div>
				) }
			</div>

			{ /* Postal + Country row — shown when at least one is enabled */ }
			{ ( showPostal || showCountry ) && (
				<div className={ `${ cls }__row` }>
					{ showPostal && (
						<div className={ `${ cls }__col` }>
							<div className={ `${ cls }__sub-label` }>
								{ __( 'Postal Code', 'subtleforms' ) }
							</div>
							<input
								type='text'
								placeholder={ __( 'Postal Code', 'subtleforms' ) }
								className='sf-field-renderer__input'
								readOnly
								tabIndex='-1'
							/>
						</div>
					) }

					{ showCountry && (
						<div className={ `${ cls }__col` }>
							<div className={ `${ cls }__sub-label` }>
								{ __( 'Country', 'subtleforms' ) }
							</div>
							<input
								type='text'
								placeholder={ __( 'Country', 'subtleforms' ) }
								className='sf-field-renderer__input'
								readOnly
								tabIndex='-1'
							/>
						</div>
					) }
				</div>
			) }
		</div>
	);
}
