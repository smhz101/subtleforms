/**
 * Feature Gate — Centralized Pro gating system.
 *
 * Provides an imperative API for use inside event handlers where React hooks
 * cannot be called. Reads capabilities synchronously from the server-injected
 * window object, consistent with the PHP Capabilities system.
 *
 * @example
 *   // Check synchronously
 *   if (isProFeature('submissions.export')) { ... }
 *
 *   // Gate an action — runs it if allowed, opens upgrade modal if not
 *   requirePro('submissions.export', () => exportCSV());
 *
 *   // Open the modal directly with context
 *   openUpgradeModal('extensions.webhooks', { label: 'Webhooks' });
 */

/**
 * Check if a capability is available for the current user/plan.
 * Reads synchronously from the server-injected capabilities map.
 *
 * @param {string} featureKey  e.g. 'submissions.export', 'actions.payment'
 * @returns {boolean}
 */
export function isProFeature( featureKey ) {
	const caps = window.subtleformsAdmin?.capabilities ?? {};
	return caps[ featureKey ] === true;
}

/**
 * Open the global upgrade modal for a given feature.
 * Fires a custom DOM event consumed by <UpgradeModal /> mounted at the app root.
 *
 * @param {string} featureKey  Capability key.
 * @param {Object} [context]   Optional context ({ label, slug }) passed for copy lookup.
 */
export function openUpgradeModal( featureKey, context = {} ) {
	window.dispatchEvent(
		new CustomEvent( 'sf:upgrade:required', {
			detail: { featureKey, ...context },
		} )
	);
}

/**
 * Gate an action behind a Pro capability.
 *
 * If the capability is granted, calls actionCallback immediately.
 * Otherwise, opens the global upgrade modal and returns without running the action.
 *
 * @param {string}   featureKey      Capability key to check.
 * @param {Function} actionCallback  Action to run if capability is allowed.
 * @param {Object}   [context]       Optional context for the upgrade modal.
 */
export function requirePro( featureKey, actionCallback, context = {} ) {
	if ( isProFeature( featureKey ) ) {
		actionCallback();
		return;
	}
	openUpgradeModal( featureKey, context );
}
