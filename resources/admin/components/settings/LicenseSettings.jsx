/**
 * License Settings Component (Free — Upgrade Placeholder)
 *
 * When SubtleForms Pro is active, this tab is replaced by the Pro
 * license activation UI. Without Pro, it shows upgrade information.
 *
 * @package SubtleForms
 * @since   2.0.0
 */

import { __ } from '@wordpress/i18n';
import { Card, CardBody, CardHeader } from '@wordpress/components';

const PRO_FEATURES = [
	{
		title: __( 'Conditional Logic', 'subtleforms' ),
		description: __( 'Show/hide fields based on user input.', 'subtleforms' ),
	},
	{
		title: __( 'File Uploads', 'subtleforms' ),
		description: __( 'Accept file uploads in your forms.', 'subtleforms' ),
	},
	{
		title: __( 'Payment Forms', 'subtleforms' ),
		description: __( 'Accept payments via Stripe and PayPal.', 'subtleforms' ),
	},
	{
		title: __( 'Webhooks', 'subtleforms' ),
		description: __( 'Send form data to external services.', 'subtleforms' ),
	},
	{
		title: __( 'Priority Support', 'subtleforms' ),
		description: __( 'Get help from our team within 24 hours.', 'subtleforms' ),
	},
];

export default function LicenseSettings() {
	// If Pro is loaded, delegate to its component.
	if ( window.SubtleFormsPro?.LicenseSettings ) {
		const ProLicenseSettings = window.SubtleFormsPro.LicenseSettings;
		return <ProLicenseSettings />;
	}

	return (
		<div className="sf-license-settings sf-license-settings--free">
			<Card>
				<CardHeader>
					<h2>{ __( 'Upgrade to SubtleForms Pro', 'subtleforms' ) }</h2>
				</CardHeader>
				<CardBody>
					<p>
						{ __( 'Unlock advanced features with a SubtleForms Pro license:', 'subtleforms' ) }
					</p>

					<ul className="sf-pro-features-list">
						{ PRO_FEATURES.map( ( feature ) => (
							<li key={ feature.title } className="sf-pro-feature-item">
								<strong>{ feature.title }</strong>
								<span>{ feature.description }</span>
							</li>
						) ) }
					</ul>

					<a
						href="https://subtleforms.com/pro"
						target="_blank"
						rel="noopener noreferrer"
						className="button button-primary button-hero"
					>
						{ __( 'Get SubtleForms Pro', 'subtleforms' ) }
					</a>
				</CardBody>
			</Card>
		</div>
	);
}
