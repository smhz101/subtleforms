import {
	SelectControl,
	ToggleControl,
	TextControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from './FieldError';

/**
 * General Settings Tab
 *
 * @param {Object}   props
 * @param {Object}   props.settings     - Current settings values
 * @param {Function} props.updateSetting - (key, value) => void
 * @param {Object}   props.fieldErrors  - Per-field validation errors
 */
export default function GeneralSettings( {
	settings,
	updateSetting,
	fieldErrors = {},
} ) {
	return (
		<>
		<div className="sf-settings-section">
			<div>
				<SelectControl
					label={ __( 'Default New Form Status', 'subtleforms' ) }
					value={ settings.default_form_status }
					options={ [
						{ label: __( 'Draft', 'subtleforms' ), value: 'draft' },
						{
							label: __( 'Published', 'subtleforms' ),
							value: 'published',
						},
					] }
					onChange={ ( value ) =>
						updateSetting( 'default_form_status', value )
					}
					help={ __(
						'Default status when creating new forms',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.default_form_status } />
			</div>

			<div>
				<ToggleControl
					label={ __( 'Enable Autosave', 'subtleforms' ) }
					checked={ settings.autosave_enabled }
					onChange={ ( value ) =>
						updateSetting( 'autosave_enabled', value )
					}
					help={ __(
						'Automatically save form changes while editing',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.autosave_enabled } />
			</div>

			{ settings.autosave_enabled && (
				<div>
					<TextControl
						label={ __(
							'Autosave Interval (seconds)',
							'subtleforms'
						) }
						type="number"
						value={ String( settings.autosave_interval ) }
						onChange={ ( value ) =>
							updateSetting( 'autosave_interval', value )
						}
						min="1"
						max="60"
						help={ __(
							'Time between autosave triggers (1-60 seconds)',
							'subtleforms'
						) }
					/>
					<FieldError errors={ fieldErrors.autosave_interval } />
				</div>
			) }

			<div>
				<SelectControl
					label={ __( 'Delete Behavior', 'subtleforms' ) }
					value={ settings.delete_behavior }
					options={ [
						{
							label: __(
								'Soft Delete (Move to Trash)',
								'subtleforms'
							),
							value: 'soft',
						},
						{
							label: __(
								'Hard Delete (Permanent)',
								'subtleforms'
							),
							value: 'hard',
						},
					] }
					onChange={ ( value ) =>
						updateSetting( 'delete_behavior', value )
					}
					help={ __(
						'How forms and submissions are deleted',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.delete_behavior } />
			</div>
		</div>

		<div className="sf-settings-section">
			<div>
				<SelectControl
					label={ __( 'Submissions list density', 'subtleforms' ) }
					value={ settings.submissions_density || 'default' }
					options={ [
						{ label: __( 'Comfortable', 'subtleforms' ), value: 'comfortable' },
						{ label: __( 'Default', 'subtleforms' ), value: 'default' },
						{ label: __( 'Compact', 'subtleforms' ), value: 'compact' },
					] }
					onChange={ ( value ) => updateSetting( 'submissions_density', value ) }
					help={ __(
						'Row padding on the submissions list. An admin who chooses on that page keeps their own choice.',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.submissions_density } />
			</div>
			<div>
				<SelectControl
					label={ __( 'Reading pane', 'subtleforms' ) }
					value={ settings.submissions_reading_pane || 'right' }
					options={ [
						{ label: __( 'Right of inbox', 'subtleforms' ), value: 'right' },
						{ label: __( 'Below inbox', 'subtleforms' ), value: 'below' },
						{ label: __( 'No split', 'subtleforms' ), value: 'off' },
					] }
					onChange={ ( value ) => updateSetting( 'submissions_reading_pane', value ) }
					help={ __(
						'Where an entry opens. Right of the list is the default. No split opens the full entry page.',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.submissions_reading_pane } />
			</div>
		</div>
	</>
	);
}
