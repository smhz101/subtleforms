/**
 * License Hook
 *
 * React hook for checking license status and feature availability.
 *
 * @package SubtleForms
 * @since 2.0.0
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	getLicenseStatus,
	hasFeature as checkFeature,
	isPro as checkPro,
	canUseAI as checkAI,
	canUseAIAgent as checkAIAgent,
	getStatus,
	getPlan,
	getDaysUntilExpiration,
	isGracePeriod as checkGracePeriod,
} from '../utils/licensing';

/**
 * Use License Hook
 *
 * @param {Object} options Hook options
 * @param {boolean} options.autoRefresh Auto-refresh license status
 * @param {number} options.refreshInterval Refresh interval in ms (default: 5 minutes)
 * @returns {Object} License state and methods
 */
export function useLicense(options = {}) {
	const { autoRefresh = false, refreshInterval = 5 * 60 * 1000 } = options;

	const [licenseData, setLicenseData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	/**
	 * Fetch license status
	 */
	const fetchLicense = useCallback(async (force = false) => {
		try {
			setLoading(true);
			setError(null);
			const data = await getLicenseStatus(force);
			setLicenseData(data);
		} catch (err) {
			console.error('License fetch error:', err);
			setError(err.message || 'Failed to fetch license status');
		} finally {
			setLoading(false);
		}
	}, []);

	/**
	 * Initial load
	 */
	useEffect(() => {
		fetchLicense();
	}, [fetchLicense]);

	/**
	 * Auto-refresh
	 */
	useEffect(() => {
		if (!autoRefresh) return;

		const interval = setInterval(() => {
			fetchLicense(true);
		}, refreshInterval);

		return () => clearInterval(interval);
	}, [autoRefresh, refreshInterval, fetchLicense]);

	/**
	 * Check if Pro is active
	 */
	const isPro = licenseData?.is_valid === true;

	/**
	 * Check if specific feature is available
	 */
	const hasFeature = useCallback(
		(feature) => {
			if (!licenseData) return false;
			return checkFeature(feature);
		},
		[licenseData]
	);

	/**
	 * Check if AI features are available
	 */
	const canUseAI = licenseData?.is_valid && (
		hasFeature('ai_spam_detection') ||
		hasFeature('ai_workflows') ||
		hasFeature('ai_form_assist') ||
		hasFeature('ai_routing')
	);

	/**
	 * Check if specific AI agent is available
	 */
	const canUseAIAgent = useCallback(
		(agent) => {
			if (!licenseData?.is_valid) return false;
			return checkAIAgent(agent);
		},
		[licenseData]
	);

	/**
	 * Refresh license status
	 */
	const refresh = useCallback(() => {
		return fetchLicense(true);
	}, [fetchLicense]);

	return {
		// State
		licenseData,
		loading,
		error,

		// Computed
		isPro,
		status: licenseData?.status || 'inactive',
		plan: licenseData?.plan || 'free',
		expiresAt: licenseData?.expires_at || null,
		daysUntilExpiration: licenseData?.days_until_expiration ?? null,
		isGracePeriod: licenseData?.status === 'grace_period',
		warnings: licenseData?.warnings || [],

		// Methods
		hasFeature,
		canUseAI,
		canUseAIAgent,
		refresh,
	};
}

/**
 * Use Feature Gate Hook
 *
 * Simplified hook for checking a single feature.
 *
 * @param {string} feature Feature key
 * @returns {Object} Feature availability state
 */
export function useFeatureGate(feature) {
	const { hasFeature, loading, isPro } = useLicense();
	const available = hasFeature(feature);

	return {
		available,
		locked: !available,
		loading,
		isPro,
	};
}

/**
 * Use AI Gate Hook
 *
 * Simplified hook for checking AI features.
 *
 * @param {string} agent Optional specific agent name
 * @returns {Object} AI availability state
 */
export function useAIGate(agent = null) {
	const { canUseAI, canUseAIAgent, loading, isPro } = useLicense();

	const available = agent ? canUseAIAgent(agent) : canUseAI;

	return {
		available,
		locked: !available,
		loading,
		isPro,
	};
}

/**
 * Use License Warnings Hook
 *
 * Hook for checking license warnings (expiration, grace period, etc).
 *
 * @returns {Object} Warning state
 */
export function useLicenseWarnings() {
	const {
		warnings,
		daysUntilExpiration,
		isGracePeriod,
		status,
		loading,
	} = useLicense();

	const hasWarnings = warnings.length > 0;
	const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 30;
	const isExpired = status === 'expired';
	const isInvalid = status === 'invalid';

	return {
		warnings,
		hasWarnings,
		isExpiringSoon,
		isExpired,
		isInvalid,
		isGracePeriod,
		daysUntilExpiration,
		loading,
	};
}
