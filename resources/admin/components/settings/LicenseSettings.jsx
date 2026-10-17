/**
 * License settings.
 *
 * When SubtleForms Pro is active it supplies its own component (license key
 * activation, plan details). Without Pro this screen explains the plan the
 * site is on and what Pro adds, using the same panels so the two read as one
 * product.
 *
 * @package SubtleForms
 */

import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { PRO_URL, ACCOUNT_URL, PRO_CHECKLIST, PRO_PILLARS } from '../../data/proCatalog';

/**
 * Checklist of what Pro includes.
 *
 * @param {Object}  props
 * @param {boolean} props.included Whether the features are already unlocked.
 */
export function ProChecklist( { included = false } ) {
	return (
		<ul className={ `sf-checklist ${ included ? 'is-included' : '' }` }>
			{ PRO_CHECKLIST.map( ( item ) => (
				<li key={ item }>
					<Icon.Check size={ 16 } aria-hidden="true" />
					{ item }
				</li>
			) ) }
		</ul>
	);
}

export default function LicenseSettings() {
	const admin = window.subtleformsAdmin || {};

	// Pro owns this screen when it is loaded.
	if ( window.SubtleFormsPro?.LicenseSettings ) {
		const ProLicenseSettings = window.SubtleFormsPro.LicenseSettings;
		return <ProLicenseSettings />;
	}

	const version = admin.version || '';

	return (
		<div className="sf-license">
			<section className="sf-panel sf-plan-card">
				<div className="sf-plan-card__main">
					<span className="sf-plan-card__badge">{ __( 'Free', 'subtleforms' ) }</span>
					<div>
						<h3 className="sf-plan-card__title">
							{ __( 'You’re on SubtleForms Free', 'subtleforms' ) }
						</h3>
						<p className="sf-plan-card__text">
							{ __(
								'Unlimited forms and submissions, the full builder, conditional logic and email notifications. No limits, no expiry.',
								'subtleforms'
							) }
						</p>
					</div>
				</div>
				<div className="sf-plan-card__actions">
					<Button variant="primary" href={ PRO_URL } target="_blank" rel="noreferrer">
						{ __( 'Get SubtleForms Pro', 'subtleforms' ) }
						<Icon.ArrowUpRight size={ 16 } aria-hidden="true" />
					</Button>
					<Button variant="tertiary" href={ ACCOUNT_URL } target="_blank" rel="noreferrer">
						{ __( 'I already have a license', 'subtleforms' ) }
					</Button>
				</div>
			</section>

			<section className="sf-panel">
				<header className="sf-panel__header">
					<div>
						<h3 className="sf-panel__title">{ __( 'What Pro adds', 'subtleforms' ) }</h3>
						<p className="sf-panel__subtitle">
							{ __( 'Pro is an add-on plugin. Your forms stay exactly as they are; new fields and actions appear in the builder.', 'subtleforms' ) }
						</p>
					</div>
				</header>
				<div className="sf-panel__body">
					<div className="sf-pillars">
						{ PRO_PILLARS.map( ( { key, icon: PillarIcon, title, text } ) => (
							<div key={ key } className="sf-pillars__item">
								<span className="sf-pillars__icon" aria-hidden="true">
									<PillarIcon size={ 18 } />
								</span>
								<strong>{ title }</strong>
								<span>{ text }</span>
							</div>
						) ) }
					</div>
					<ProChecklist />
				</div>
			</section>

			<section className="sf-panel">
				<header className="sf-panel__header">
					<div>
						<h3 className="sf-panel__title">{ __( 'License key', 'subtleforms' ) }</h3>
						<p className="sf-panel__subtitle">
							{ __( 'Install and activate the SubtleForms Pro plugin, then enter your key here.', 'subtleforms' ) }
						</p>
					</div>
				</header>
				<div className="sf-panel__body">
					<fieldset className="sf-license-key" disabled>
						<label htmlFor="sf-license-key-preview" className="screen-reader-text">
							{ __( 'License key', 'subtleforms' ) }
						</label>
						<input
							id="sf-license-key-preview"
							type="text"
							className="sf-license-key__input"
							placeholder="XXXX-XXXX-XXXX-XXXX"
						/>
						<Button variant="secondary" disabled accessibleWhenDisabled>
							{ __( 'Activate', 'subtleforms' ) }
						</Button>
					</fieldset>
					{ version && (
						<p className="sf-license-key__meta">
							{ sprintf(
								/* translators: %s: plugin version */
								__( 'SubtleForms %s', 'subtleforms' ),
								version
							) }
						</p>
					) }
				</div>
			</section>
		</div>
	);
}
