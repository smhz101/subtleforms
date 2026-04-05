/**
 * License / Subscription Settings Component
 *
 * Three modes:
 *  1. Dev mode  — SUBTLEFORMS_DEV_LICENSE is true in wp-config.php.
 *  2. Connected — active subscription from subtleforms.com.
 *  3. Disconnected — connection form (email + license key).
 *
 * @package SubtleForms
 * @since   2.1.0
 */

import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';

const PLAN_LABELS = {
	free:    __( 'Free', 'subtleforms' ),
	starter: __( 'Starter', 'subtleforms' ),
	pro:     __( 'Pro', 'subtleforms' ),
	agency:  __( 'Agency', 'subtleforms' ),
};

const PLAN_FEATURES = {
	starter: [
		__( 'Webhooks extension', 'subtleforms' ),
		__( 'Email Marketing extension', 'subtleforms' ),
		__( 'Analytics extension', 'subtleforms' ),
		__( 'Pro templates', 'subtleforms' ),
		__( 'Advanced conditional logic', 'subtleforms' ),
	],
	pro: [
		__( 'All Starter features', 'subtleforms' ),
		__( 'CRM extension', 'subtleforms' ),
		__( 'E-commerce extension', 'subtleforms' ),
		__( 'PDF Generator extension', 'subtleforms' ),
		__( 'Multilanguage extension', 'subtleforms' ),
		__( 'Payments extension', 'subtleforms' ),
		__( 'Pipeline retry & delay', 'subtleforms' ),
		__( 'Priority support', 'subtleforms' ),
	],
	agency: [
		__( 'All Pro features', 'subtleforms' ),
		__( 'Custom extensions API', 'subtleforms' ),
		__( 'Unlimited sites', 'subtleforms' ),
	],
};

function StatusBadge( { status } ) {
	const map = {
		active:       { label: __( 'Active', 'subtleforms' ),       cls: 'sf-badge--active' },
		grace_period: { label: __( 'Grace Period', 'subtleforms' ),  cls: 'sf-badge--warning' },
		expired:      { label: __( 'Expired', 'subtleforms' ),       cls: 'sf-badge--danger' },
		invalid:      { label: __( 'Invalid', 'subtleforms' ),       cls: 'sf-badge--danger' },
		inactive:     { label: __( 'Inactive', 'subtleforms' ),      cls: 'sf-badge--neutral' },
	};
	const { label, cls } = map[ status ] || map.inactive;
	return <span className={ `sf-badge ${ cls }` }>{ label }</span>;
}

function PlanBadge( { plan } ) {
	return (
		<span className={ `sf-plan-badge sf-plan-badge--${ plan }` }>
			{ PLAN_LABELS[ plan ] || plan }
		</span>
	);
}

