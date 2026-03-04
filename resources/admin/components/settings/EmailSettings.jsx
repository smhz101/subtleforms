import { TextControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from './FieldError';

/**
 * Email / Notification Settings Tab
 *
 * Admin notifications, user confirmation, sender identity.
 *
 * @param {Object}   props
 * @param {Object}   props.settings     - Current settings values
 * @param {Function} props.updateSetting - (key, value) => void
 * @param {Object}   props.fieldErrors  - Per-field validation errors
 */
export default function EmailSettings( {
	settings,
	updateSetting,
	fieldErrors = {},
} ) {
	return (
		<div className="sf-settings-section">
			<div>
				<ToggleControl
					label={ __( 'Admin Notifications', 'subtleforms' ) }
					checked={ settings.admin_notification_enabled }
					onChange={ ( value ) =>
						updateSetting( 'admin_notification_enabled', value )
					}
					help={ __(
						'Send email to admin on new submissions',
						'subtleforms'
					) }
				/>
				<FieldError
					errors={ fieldErrors.admin_notification_enabled }
				/>
			</div>

			<div>
				<ToggleControl
					label={ __(
						'User Confirmation Emails',
						'subtleforms'
					) }
					checked={ settings.user_confirmation_enabled }
					onChange={ ( value ) =>
						updateSetting( 'user_confirmation_enabled', value )
					}
					help={ __(
						'Send confirmation email to users after submission',
						'subtleforms'
					) }
				/>
				<FieldError
					errors={ fieldErrors.user_confirmation_enabled }
				/>
			</div>

			<div>
				<TextControl
					label={ __( 'Sender Name', 'subtleforms' ) }
					value={ settings.sender_name }
					onChange={ ( value ) =>
						updateSetting( 'sender_name', value )
					}
					help={ __(
						'Email sender name (leave empty for site name)',
						'subtleforms'
					) }
					placeholder={
						window.subtleformsData?.siteName ||
						__( 'Your Site', 'subtleforms' )
					}
				/>
				<FieldError errors={ fieldErrors.sender_name } />
			</div>

			<div>
				<TextControl
					label={ __( 'Sender Email', 'subtleforms' ) }
					type="email"
					value={ settings.sender_email }
					onChange={ ( value ) =>
						updateSetting( 'sender_email', value )
					}
					help={ __(
						'Email sender address (leave empty for admin email)',
						'subtleforms'
					) }
					placeholder={
						window.subtleformsData?.adminEmail ||
						'admin@example.com'
					}
				/>
				<FieldError errors={ fieldErrors.sender_email } />
			</div>

			<div>
				<TextControl
					label={ __( 'Admin Email', 'subtleforms' ) }
					type="email"
					value={ settings.admin_email }
					onChange={ ( value ) =>
						updateSetting( 'admin_email', value )
					}
					help={ __(
						'Email to receive admin notifications (leave empty for WordPress admin email)',
						'subtleforms'
					) }
					placeholder={
						window.subtleformsData?.adminEmail ||
						'admin@example.com'
					}
				/>
				<FieldError errors={ fieldErrors.admin_email } />
			</div>
		</div>
	);
}
