import { __ } from '@wordpress/i18n';

/**
 * NameFieldRenderer
 *
 * Builder canvas preview for the name_group composite field.
 * Renders static sub-field inputs based on enable_* toggles.
 * All inputs are read-only — this is a layout preview, not a live form.
 */
export default function NameFieldRenderer( { field } ) {
	const { enable_middle_name, enable_suffix } = field || {};
	const cls = 'sf-composite-field';

	return (
		<div className={ cls }>
			{ /* First / Middle / Last row */ }
			<div className={ `${ cls }__row` }>
				<div className={ `${ cls }__col` }>
					<div className={ `${ cls }__sub-label` }>
						{ __( 'First Name', 'subtleforms' ) }
					</div>
					<input
						type='text'
						placeholder={ __( 'First Name', 'subtleforms' ) }
						className='sf-field-renderer__input'
						readOnly
						tabIndex='-1'
					/>
				</div>

				{ enable_middle_name && (
					<div className={ `${ cls }__col` }>
						<div className={ `${ cls }__sub-label` }>
							{ __( 'Middle Name', 'subtleforms' ) }
						</div>
						<input
							type='text'
							placeholder={ __( 'Middle Name', 'subtleforms' ) }
							className='sf-field-renderer__input'
							readOnly
							tabIndex='-1'
						/>
					</div>
				) }

				<div className={ `${ cls }__col` }>
					<div className={ `${ cls }__sub-label` }>
						{ __( 'Last Name', 'subtleforms' ) }
					</div>
					<input
						type='text'
						placeholder={ __( 'Last Name', 'subtleforms' ) }
						className='sf-field-renderer__input'
						readOnly
						tabIndex='-1'
					/>
				</div>
			</div>

			{ /* Suffix row — optional */ }
			{ enable_suffix && (
				<div className={ `${ cls }__row` }>
					<div className={ `${ cls }__col ${ cls }__col--narrow` }>
						<div className={ `${ cls }__sub-label` }>
							{ __( 'Suffix', 'subtleforms' ) }
						</div>
						<input
							type='text'
							placeholder={ __( 'e.g. Jr., Sr.', 'subtleforms' ) }
							className='sf-field-renderer__input'
							readOnly
							tabIndex='-1'
						/>
					</div>
				</div>
			) }
		</div>
	);
}