export default function LicenseSettings() {
	// If Pro is loaded, delegate to its component — highest authority.
	if ( window.SubtleFormsPro?.LicenseSettings ) {
		const ProLicenseSettings = window.SubtleFormsPro.LicenseSettings;
		return <ProLicenseSettings />;
	}

	const admin        = window.subtleformsAdmin || {};
	const subscription = admin.subscription || {};
	const [ subData ]  = useState( subscription );

	const isConnected = subData.connected || subData.status === 'active' || subData.status === 'grace_period';

	// ── Dev mode ─────────────────────────────────────────────────────────────
	if ( subData.isDev ) {
		return (
			<div className="sf-license-settings sf-license-settings--dev">
				<div className="sf-license-dev-banner">
					<Icon.Wrench size={20} className="sf-license-dev-banner__icon" />
					<div className="sf-license-dev-banner__body">
						<strong>{ __( 'Development Mode Active', 'subtleforms' ) }</strong>
						<p>
							{ __( 'SUBTLEFORMS_DEV_LICENSE is enabled in wp-config.php. All Pro features and extensions are unlocked locally. This setting must be removed in production.', 'subtleforms' ) }
						</p>
					</div>
				</div>

				<div className="sf-license-section">
					<h3>{ __( 'Pro Features Unlocked', 'subtleforms' ) }</h3>
					<ul className="sf-feature-list">
						{ PLAN_FEATURES.pro.map( ( f ) => (
							<li key={ f } className="sf-feature-list__item sf-feature-list__item--active">
							<Icon.CheckCircle size={16} />
							{ f }
						</li>
					) ) }
					{ PLAN_FEATURES.agency.filter( ( f ) => ! PLAN_FEATURES.pro.includes( f ) ).map( ( f ) => (
						<li key={ f } className="sf-feature-list__item sf-feature-list__item--active">
							<Icon.CheckCircle size={16} />
								{ f }
							</li>
						) ) }
					</ul>
				</div>
			</div>
		);
	}

	// ── Connected ─────────────────────────────────────────────────────────────
	if ( isConnected ) {
		const features = PLAN_FEATURES[ subData.plan ] || PLAN_FEATURES.pro;

		return (
			<div className="sf-license-settings sf-license-settings--connected">
				<div className="sf-license-account-card">
					<div className="sf-license-account-card__header">
					<Icon.Users size={20} className="sf-license-account-card__icon" />
						<div>
							<p className="sf-license-account-card__email">{ subData.email }</p>
							<div className="sf-license-account-card__badges">
								<StatusBadge status={ subData.status } />
								<PlanBadge plan={ subData.plan } />
							</div>
						</div>
					</div>

					{ subData.expiresAt && (
						<p className="sf-license-account-card__expiry">
							{ __( 'Renews / expires:', 'subtleforms' ) }{ ' ' }
							<strong>{ new Date( subData.expiresAt ).toLocaleDateString() }</strong>
						</p>
					) }

					<div className="sf-license-account-card__actions">
						<a
							href="https://subtleforms.com/account"
							target="_blank"
							rel="noopener noreferrer"
							className="button"
						>
							{ __( 'Manage Account', 'subtleforms' ) }
						</a>
					</div>
				</div>

				<div className="sf-license-section">
					<h3>{ __( 'Included in your plan', 'subtleforms' ) }</h3>
					<ul className="sf-feature-list">
						{ features.map( ( f ) => (
							<li key={ f } className="sf-feature-list__item sf-feature-list__item--active">
							<Icon.CheckCircle size={16} />
								{ f }
							</li>
						) ) }
					</ul>
				</div>
			</div>
		);
	}

// ── Pro not installed — locked preview ────────────────────────────────────
        return (
                <div className="sf-license-settings sf-license-settings--disconnected">

                        <div className="sf-license-connect-card">
                                <div className="sf-license-connect-card__header">
                                        <div className="sf-license-connect-card__icon-wrapper">
                                                <Icon.Lock size={20} className="sf-license-connect-card__icon" />
                                        </div>
                                        <div>
                                                <h3>{ __( 'SubtleForms Pro', 'subtleforms' ) }</h3>
                                                <p>{ __( 'Install and activate the SubtleForms Pro plugin to enter your license key and unlock all Pro features.', 'subtleforms' ) }</p>
                                        </div>
                                </div>

                                { /* Disabled preview of the activation form */ }
                                <fieldset className="sf-license-form sf-license-form--locked" disabled>
                                        <div className="sf-license-form__field">
                                                <label>{ __( 'License Key', 'subtleforms' ) }</label>
                                                <div className="sf-license-form__key-row">
                                                        <input
                                                                type="text"
                                                                className="regular-text sf-license-form__key-input"
                                                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                                                disabled
                                                        />
                                                        <button type="button" className="button button-primary" disabled>
                                                                { __( 'Activate', 'subtleforms' ) }
                                                        </button>
                                                </div>
                                                <p className="description">
                                                        { __( 'SubtleForms Pro must be installed and active to use this feature.', 'subtleforms' ) }
                                                </p>
                                        </div>
                                </fieldset>

                                <div className="sf-license-connect-card__actions">
                                        <a
                                                href="https://subtleforms.com/pro"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="button button-primary"
                                        >
                                                { __( 'Get SubtleForms Pro →', 'subtleforms' ) }
                                        </a>
                                        <a
                                                href="https://subtleforms.com/account"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="button"
                                        >
                                                { __( 'My Account', 'subtleforms' ) }
                                        </a>
                                </div>
                        </div>

                        <div className="sf-license-upgrade-card">
                                <h3>{ __( 'What you unlock with Pro', 'subtleforms' ) }</h3>
                                <ul className="sf-feature-list">
                                        { [ ...PLAN_FEATURES.starter, ...PLAN_FEATURES.pro.filter( ( f ) => ! PLAN_FEATURES.starter.includes( f ) ) ].map( ( f ) => (
                                                <li key={ f } className="sf-feature-list__item sf-feature-list__item--locked">
                                                        <Icon.Lock size={14} />
                                                        { f }
                                                </li>
                                        ) ) }
                                </ul>
                        </div>

		</div>
	);
}

