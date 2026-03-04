import { TextControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from './FieldError';

/**
 * Frontend Settings Tab
 *
 * Controls for success/error messages, redirect URLs, and submission limits.
 *
 * @param {Object}   props
 * @param {Object}   props.settings     - Current settings values
 * @param {Function} props.updateSetting - (key, value) => void
 * @param {Object}   props.fieldErrors  - Per-field validation errors
 */
export default function FrontendSettings( {
	settings,
	updateSetting,
	fieldErrors = {},
} ) {
	return (
		<div className="sf-settings-section">
			<div>
				<TextControl
					label={ __( 'Success Message', 'subtleforms' ) }
					value={ settings.success_message }
					onChange={ ( value ) =>
						updateSetting( 'success_message', value )
					}
					help={ __(
						'Message shown after successful submission',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.success_message } />
			</div>

			<div>
				<TextControl
					label={ __( 'Error Message', 'subtleforms' ) }
					value={ settings.error_message }
					onChange={ ( value ) =>
						updateSetting( 'error_message', value )
					}
					help={ __(
						'Generic error message shown on submission failure',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.error_message } />
			</div>

			<div>
				<TextControl
					label={ __(
						'Redirect After Submit (URL)',
						'subtleforms'
					) }
					value={ settings.redirect_after_submit }
					onChange={ ( value ) =>
						updateSetting( 'redirect_after_submit', value )
					}
					help={ __(
						'Optional URL to redirect after submission (leave empty to show message)',
						'subtleforms'
					) }
					placeholder="https://example.com/thank-you"
				/>
				<FieldError errors={ fieldErrors.redirect_after_submit } />
			</div>

			<div>
				<ToggleControl
					label={ __(
						'Enable Submission Limit',
						'subtleforms'
					) }
					checked={ settings.submission_limit_enabled }
					onChange={ ( value ) =>
						updateSetting( 'submission_limit_enabled', value )
					}
					help={ __(
						'Limit submissions per user/IP address',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.submission_limit_enabled } />
			</div>

			{ settings.submission_limit_enabled && (
				<div>
					<TextControl
						label={ __(
							'Maximum Submissions',
							'subtleforms'
						) }
						type="number"
						value={ String( settings.submission_limit ) }
						onChange={ ( value ) =>
							updateSetting( 'submission_limit', value )
						}
						min="1"
						max="100"
						help={ __(
							'Maximum number of submissions allowed per user',
							'subtleforms'
						) }
					/>
					<FieldError errors={ fieldErrors.submission_limit } />
				</div>
			) }
		</div>
	);
}
