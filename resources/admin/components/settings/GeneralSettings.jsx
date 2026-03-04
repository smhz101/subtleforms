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
	);
}
