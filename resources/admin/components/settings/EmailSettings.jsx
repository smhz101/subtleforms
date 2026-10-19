import { useState } from '@wordpress/element';
import {
	TextControl,
	ToggleControl,
	Button,
	Notice,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
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
	const siteDomain =
		window.subtleformsData?.siteDomain || '';
	const defaultSender = siteDomain
		? `wordpress@${ siteDomain }`
		: 'wordpress@example.com';

	// Warn when the sender email is on a different domain than the site -
	// that trips SPF/DMARC and is a common cause of missing notifications
	// (Part B20). Empty sender is fine: it resolves to wordpress@<site>.
	const senderEmail = ( settings.sender_email || '' ).trim().toLowerCase();
	const senderDomain = senderEmail
		? senderEmail.split( '@' )[ 1 ] || ''
		: '';
	const domainMismatch =
		!! senderDomain && !! siteDomain && senderDomain !== siteDomain;

	const [ sending, setSending ] = useState( false );
	const [ testResult, setTestResult ] = useState( null ); // { ok, message }

	const sendTestEmail = async () => {
		setSending( true );
		setTestResult( null );
		try {
			const res = await apiFetch( {
				path: '/subtleforms/v1/onboarding/send-test-email',
				method: 'POST',
			} );
			if ( res && res.success === false ) {
				setTestResult( {
					ok: false,
					message:
						res.message ||
						__(
							'Failed to send test email.',
							'subtleforms'
						),
				} );
			} else {
				setTestResult( {
					ok: true,
					message: __(
						'Test email sent to your admin email address.',
						'subtleforms'
					),
				} );
			}
		} catch ( err ) {
			setTestResult( {
				ok: false,
				message:
					err?.message ||
					__(
						'Failed to send test email.',
						'subtleforms'
					),
			} );
		} finally {
			setSending( false );
		}
	};

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
						'Turns admin notification emails on or off for every form. Each form still has its own email action.',
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
						'Turns the confirmation email on or off for every form. It stays off until you turn this on.',
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
					help={ sprintf(
						/* translators: %s: default sender email */
						__(
							'Email sender address (leave empty for %s). Using a domain other than your site domain may cause delivery issues.',
							'subtleforms'
						),
						defaultSender
					) }
					placeholder={ defaultSender }
				/>
				<FieldError errors={ fieldErrors.sender_email } />
				{ domainMismatch && (
					<Notice status="warning" isDismissible={ false }>
						{ sprintf(
							/* translators: 1: sender domain, 2: site domain */
							__(
								'The sender domain (%1$s) does not match your site domain (%2$s). Emails may be rejected or marked as spam. Consider using an address @%2$s or configure SPF/DMARC for your sender domain.',
								'subtleforms'
							),
							senderDomain,
							siteDomain
						) }
					</Notice>
				) }
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

			<div className="sf-settings-section__test-email">
				<Button
					variant="secondary"
					onClick={ sendTestEmail }
					disabled={ sending }
				>
					{ sending
						? __( 'Sending…', 'subtleforms' )
						: __( 'Send test email', 'subtleforms' ) }
				</Button>
				{ testResult && (
					<Notice
						status={ testResult.ok ? 'success' : 'error' }
						isDismissible={ false }
						className="sf-settings-section__test-email-result"
					>
						{ testResult.message }
					</Notice>
				) }
			</div>
		</div>
	);
}
