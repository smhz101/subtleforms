/**
 * Upgrade Prompt Component
 *
 * Displays a prompt to upgrade to Pro when accessing locked features.
 *
 * @package SubtleForms
 * @since 2.0.0
 */

import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { getUpgradeUrl } from '../../utils/licensing';
import './UpgradePrompt.scss';

/**
 * Upgrade Prompt Component
 *
 * @param {Object} props Component props
 * @param {string} props.feature Feature name
 * @param {string} props.title Custom title
 * @param {string} props.message Custom message
 * @param {string} props.icon Icon emoji
 * @param {string} props.variant Variant: default, compact, overlay
 * @param {string} props.className Additional CSS classes
 * @returns {JSX.Element}
 */
export default function UpgradePrompt({
	feature = '',
	title = __('Pro Feature', 'subtleforms'),
	message,
	icon = '🔒',
	variant = 'default',
	className = '',
}) {
	const defaultMessage = feature
		? __(
			`This feature requires SubtleForms Pro. Upgrade now to unlock ${feature} and more!`,
			'subtleforms'
		)
		: __('This feature requires SubtleForms Pro. Upgrade now to unlock premium features!', 'subtleforms');

	const finalMessage = message || defaultMessage;
	const upgradeUrl = getUpgradeUrl(feature);

	const classes = [
		'sf-upgrade-prompt',
		`sf-upgrade-prompt--${variant}`,
		className,
	].filter(Boolean).join(' ');

	return (
		<div className={classes}>
			<div className="sf-upgrade-prompt__icon">{icon}</div>
			<div className="sf-upgrade-prompt__content">
				<h3 className="sf-upgrade-prompt__title">{title}</h3>
				<p className="sf-upgrade-prompt__message">{finalMessage}</p>
				<Button
					variant="primary"
					href={upgradeUrl}
					target="_blank"
					className="sf-upgrade-prompt__button"
				>
					{__('Upgrade to Pro', 'subtleforms')}
				</Button>
			</div>
		</div>
	);
}

/**
 * Upgrade Prompt Overlay
 *
 * Displays an overlay over locked content.
 *
 * @param {Object} props Component props
 * @param {string} props.feature Feature name
 * @param {React.ReactNode} props.children Content to overlay
 * @returns {JSX.Element}
 */
export function UpgradeOverlay({ feature, children }) {
	return (
		<div className="sf-upgrade-overlay">
			<div className="sf-upgrade-overlay__content">{children}</div>
			<div className="sf-upgrade-overlay__backdrop">
				<UpgradePrompt feature={feature} variant="overlay" />
			</div>
		</div>
	);
}

/**
 * Inline Upgrade Link
 *
 * Simple inline upgrade link.
 *
 * @param {Object} props Component props
 * @param {string} props.feature Feature name
 * @param {string} props.text Link text
 * @returns {JSX.Element}
 */
export function UpgradeLink({ feature = '', text = __('Upgrade to Pro', 'subtleforms') }) {
	const upgradeUrl = getUpgradeUrl(feature);

	return (
		<a
			href={upgradeUrl}
			target="_blank"
			rel="noopener noreferrer"
			className="sf-upgrade-link"
		>
			{text}
		</a>
	);
}
