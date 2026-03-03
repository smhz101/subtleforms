/**
 * License Settings Component
 *
 * Displays license activation form, status, and Pro features list.
 *
 * @package SubtleForms
 * @since 2.0.0
 */

import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Button,
	TextControl,
	Card,
	CardHeader,
	CardBody,
	Spinner,
	Notice,
} from '@wordpress/components';
import {
	activateLicense,
	deactivateLicense,
	validateLicense,
	getLicenseStatus,
} from '../../utils/licensing';

/**
 * License status badges
 */
const StatusBadge = ({ status }) => {
	const badges = {
		valid: { label: __('Active', 'subtleforms'), class: 'sf-badge--success' },
		grace_period: {
			label: __('Grace Period', 'subtleforms'),
			class: 'sf-badge--warning',
		},
		expired: { label: __('Expired', 'subtleforms'), class: 'sf-badge--error' },
		invalid: { label: __('Invalid', 'subtleforms'), class: 'sf-badge--error' },
		inactive: {
			label: __('Inactive', 'subtleforms'),
			class: 'sf-badge--neutral',
		},
	};

	const badge = badges[status] || badges.inactive;

	return <span className={`sf-badge ${badge.class}`}>{badge.label}</span>;
};

/**
 * License Settings Component
 */
export default function LicenseSettings() {
	const [licenseKey, setLicenseKey] = useState('');
	const [licenseData, setLicenseData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [processing, setProcessing] = useState(false);
	const [notice, setNotice] = useState(null);

	/**
	 * Load license status on mount
	 */
	useEffect(() => {
		loadLicenseStatus();
	}, []);

	/**
	 * Load license status from API
	 */
	const loadLicenseStatus = async () => {
		try {
			setLoading(true);
			const status = await getLicenseStatus(true);
			setLicenseData(status);
			setLicenseKey(status.key || '');
		} catch (error) {
			console.error('Failed to load license status:', error);
		} finally {
			setLoading(false);
		}
	};

	/**
	 * Handle license activation
	 */
	const handleActivate = async () => {
		if (!licenseKey || licenseKey.trim().length === 0) {
			setNotice({
				type: 'error',
				message: __('Please enter a license key.', 'subtleforms'),
			});
			return;
		}

		try {
			setProcessing(true);
			setNotice(null);

			const result = await activateLicense(licenseKey.trim());

			if (result.success) {
				setNotice({
					type: 'success',
					message: result.message || __('License activated successfully!', 'subtleforms'),
				});
				await loadLicenseStatus();
			} else {
				setNotice({
					type: 'error',
					message: result.message || __('License activation failed.', 'subtleforms'),
				});
			}
		} catch (error) {
			console.error('Activation error:', error);
			setNotice({
				type: 'error',
				message: error.message || __('An error occurred during activation.', 'subtleforms'),
			});
		} finally {
			setProcessing(false);
		}
	};

	/**
	 * Handle license deactivation
	 */
	const handleDeactivate = async () => {
		if (!window.confirm(__('Are you sure you want to deactivate this license?', 'subtleforms'))) {
			return;
		}

		try {
			setProcessing(true);
			setNotice(null);

			const result = await deactivateLicense();

			if (result.success) {
				setNotice({
					type: 'success',
					message: result.message || __('License deactivated successfully.', 'subtleforms'),
				});
				setLicenseKey('');
				await loadLicenseStatus();
			} else {
				setNotice({
					type: 'error',
					message: result.message || __('License deactivation failed.', 'subtleforms'),
				});
			}
		} catch (error) {
			console.error('Deactivation error:', error);
			setNotice({
				type: 'error',
				message: error.message || __('An error occurred during deactivation.', 'subtleforms'),
			});
		} finally {
			setProcessing(false);
		}
	};

	/**
	 * Handle license validation (refresh)
	 */
	const handleValidate = async () => {
		try {
			setProcessing(true);
			setNotice(null);

			const result = await validateLicense();

			if (result.success) {
				setNotice({
					type: 'success',
					message: result.message || __('License validated successfully.', 'subtleforms'),
				});
				await loadLicenseStatus();
			} else {
				setNotice({
					type: 'error',
					message: result.message || __('License validation failed.', 'subtleforms'),
				});
			}
		} catch (error) {
			console.error('Validation error:', error);
			setNotice({
				type: 'error',
				message: error.message || __('An error occurred during validation.', 'subtleforms'),
			});
		} finally {
			setProcessing(false);
		}
	};

	/**
	 * Format expiration date
	 */
	const formatExpiresAt = (timestamp) => {
		if (!timestamp) return __('Never', 'subtleforms');

		const date = new Date(timestamp * 1000);
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	if (loading) {
		return (
			<div className="sf-license-loading">
				<Spinner />
				<p>{__('Loading license information...', 'subtleforms')}</p>
			</div>
		);
	}

	const isActive = licenseData?.is_valid === true;
	const plan = licenseData?.plan || 'free';

	return (
		<div className="sf-license-settings">
			{/* Notice */}
			{notice && (
				<Notice status={notice.type} isDismissible onRemove={() => setNotice(null)}>
					{notice.message}
				</Notice>
			)}

			{/* License Activation Card */}
			<Card className="sf-license-card">
				<CardHeader>
					<h2>{__('License Activation', 'subtleforms')}</h2>
				</CardHeader>
				<CardBody>
					{/* Current Status */}
					{licenseData && (
						<div className="sf-license-status">
							<div className="sf-license-status__row">
								<span className="sf-license-status__label">
									{__('Status:', 'subtleforms')}
								</span>
								<StatusBadge status={licenseData.status} />
							</div>

							<div className="sf-license-status__row">
								<span className="sf-license-status__label">
									{__('Plan:', 'subtleforms')}
								</span>
								<span className="sf-license-status__value">
									{plan === 'free' ? __('Free', 'subtleforms') : plan.toUpperCase()}
								</span>
							</div>

							{licenseData.expires_at && (
								<div className="sf-license-status__row">
									<span className="sf-license-status__label">
										{__('Expires:', 'subtleforms')}
									</span>
									<span className="sf-license-status__value">
										{formatExpiresAt(licenseData.expires_at)}
										{licenseData.days_until_expiration !== null && (
											<span className="sf-license-status__days">
												{' '}
												({licenseData.days_until_expiration}{' '}
												{__('days remaining', 'subtleforms')})
											</span>
										)}
									</span>
								</div>
							)}

							{licenseData.warnings && licenseData.warnings.length > 0 && (
								<div className="sf-license-warnings">
									{licenseData.warnings.map((warning, index) => (
										<Notice key={index} status="warning" isDismissible={false}>
											{warning}
										</Notice>
									))}
								</div>
							)}
						</div>
					)}

					{/* License Key Input */}
					<div className="sf-license-input">
						<TextControl
							label={__('License Key', 'subtleforms')}
							value={licenseKey}
							onChange={setLicenseKey}
							placeholder="XXXX-XXXX-XXXX-XXXX"
							disabled={processing || isActive}
							help={
								!isActive &&
								__(
									'Enter your license key to unlock Pro features.',
									'subtleforms'
								)
							}
						/>
					</div>

					{/* Action Buttons */}
					<div className="sf-license-actions">
						{!isActive ? (
							<Button
								variant="primary"
								onClick={handleActivate}
								isBusy={processing}
								disabled={processing || !licenseKey}
							>
								{__('Activate License', 'subtleforms')}
							</Button>
						) : (
							<>
								<Button
									variant="secondary"
									onClick={handleValidate}
									isBusy={processing}
									disabled={processing}
								>
									{__('Refresh Status', 'subtleforms')}
								</Button>
								<Button
									variant="secondary"
									isDestructive
									onClick={handleDeactivate}
									isBusy={processing}
									disabled={processing}
								>
									{__('Deactivate', 'subtleforms')}
								</Button>
							</>
						)}
					</div>

					{/* Get License Link */}
					{!isActive && (
						<p className="sf-license-get">
							{__("Don't have a license?", 'subtleforms')}{' '}
							<a
								href="https://subtleforms.com/pricing/"
								target="_blank"
								rel="noopener noreferrer"
							>
								{__('Get SubtleForms Pro', 'subtleforms')}
							</a>
						</p>
					)}
				</CardBody>
			</Card>

			{/* Pro Features Card */}
			<Card className="sf-license-features">
				<CardHeader>
					<h2>
						{isActive
							? __('Available Pro Features', 'subtleforms')
							: __('Pro Features', 'subtleforms')}
					</h2>
				</CardHeader>
				<CardBody>
					<div className="sf-features-grid">
						<FeatureItem
							icon="🎨"
							title={__('Advanced Fields', 'subtleforms')}
							description={__(
								'Signature, date picker, file upload, and more',
								'subtleforms'
							)}
							available={isActive}
						/>
						<FeatureItem
							icon="🔀"
							title={__('Conditional Logic', 'subtleforms')}
							description={__(
								'Show/hide fields based on user input',
								'subtleforms'
							)}
							available={isActive}
						/>
						<FeatureItem
							icon="📁"
							title={__('File Uploads', 'subtleforms')}
							description={__('Allow users to upload files', 'subtleforms')}
							available={isActive}
						/>
						<FeatureItem
							icon="💳"
							title={__('Payment Forms', 'subtleforms')}
							description={__('Stripe and PayPal integrations', 'subtleforms')}
							available={isActive}
						/>
						<FeatureItem
							icon="🔗"
							title={__('Webhooks', 'subtleforms')}
							description={__(
								'Send form data to third-party services',
								'subtleforms'
							)}
							available={isActive}
						/>
						<FeatureItem
							icon="🤖"
							title={__('AI Spam Detection', 'subtleforms')}
							description={__(
								'Intelligent spam filtering with AI',
								'subtleforms'
							)}
							available={isActive}
						/>
						<FeatureItem
							icon="⚡"
							title={__('AI Workflows', 'subtleforms')}
							description={__(
								'Automated actions based on AI analysis',
								'subtleforms'
							)}
							available={isActive}
						/>
						<FeatureItem
							icon="💬"
							title={__('AI Form Assistant', 'subtleforms')}
							description={__(
								'Help users fill forms with AI suggestions',
								'subtleforms'
							)}
							available={isActive}
						/>
						<FeatureItem
							icon="🎯"
							title={__('Smart Routing', 'subtleforms')}
							description={__(
								'AI-powered form submission routing',
								'subtleforms'
							)}
							available={isActive}
						/>
						<FeatureItem
							icon="📋"
							title={__('Pro Templates', 'subtleforms')}
							description={__('Access to premium form templates', 'subtleforms')}
							available={isActive}
						/>
					</div>

					{!isActive && (
						<div className="sf-features-cta">
							<p>
								{__(
									'Unlock all these features and more with SubtleForms Pro!',
									'subtleforms'
								)}
							</p>
							<Button
								variant="primary"
								href="https://subtleforms.com/pricing/"
								target="_blank"
							>
								{__('Upgrade to Pro', 'subtleforms')}
							</Button>
						</div>
					)}
				</CardBody>
			</Card>
		</div>
	);
}

/**
 * Feature Item Component
 */
function FeatureItem({ icon, title, description, available }) {
	return (
		<div className={`sf-feature-item ${available ? 'sf-feature-item--available' : ''}`}>
			<div className="sf-feature-item__icon">{icon}</div>
			<h3 className="sf-feature-item__title">
				{title}
				{available && <span className="sf-feature-item__check">✓</span>}
				{!available && <span className="sf-feature-item__lock">🔒</span>}
			</h3>
			<p className="sf-feature-item__description">{description}</p>
		</div>
	);
}
