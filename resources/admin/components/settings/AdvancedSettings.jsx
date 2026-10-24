import { useEffect, useState } from '@wordpress/element';
import {
	Button,
	TextControl,
	TextareaControl,
	ToggleControl,
	SelectControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from './FieldError';

/** Turn the textarea (one address or range per line, or commas) into a list. */
export function parseProxyList( text ) {
	return String( text || '' )
		.split( /[\s,]+/ )
		.map( ( item ) => item.trim() )
		.filter( Boolean );
}

/**
 * Visitor IP behind a proxy: the proxies whose forwarding headers are believed.
 */
function ProxySettings( { settings, updateSetting, fieldErrors } ) {
	const list = Array.isArray( settings.trusted_proxy_cidrs )
		? settings.trusted_proxy_cidrs
		: parseProxyList( settings.trusted_proxy_cidrs );
	const [ text, setText ] = useState( list.join( '\n' ) );

	// Follow a reset or a reload, but never rewrite what the person is typing.
	useEffect( () => {
		if ( parseProxyList( text ).join( ' ' ) !== list.join( ' ' ) ) {
			setText( list.join( '\n' ) );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ list.join( ' ' ) ] );

	return (
		<div>
			<h4 className="sf-section-title">
				{ __( 'Visitor IP behind a proxy', 'subtleforms' ) }
			</h4>
			<ToggleControl
				label={ __( 'Site is behind Cloudflare', 'subtleforms' ) }
				checked={ !! settings.trust_cloudflare }
				onChange={ ( value ) =>
					updateSetting( 'trust_cloudflare', value )
				}
				help={ __(
					'Read the visitor address from Cloudflare when the request really comes from Cloudflare. Leave this off if the site is not behind Cloudflare.',
					'subtleforms'
				) }
			/>
			<FieldError errors={ fieldErrors.trust_cloudflare } />
			<TextareaControl
				label={ __( 'Trusted proxy addresses', 'subtleforms' ) }
				value={ text }
				rows={ 3 }
				onChange={ ( value ) => {
					setText( value );
					updateSetting( 'trusted_proxy_cidrs', parseProxyList( value ) );
				} }
				help={ __(
					'One IP address or range (such as 10.0.0.0/8) per line. Only requests from these addresses may say who the visitor is. Leave empty unless a load balancer or reverse proxy sits in front of the site.',
					'subtleforms'
				) }
			/>
			<FieldError errors={ fieldErrors.trusted_proxy_cidrs } />
		</div>
	);
}

/**
 * Advanced Settings Tab
 *
 * Debug mode, spam protection, CAPTCHA providers, privacy/GDPR, danger zone.
 *
 * @param {Object}   props
 * @param {Object}   props.settings      - Current settings values
 * @param {Function} props.updateSetting  - (key, value) => void
 * @param {Function} props.resetSettings  - Reset all settings to defaults
 * @param {boolean}  props.saving         - Whether a save/reset is in progress
 * @param {Object}   props.fieldErrors    - Per-field validation errors
 */
export default function AdvancedSettings( {
	settings,
	updateSetting,
	resetSettings,
	saving,
	fieldErrors = {},
} ) {
	return (
		<div className="sf-settings-section">
			<div>
				<ToggleControl
					label={ __( 'Debug Mode', 'subtleforms' ) }
					checked={ settings.debug_mode }
					onChange={ ( value ) =>
						updateSetting( 'debug_mode', value )
					}
					help={ __(
						'Enable detailed logging for troubleshooting',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.debug_mode } />
			</div>

			{/* ── Spam Protection ── */ }
			<div>
				<h4 className="sf-section-title">
					{ __( 'Spam Protection', 'subtleforms' ) }
				</h4>
				<ToggleControl
					label={ __(
						'Hidden trap field on new forms',
						'subtleforms'
					) }
					checked={ settings.enable_honeypot ?? true }
					onChange={ ( value ) =>
						updateSetting( 'enable_honeypot', value )
					}
					help={ __(
						'New forms start with a field that visitors never see and robots fill in. Each form can change this under Form settings, Spam protection.',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.enable_honeypot } />
			</div>

			<div>
				<TextControl
					label={ __(
						'Too-fast check (seconds)',
						'subtleforms'
					) }
					type="number"
					value={ String( settings.min_submission_time ?? 3 ) }
					onChange={ ( value ) =>
						updateSetting(
							'min_submission_time',
							parseInt( value )
						)
					}
					min="0"
					max="60"
					help={ __(
						'Anything sent sooner than this after the form loaded is dropped quietly. 0 turns the check off for new forms and for forms that have no setting of their own.',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.min_submission_time } />
			</div>

			<ProxySettings
				settings={ settings }
				updateSetting={ updateSetting }
				fieldErrors={ fieldErrors }
			/>

			{/* ── CAPTCHA ── */ }
			<div>
				<h4 className="sf-section-title">
					{ __( 'CAPTCHA', 'subtleforms' ) }
				</h4>
				<ToggleControl
					label={ __( 'Enable CAPTCHA', 'subtleforms' ) }
					checked={ settings.captcha_enabled ?? false }
					onChange={ ( value ) =>
						updateSetting( 'captcha_enabled', value )
					}
					help={ __(
						'Require CAPTCHA verification on forms to prevent spam and bot submissions',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.captcha_enabled } />
			</div>

			{ settings.captcha_enabled && (
				<>
					{/* Google reCAPTCHA */ }
					<div>
						<h5 className="sf-subsection-title">
							{ __( 'Google reCAPTCHA', 'subtleforms' ) }
						</h5>
						<ToggleControl
							label={ __(
								'Enable reCAPTCHA',
								'subtleforms'
							) }
							checked={
								settings.captcha_recaptcha_enabled ?? false
							}
							onChange={ ( value ) =>
								updateSetting(
									'captcha_recaptcha_enabled',
									value
								)
							}
							help={ __(
								'Allow forms to use Google reCAPTCHA',
								'subtleforms'
							) }
						/>
						<FieldError
							errors={
								fieldErrors.captcha_recaptcha_enabled
							}
						/>
					</div>

					{ settings.captcha_recaptcha_enabled && (
						<>
							<div>
								<SelectControl
									label={ __(
										'reCAPTCHA Version',
										'subtleforms'
									) }
									value={
										settings.captcha_recaptcha_version ??
										'v2'
									}
									onChange={ ( value ) =>
										updateSetting(
											'captcha_recaptcha_version',
											value
										)
									}
									options={ [
										{
											label: 'v2 (Checkbox)',
											value: 'v2',
										},
										{
											label: 'v3 (Invisible)',
											value: 'v3',
										},
									] }
								/>
								<FieldError
									errors={
										fieldErrors.captcha_recaptcha_version
									}
								/>
							</div>
							<div>
								<TextControl
									label={ __(
										'Site Key',
										'subtleforms'
									) }
									value={
										settings.captcha_recaptcha_site_key ??
										''
									}
									onChange={ ( value ) =>
										updateSetting(
											'captcha_recaptcha_site_key',
											value
										)
									}
									help={ __(
										'Get your keys from https://www.google.com/recaptcha/admin',
										'subtleforms'
									) }
								/>
								<FieldError
									errors={
										fieldErrors.captcha_recaptcha_site_key
									}
								/>
							</div>
							<div>
								<TextControl
									label={ __(
										'Secret Key',
										'subtleforms'
									) }
									type="password"
									value={
										settings.captcha_recaptcha_secret_key ??
										''
									}
									onChange={ ( value ) =>
										updateSetting(
											'captcha_recaptcha_secret_key',
											value
										)
									}
								/>
								<FieldError
									errors={
										fieldErrors.captcha_recaptcha_secret_key
									}
								/>
							</div>
						</>
					) }

					{/* hCaptcha */ }
					<div>
						<h5 className="sf-subsection-title">
							{ __( 'hCaptcha', 'subtleforms' ) }
						</h5>
						<ToggleControl
							label={ __(
								'Enable hCaptcha',
								'subtleforms'
							) }
							checked={
								settings.captcha_hcaptcha_enabled ?? false
							}
							onChange={ ( value ) =>
								updateSetting(
									'captcha_hcaptcha_enabled',
									value
								)
							}
							help={ __(
								'Allow forms to use hCaptcha',
								'subtleforms'
							) }
						/>
						<FieldError
							errors={
								fieldErrors.captcha_hcaptcha_enabled
							}
						/>
					</div>

					{ settings.captcha_hcaptcha_enabled && (
						<>
							<div>
								<TextControl
									label={ __(
										'Site Key',
										'subtleforms'
									) }
									value={
										settings.captcha_hcaptcha_site_key ??
										''
									}
									onChange={ ( value ) =>
										updateSetting(
											'captcha_hcaptcha_site_key',
											value
										)
									}
									help={ __(
										'Get your keys from https://dashboard.hcaptcha.com/',
										'subtleforms'
									) }
								/>
								<FieldError
									errors={
										fieldErrors.captcha_hcaptcha_site_key
									}
								/>
							</div>
							<div>
								<TextControl
									label={ __(
										'Secret Key',
										'subtleforms'
									) }
									type="password"
									value={
										settings.captcha_hcaptcha_secret_key ??
										''
									}
									onChange={ ( value ) =>
										updateSetting(
											'captcha_hcaptcha_secret_key',
											value
										)
									}
								/>
								<FieldError
									errors={
										fieldErrors.captcha_hcaptcha_secret_key
									}
								/>
							</div>
						</>
					) }

					{/* Cloudflare Turnstile */ }
					<div>
						<h5 className="sf-subsection-title">
							{ __(
								'Cloudflare Turnstile',
								'subtleforms'
							) }
						</h5>
						<ToggleControl
							label={ __(
								'Enable Turnstile',
								'subtleforms'
							) }
							checked={
								settings.captcha_turnstile_enabled ?? false
							}
							onChange={ ( value ) =>
								updateSetting(
									'captcha_turnstile_enabled',
									value
								)
							}
							help={ __(
								'Allow forms to use Cloudflare Turnstile',
								'subtleforms'
							) }
						/>
						<FieldError
							errors={
								fieldErrors.captcha_turnstile_enabled
							}
						/>
					</div>

					{ settings.captcha_turnstile_enabled && (
						<>
							<div>
								<TextControl
									label={ __(
										'Site Key',
										'subtleforms'
									) }
									value={
										settings.captcha_turnstile_site_key ??
										''
									}
									onChange={ ( value ) =>
										updateSetting(
											'captcha_turnstile_site_key',
											value
										)
									}
									help={ __(
										'Get your keys from https://dash.cloudflare.com/?to=/:account/turnstile',
										'subtleforms'
									) }
								/>
								<FieldError
									errors={
										fieldErrors.captcha_turnstile_site_key
									}
								/>
							</div>
							<div>
								<TextControl
									label={ __(
										'Secret Key',
										'subtleforms'
									) }
									type="password"
									value={
										settings.captcha_turnstile_secret_key ??
										''
									}
									onChange={ ( value ) =>
										updateSetting(
											'captcha_turnstile_secret_key',
											value
										)
									}
								/>
								<FieldError
									errors={
										fieldErrors.captcha_turnstile_secret_key
									}
								/>
							</div>
						</>
					) }
				</>
			) }

			{/* ── Privacy & GDPR ── */ }
			<div>
				<h4 className="sf-section-title">
					{ __( 'Privacy & GDPR', 'subtleforms' ) }
				</h4>
				<TextControl
					label={ __(
						'Data Retention Period (days)',
						'subtleforms'
					) }
					type="number"
					value={ String( settings.data_retention_days ?? 0 ) }
					onChange={ ( value ) =>
						updateSetting(
							'data_retention_days',
							parseInt( value )
						)
					}
					min="0"
					max="3650"
					help={ __(
						'Automatically delete submissions older than this many days. Set to 0 to keep submissions forever. Recommended: 365-730 days for GDPR compliance.',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.data_retention_days } />
				<TextControl
					label={ __( 'Empty the entries Trash after (days)', 'subtleforms' ) }
					type="number"
					value={ String( settings.entries_trash_days ?? 30 ) }
					onChange={ ( value ) =>
						updateSetting( 'entries_trash_days', parseInt( value ) )
					}
					min="1"
					max="365"
					help={ __(
						'Deleted entries stay in the Trash for this many days and can be restored. After that they are deleted permanently, with their uploaded files.',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.entries_trash_days } />
				<ToggleControl
					label={ __(
						'Keep my data when the plugin is deleted',
						'subtleforms'
					) }
					checked={ !! settings.keep_data_on_uninstall }
					onChange={ ( value ) =>
						updateSetting( 'keep_data_on_uninstall', !! value )
					}
					help={ __(
						'Off by default. When this is off, deleting SubtleForms from the Plugins screen removes its forms, entries, settings and uploaded files. Data that other plugins store is not removed.',
						'subtleforms'
					) }
				/>
				<FieldError errors={ fieldErrors.keep_data_on_uninstall } />
				<p className="sf-section-description">
					{ __(
						'Note: Submissions can also be exported or erased via WordPress Privacy Tools (Tools → Export/Erase Personal Data).',
						'subtleforms'
					) }
				</p>
			</div>

			{/* ── Danger Zone ── */ }
			<div className="subtleforms-settings-danger-zone">
				<h3>{ __( 'Danger Zone', 'subtleforms' ) }</h3>
				<p>
					{ __(
						'Resetting will restore all settings to their default values. This action cannot be undone.',
						'subtleforms'
					) }
				</p>
				<Button
					variant="tertiary"
					isDestructive
					onClick={ resetSettings }
					disabled={ saving }
				>
					{ __( 'Reset All Settings', 'subtleforms' ) }
				</Button>
			</div>
		</div>
	);
}
