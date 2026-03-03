/**
 * Pro Badge Component
 *
 * Displays a "Pro" badge to indicate premium features.
 *
 * @package SubtleForms
 * @since 2.0.0
 */

import { __ } from '@wordpress/i18n';
import './ProBadge.scss';

/**
 * Pro Badge Component
 *
 * @param {Object} props Component props
 * @param {string} props.text Badge text (default: "Pro")
 * @param {string} props.icon Badge icon (default: crown emoji)
 * @param {string} props.variant Badge variant: default, small, large
 * @param {string} props.className Additional CSS classes
 * @returns {JSX.Element}
 */
export default function ProBadge({
	text = __('Pro', 'subtleforms'),
	icon = '👑',
	variant = 'default',
	className = '',
}) {
	const classes = [
		'sf-pro-badge',
		`sf-pro-badge--${variant}`,
		className,
	].filter(Boolean).join(' ');

	return (
		<span className={classes}>
			<span className="sf-pro-badge__icon">{icon}</span>
			<span className="sf-pro-badge__text">{text}</span>
		</span>
	);
}

/**
 * Feature Label with Pro Badge
 *
 * Displays a feature label with an optional Pro badge.
 *
 * @param {Object} props Component props
 * @param {string} props.label Feature label
 * @param {boolean} props.isPro Whether feature is Pro
 * @param {string} props.className Additional CSS classes
 * @returns {JSX.Element}
 */
export function FeatureLabelWithBadge({ label, isPro = false, className = '' }) {
	return (
		<span className={`sf-feature-label ${className}`}>
			{label}
			{isPro && <ProBadge variant="small" />}
		</span>
	);
}

/**
 * Pro Lock Icon
 *
 * Simple lock icon for Pro features.
 *
 * @param {Object} props Component props
 * @param {string} props.className Additional CSS classes
 * @returns {JSX.Element}
 */
export function ProLock({ className = '' }) {
	return (
		<span className={`sf-pro-lock ${className}`} aria-label={__('Pro Feature', 'subtleforms')}>
			🔒
		</span>
	);
}
