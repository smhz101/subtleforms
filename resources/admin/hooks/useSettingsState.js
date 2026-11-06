/**
 * useSettingsState, Settings data management hook
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
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/apiClient';
import { queryKeys } from '../data/queryKeys';
import { validateSettings, validateField } from '../utils/validation';
import { confirmDialog } from '../utils/confirmDialog';
import { applySettingsRedirects } from '../utils/settingsRedirects';

/**
 * Normalize boolean fields coming from the REST API.
 */

/**
 * Settings → General is the inbox default for admins who have not chosen
 * their own. Keep the value the submissions page reads on its next visit.
 *
 * @param {Object} saved Settings just stored.
 */
function publishInboxDefaults( saved ) {
	const admin = window.subtleformsAdmin;
	if ( ! admin || ! saved?.submissions_density || ! saved?.submissions_reading_pane ) {
		return;
	}
	const site = {
		density: saved.submissions_density,
		reading_pane: saved.submissions_reading_pane,
	};
	const current = admin.submissionsView || {};
	admin.submissionsView = current.personal
		? { ...current, site }
		: { ...site, personal: false, site };
}

function normalizeSettings( data ) {
	return {
		...data,
		autosave_enabled: Boolean( data.autosave_enabled ),
		submission_limit_enabled: Boolean( data.submission_limit_enabled ),
		admin_notification_enabled: Boolean( data.admin_notification_enabled ),
		user_confirmation_enabled: Boolean( data.user_confirmation_enabled ),
		debug_mode: Boolean( data.debug_mode ),
		keep_data_on_uninstall: Boolean( data.keep_data_on_uninstall ),
		captcha_enabled: Boolean( data.captcha_enabled ),
		captcha_recaptcha_enabled: Boolean( data.captcha_recaptcha_enabled ),
		captcha_hcaptcha_enabled: Boolean( data.captcha_hcaptcha_enabled ),
		captcha_turnstile_enabled: Boolean( data.captcha_turnstile_enabled ),
		ext_webhooks_enabled: Boolean( data.ext_webhooks_enabled ),
	};
}

/** Seconds-old settings are shown again without a request. */
export const SETTINGS_STALE_TIME = 60 * 1000;

/**
 * The settings the cache already holds (the page sent them, or Settings was
 * open a moment ago), in the shape the screen edits; or null.
 *
 * @param {Object} client Query client.
 * @return {?Object} Settings.
 */
function cachedSettings( client ) {
	const cached = client.getQueryData( queryKeys.settings.general() );
	return cached && cached.success && cached.data ? normalizeSettings( cached.data ) : null;
}

export default function useSettingsState() {
	const queryClient = useQueryClient();
	const [ settings, setSettings ] = useState( () => cachedSettings( queryClient ) );
	const [ loading, setLoading ] = useState( () => cachedSettings( queryClient ) === null );
	const [ saving, setSaving ] = useState( false );
	const [ message, setMessage ] = useState( null );
	const [ hasChanges, setHasChanges ] = useState( false );
	const [ fieldErrors, setFieldErrors ] = useState( {} );
	// Initialise from URL hash (e.g. #tab=extensions) so page reloads can
	// land on a specific tab.
	const initialTab = ( () => {
		// A tab that moved (the logs left Tools) is looked up under its new address.
		applySettingsRedirects();
		const match = window.location.hash.match( /[#&]tab=([\w-]+)/ );
		return match ? match[ 1 ] : 'general';
	} )();
	const [ activeTab, setActiveTab ] = useState( initialTab );

	// ── Load ─────────────────────────────────────────────────────────────

	// Settings come from the query cache while they are under a minute old
	// (and from the page itself when Settings is the landing screen), so
	// opening the screen again does not wait for the server. `force` asks the
	// server (Discard).
	const load = useCallback( async ( force ) => {
		try {
			if ( force ) {
				setLoading( true );
			}
			const response = await queryClient.fetchQuery( {
				queryKey: queryKeys.settings.general(),
				queryFn: () => apiClient.get( '/settings' ),
				staleTime: force ? 0 : SETTINGS_STALE_TIME,
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
	}, [ queryClient ] );

	const loadSettings = useCallback( () => load( true ), [ load ] );

	useEffect( () => {
		// An unsaved edit stays; only an empty screen takes what the cache has.
		load( false );
	}, [ load ] );

	// What was saved is the new truth for the cache, and every screen that read
	// the old settings (the Forms list reads the inbox defaults) fetches again.
	const storeSaved = useCallback( ( response ) => {
		queryClient.setQueryData( queryKeys.settings.general(), { success: true, data: response.data } );
		queryClient.invalidateQueries( { queryKey: queryKeys.settings.all } );
	}, [ queryClient ] );

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
				// Keep 0 (and any other out-of-range number). `|| 3` turned 0 into
				// the default and reported a successful save.
				autosave_interval: parseInt( settings.autosave_interval, 10 ),
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
				publishInboxDefaults( response.data );
				storeSaved( response );
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
	}, [ settings, storeSaved ] );

	// ── Reset ────────────────────────────────────────────────────────────

	const resetSettings = useCallback( async () => {
		if (
			! ( await confirmDialog( {
				destructive: true,
				confirmText: __( 'Reset settings', 'subtleforms' ),
				message: __(
					'Are you sure you want to reset all settings to defaults? This cannot be undone.',
					'subtleforms'
				),
			} ) )
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
				publishInboxDefaults( response.data );
				setHasChanges( false );
				storeSaved( response );
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
	}, [ storeSaved ] );

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
