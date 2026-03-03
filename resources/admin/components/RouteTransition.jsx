/**
 * RouteTransition - Loading State for Route Changes
 *
 * Displays a loading indicator during page transitions.
 * Uses Suspense-compatible pattern.
 */

import { __ } from '@wordpress/i18n';
import './RouteTransition.scss';

export function RouteLoadingFallback() {
	return (
		<div className="sf-route-transition">
			<div className="sf-route-transition__container">
				{/* Animated Logo/Spinner */}
				<div className="sf-route-transition__spinner">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none">
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeDasharray="60"
							strokeDashoffset="30"
							className="sf-route-transition__spinner-circle"
						/>
					</svg>
				</div>

				{/* Loading Text */}
				<p className="sf-route-transition__text">
					{__('Loading...', 'subtleforms')}
				</p>
			</div>
		</div>
	);
}

/**
 * Minimal loading indicator for smooth transitions
 */
export function RouteLoadingBar() {
	return (
		<div className="sf-route-loading-bar">
			<div className="sf-route-loading-bar__progress" />
		</div>
	);
}

export default RouteLoadingFallback;
