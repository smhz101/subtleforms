/**
 * RouteTransition - Loading State for Route Changes
 *
 * Displays a loading indicator during page transitions.
 * Uses Suspense-compatible pattern.
 */

import { __ } from '@wordpress/i18n';
import Icon from './ui/Icon';
import './RouteTransition.scss';

export function RouteLoadingFallback() {
	return (
		<div className="sf-route-transition">
			<div className="sf-route-transition__container">
				{/* Animated Logo/Spinner */}
				<div className="sf-route-transition__spinner">
					<Icon.Spinner size={48} className="sf-route-transition__spinner-circle" />
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
