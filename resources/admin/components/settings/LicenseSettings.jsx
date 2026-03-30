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
import apiFetch from '@wordpress/api-fetch';
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
	const restUrl      = admin.restUrl || '/wp-json/subtleforms/v1';
	const restNonce    = admin.restNonce || '';

	const [ subData, setSubData ]   = useState( subscription );
	const [ email, setEmail ]       = useState( '' );
	const [ licenseKey, setKey ]    = useState( '' );
	const [ loading, setLoading ]   = useState( false );
	const [ error, setError ]       = useState( '' );
	const [ notice, setNotice ]     = useState( '' );

	const isConnected = subData.connected || subData.status === 'active' || subData.status === 'grace_period';

	async function handleConnect( e ) {
		e.preventDefault();
		setError( '' );
		setNotice( '' );
		setLoading( true );

		try {
			const result = await apiFetch( {
				url:    `${ restUrl }/license/connect`,
				method: 'POST',
				data:   { email, license_key: licenseKey },
				headers: { 'X-WP-Nonce': restNonce },
			} );
			setSubData( result );
			setNotice( __( 'License activated successfully!', 'subtleforms' ) );
			setEmail( '' );
			setKey( '' );
		} catch ( err ) {
			setError( err?.message || __( 'Activation failed. Please check your license key and try again.', 'subtleforms' ) );
		} finally {
			setLoading( false );
		}
	}

	async function handleDisconnect() {
		if ( ! window.confirm( __( 'Disconnect your SubtleForms license?', 'subtleforms' ) ) ) {
			return;
		}
		setLoading( true );
		setError( '' );
		setNotice( '' );
		try {
			await apiFetch( {
				url:    `${ restUrl }/license/disconnect`,
				method: 'POST',
				headers: { 'X-WP-Nonce': restNonce },
			} );
			setSubData( { status: 'inactive', plan: 'free', email: '', connected: false, isDev: false } );
			setNotice( __( 'License disconnected.', 'subtleforms' ) );
		} catch ( err ) {
			setError( err?.message || __( 'Disconnect failed.', 'subtleforms' ) );
		} finally {
			setLoading( false );
		}
	}

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
				{ notice && <div className="sf-license-notice sf-license-notice--success">{ notice }</div> }
				{ error  && <div className="sf-license-notice sf-license-notice--error">{ error }</div> }

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
						<button
							className="button sf-license-disconnect-btn"
							onClick={ handleDisconnect }
							disabled={ loading }
						>
							{ loading ? __( 'Disconnecting…', 'subtleforms' ) : __( 'Disconnect', 'subtleforms' ) }
						</button>
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

	// ── Disconnected / connection form ─────────────────────────────────────────
	return (
		<div className="sf-license-settings sf-license-settings--disconnected">
			{ notice && <div className="sf-license-notice sf-license-notice--success">{ notice }</div> }
			{ error  && <div className="sf-license-notice sf-license-notice--error">{ error }</div> }

			<div className="sf-license-connect-card">
				<div className="sf-license-connect-card__header">
					<div className="sf-license-connect-card__icon-wrapper">
						<Icon.Lock size={20} className="sf-license-connect-card__icon" />
					</div>
					<div>
						<h3>{ __( 'Activate SubtleForms Pro', 'subtleforms' ) }</h3>
						<p>{ __( 'Enter your license key to unlock Pro features and extensions.', 'subtleforms' ) }</p>
					</div>
				</div>

				<form className="sf-license-form" onSubmit={ handleConnect }>
					<div className="sf-license-form__field">
						<label htmlFor="sf-license-email">{ __( 'Account Email', 'subtleforms' ) }</label>
						<input
							id="sf-license-email"
							type="email"
							className="regular-text"
							value={ email }
							onChange={ ( e ) => setEmail( e.target.value ) }
							placeholder="you@example.com"
							required
							disabled={ loading }
						/>
					</div>

					<div className="sf-license-form__field">
						<label htmlFor="sf-license-key">{ __( 'License Key', 'subtleforms' ) }</label>
						<input
							id="sf-license-key"
							type="text"
							className="regular-text sf-license-form__key-input"
							value={ licenseKey }
							onChange={ ( e ) => setKey( e.target.value ) }
							placeholder="XXXX-XXXX-XXXX-XXXX"
							required
							disabled={ loading }
						/>
						<p className="description">
							{ __( 'Find your license key in your ', 'subtleforms' ) }
							<a href="https://subtleforms.com/account" target="_blank" rel="noopener noreferrer">
								{ __( 'SubtleForms account', 'subtleforms' ) }
							</a>.
						</p>
					</div>

					<button
						type="submit"
						className="button button-primary"
						disabled={ loading || ! email || ! licenseKey }
					>
						{ loading ? __( 'Activating…', 'subtleforms' ) : __( 'Activate License', 'subtleforms' ) }
					</button>
				</form>
			</div>

			<div className="sf-license-upgrade-card">
				<h3>{ __( 'Unlock Pro Features', 'subtleforms' ) }</h3>
				<ul className="sf-feature-list">
					{ PLAN_FEATURES.starter.map( ( f ) => (
						<li key={ f } className="sf-feature-list__item">
							<Icon.Check size={16} />
							{ f }
						</li>
					) ) }
					{ PLAN_FEATURES.pro
						.filter( ( f ) => ! PLAN_FEATURES.starter.includes( f ) )
						.map( ( f ) => (
							<li key={ f } className="sf-feature-list__item">
								<Icon.Check size={16} />
								{ f }
							</li>
						) ) }
				</ul>

				<a
					href="https://subtleforms.com/pricing"
					target="_blank"
					rel="noopener noreferrer"
					className="button button-primary button-hero"
				>
					{ __( 'Get SubtleForms Pro', 'subtleforms' ) }
				</a>
			</div>
		</div>
	);
}

