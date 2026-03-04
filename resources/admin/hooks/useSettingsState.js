/**
 * useSettingsState — Settings data management hook
 *
 * Extracts all settings state management logic from SettingsPage:
 * - Fetch settings on mount
 * - Field-level validation
 * - Save with Joi validation
 * - Reset to defaults
 * - Dirty tracking
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { validateSettings, validateField } from '../utils/validation';

/**
 * Normalize boolean fields coming from the REST API.
 */
function normalizeSettings( data ) {
	return {
		...data,
		autosave_enabled: Boolean( data.autosave_enabled ),
		submission_limit_enabled: Boolean( data.submission_limit_enabled ),
		admin_notification_enabled: Boolean( data.admin_notification_enabled ),
		user_confirmation_enabled: Boolean( data.user_confirmation_enabled ),
		debug_mode: Boolean( data.debug_mode ),
		captcha_enabled: Boolean( data.captcha_enabled ),
		captcha_recaptcha_enabled: Boolean( data.captcha_recaptcha_enabled ),
		captcha_hcaptcha_enabled: Boolean( data.captcha_hcaptcha_enabled ),
		captcha_turnstile_enabled: Boolean( data.captcha_turnstile_enabled ),
	};
}

export default function useSettingsState() {
	const [ settings, setSettings ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ message, setMessage ] = useState( null );
	const [ hasChanges, setHasChanges ] = useState( false );
	const [ fieldErrors, setFieldErrors ] = useState( {} );
	const [ activeTab, setActiveTab ] = useState( 'general' );

	// ── Load ─────────────────────────────────────────────────────────────

	const loadSettings = useCallback( async () => {
		try {
			setLoading( true );
			const response = await apiFetch( {
				path: '/subtleforms/v1/settings',
				method: 'GET',
			} );

			if ( response.success ) {
				setSettings( normalizeSettings( response.data ) );
			}
		} catch ( error ) {
			console.error( 'Failed to load settings:', error );
			setMessage( {
				type: 'error',
				text: __(
					'Failed to load settings. Please try again.',
					'subtleforms'
				),
			} );
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		loadSettings();
	}, [ loadSettings ] );

	// ── Update single field ──────────────────────────────────────────────

	const updateSetting = useCallback( ( key, value ) => {
		let finalValue = value;

		// Integer coercion
		if ( key === 'autosave_interval' || key === 'submission_limit' ) {
			finalValue = parseInt( value, 10 );
			if ( isNaN( finalValue ) ) {
				setFieldErrors( ( prev ) => ( {
					...prev,
					[ key ]: [
						__( 'Must be a valid number', 'subtleforms' ),
					],
				} ) );
				return;
			}
		}

		// Per-field validation
		const { isValid, error } = validateField( key, finalValue );
		setFieldErrors( ( prev ) => ( {
			...prev,
			[ key ]: isValid ? [] : [ error ],
		} ) );

		setSettings( ( prev ) => ( { ...prev, [ key ]: finalValue } ) );
		setHasChanges( true );
	}, [] );

	// ── Save ─────────────────────────────────────────────────────────────

	const saveSettings = useCallback( async () => {
		try {
			setSaving( true );
			setMessage( null );
			setFieldErrors( {} );

			const settingsToSave = {
				...settings,
				autosave_interval:
					parseInt( settings.autosave_interval, 10 ) || 3,
				submission_limit:
					parseInt( settings.submission_limit, 10 ) || 1,
			};

			const { isValid, errors } = validateSettings( settingsToSave );

			if ( ! isValid ) {
				setFieldErrors( errors );
				setMessage( {
					type: 'error',
					text: __(
						'Please fix the validation errors below before saving.',
						'subtleforms'
					),
				} );
				return;
			}

			const response = await apiFetch( {
				path: '/subtleforms/v1/settings',
				method: 'PUT',
				data: settingsToSave,
			} );

			if ( response.success ) {
				setMessage( {
					type: 'success',
					text:
						response.message ||
						__(
							'Settings saved successfully!',
							'subtleforms'
						),
				} );
				setHasChanges( false );
				setSettings( normalizeSettings( response.data ) );
			}
		} catch ( error ) {
			console.error( 'Failed to save settings:', error );
			setMessage( {
				type: 'error',
				text:
					error.message ||
					__(
						'Failed to save settings. Please try again.',
						'subtleforms'
					),
			} );
		} finally {
			setSaving( false );
		}
	}, [ settings ] );

	// ── Reset ────────────────────────────────────────────────────────────

	const resetSettings = useCallback( async () => {
		if (
			! confirm(
				__(
					'Are you sure you want to reset all settings to defaults? This cannot be undone.',
					'subtleforms'
				)
			)
		) {
			return;
		}

		try {
			setSaving( true );
			setMessage( null );

			const response = await apiFetch( {
				path: '/subtleforms/v1/settings/reset',
				method: 'POST',
			} );

			if ( response.success ) {
				setMessage( {
					type: 'success',
					text:
						response.message ||
						__(
							'Settings reset successfully!',
							'subtleforms'
						),
				} );
				setSettings( normalizeSettings( response.data ) );
				setHasChanges( false );
			}
		} catch ( error ) {
			console.error( 'Failed to reset settings:', error );
			setMessage( {
				type: 'error',
				text: __(
					'Failed to reset settings. Please try again.',
					'subtleforms'
				),
			} );
		} finally {
			setSaving( false );
		}
	}, [] );

	// ── Public API ───────────────────────────────────────────────────────

	return {
		settings,
		loading,
		saving,
		message,
		setMessage,
		fieldErrors,
		hasChanges,
		activeTab,
		setActiveTab,
		updateSetting,
		saveSettings,
		loadSettings,
		resetSettings,
	};
}
