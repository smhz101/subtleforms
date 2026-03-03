/**
 * License Utilities (Legacy)
 *
 * Frontend utilities for checking license status and feature availability.
 * Currently used by LicenseSettings.jsx for activate/deactivate/validate.
 *
 * @deprecated 1.9.0 Query functions (getLicenseStatus, isPro, hasFeature, etc.)
 *   are superseded by the TanStack Query hook in data/queries/settings.js.
 *   Mutation functions (activateLicense, deactivateLicense, validateLicense)
 *   are superseded by hooks in data/mutations/settings.js.
 *   Prefer the data/* layer for new code. This file will be removed once
 *   LicenseSettings.jsx is migrated to TanStack Query hooks.
 *
 * @package SubtleForms
 * @since 2.0.0
 */

import apiFetch from '@wordpress/api-fetch';

/**
 * License status cache
 */
let licenseCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get license status
 *
 * @param {boolean} force Force refresh from server
 * @returns {Promise<Object>} License data
 */
export async function getLicenseStatus(force = false) {
	// Return cached data if available and fresh
	if (!force && licenseCache && cacheTimestamp) {
		const age = Date.now() - cacheTimestamp;
		if (age < CACHE_TTL) {
			return licenseCache;
		}
	}

	try {
		const response = await apiFetch({
			path: '/subtleforms/v1/license/status',
			method: 'GET',
		});

		if (response.success) {
			licenseCache = response.data;
			cacheTimestamp = Date.now();
			return response.data;
		}

		throw new Error(response.message || 'Failed to fetch license status');
	} catch (error) {
		console.error('License status fetch error:', error);
		// Return default free license data on error
		return {
			key: null,
			status: 'inactive',
			plan: 'free',
			is_valid: false,
			expires_at: null,
			days_until_expiration: null,
		};
	}
}

/**
 * Activate license
 *
 * @param {string} key License key
 * @returns {Promise<Object>} Activation result
 */
export async function activateLicense(key) {
	try {
		const response = await apiFetch({
			path: '/subtleforms/v1/license/activate',
			method: 'POST',
			data: { key },
		});

		// Clear cache on activation
		licenseCache = null;
		cacheTimestamp = null;

		return response;
	} catch (error) {
		console.error('License activation error:', error);
		throw error;
	}
}

/**
 * Deactivate license
 *
 * @returns {Promise<Object>} Deactivation result
 */
export async function deactivateLicense() {
	try {
		const response = await apiFetch({
			path: '/subtleforms/v1/license/deactivate',
			method: 'POST',
		});

		// Clear cache on deactivation
		licenseCache = null;
		cacheTimestamp = null;

		return response;
	} catch (error) {
		console.error('License deactivation error:', error);
		throw error;
	}
}

/**
 * Validate license (force refresh)
 *
 * @returns {Promise<Object>} Validation result
 */
export async function validateLicense() {
	try {
		const response = await apiFetch({
			path: '/subtleforms/v1/license/validate',
			method: 'POST',
		});

		// Clear cache on validation
		licenseCache = null;
		cacheTimestamp = null;

		return response;
	} catch (error) {
		console.error('License validation error:', error);
		throw error;
	}
}

/**
 * Check if Pro version is active
 *
 * @returns {Promise<boolean>}
 */
export async function isPro() {
	const status = await getLicenseStatus();
	return status.is_valid === true;
}

/**
 * Check if specific feature is available
 *
 * @param {string} feature Feature key
 * @returns {Promise<boolean>}
 */
export async function hasFeature(feature) {
	const status = await getLicenseStatus();

	// Free features always available
	const freeFeatures = [
		'basic_forms',
		'standard_fields',
		'email_notifications',
		'entries_management',
		'export_csv',
	];

	if (freeFeatures.includes(feature)) {
		return true;
	}

	// Pro features require valid license
	if (!status.is_valid) {
		return false;
	}

	// Check plan-specific features
	const plan = status.plan || 'free';

	const proFeatures = [
		'advanced_fields',
		'conditional_logic',
		'file_uploads',
		'payment_forms',
		'webhooks',
		'templates.pro',
		'ai_spam_detection',
		'ai_workflows',
		'ai_form_assist',
		'ai_routing',
	];

	const businessFeatures = [
		'multi_site',
		'white_label',
		'priority_support',
		'custom_integrations',
	];

	if (plan === 'business') {
		return proFeatures.includes(feature) || businessFeatures.includes(feature);
	}

	if (plan === 'pro') {
		return proFeatures.includes(feature);
	}

	return false;
}

/**
 * Check if AI features are available
 *
 * @returns {Promise<boolean>}
 */
export async function canUseAI() {
	const [spam, workflows, assist, routing] = await Promise.all([
		hasFeature('ai_spam_detection'),
		hasFeature('ai_workflows'),
		hasFeature('ai_form_assist'),
		hasFeature('ai_routing'),
	]);

	return spam || workflows || assist || routing;
}

/**
 * Check if specific AI agent is available
 *
 * @param {string} agent Agent name (spam_detection, workflows, form_assist, routing)
 * @returns {Promise<boolean>}
 */
export async function canUseAIAgent(agent) {
	const featureMap = {
		spam_detection: 'ai_spam_detection',
		workflows: 'ai_workflows',
		form_assist: 'ai_form_assist',
		routing: 'ai_routing',
	};

	const feature = featureMap[agent];
	if (!feature) {
		return false;
	}

	return hasFeature(feature);
}

/**
 * Get license status string
 *
 * @returns {Promise<string>}
 */
export async function getStatus() {
	const status = await getLicenseStatus();
	return status.status || 'inactive';
}

/**
 * Get license plan
 *
 * @returns {Promise<string>}
 */
export async function getPlan() {
	const status = await getLicenseStatus();
	return status.plan || 'free';
}

/**
 * Get days until expiration
 *
 * @returns {Promise<number|null>}
 */
export async function getDaysUntilExpiration() {
	const status = await getLicenseStatus();
	return status.days_until_expiration ?? null;
}

/**
 * Check if in grace period
 *
 * @returns {Promise<boolean>}
 */
export async function isGracePeriod() {
	const status = await getStatus();
	return status === 'grace_period';
}

/**
 * Get upgrade URL
 *
 * @param {string} feature Optional feature to highlight
 * @returns {string}
 */
export function getUpgradeUrl(feature = '') {
	let url = 'https://subtleforms.com/pricing/';
	if (feature) {
		url += `?feature=${encodeURIComponent(feature)}`;
	}
	return url;
}

/**
 * Clear license cache
 */
export function clearCache() {
	licenseCache = null;
	cacheTimestamp = null;
}
