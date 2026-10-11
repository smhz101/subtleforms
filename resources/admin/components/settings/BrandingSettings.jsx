/**
 * Branding (white label) settings.
 *
 * SubtleForms Pro supplies the working screen (window.SubtleFormsPro.BrandingSettings)
 * on the Agency plan. Everyone else sees a read-only preview of the same
 * controls with a way to unlock it.
 *
 * @package SubtleForms
 */
import { Button, TextControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { isProFeature, openUpgradeModal } from '../../utils/featureGate';
import './BrandingSettings.scss';

export default function BrandingSettings() {
	const ProBranding = window.SubtleFormsPro?.BrandingSettings;
	if ( ProBranding && isProFeature( 'branding.white_label' ) ) {
		return <ProBranding />;
	}

	return (
		<div className="sf-ext-settings__panel-wrap sf-branding-locked">
			<div className="sf-ext-pro-overlay">
				<span className="sf-ext-pro-overlay__icon" aria-hidden="true">
					<Icon.Lock size={ 16 } />
				</span>
				<div className="sf-ext-pro-overlay__inner">
					<p className="sf-ext-pro-overlay__title">
						{ __( 'Included with the Agency plan', 'subtleforms' ) }
					</p>
					<p className="sf-ext-pro-overlay__desc">
						{ __( 'Put your own name and logo on the forms admin for your clients.', 'subtleforms' ) }
					</p>
				</div>
				<Button
					variant="primary"
					size="compact"
					className="sf-ext-pro-overlay__cta"
					onClick={ () => openUpgradeModal( 'branding.white_label' ) }>
					{ __( 'Unlock', 'subtleforms' ) }
				</Button>
			</div>
			<fieldset className="sf-settings-section sf-branding-locked__fields" disabled>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Plugin name', 'subtleforms' ) }
					value=""
					placeholder={ __( 'Client Forms', 'subtleforms' ) }
					help={ __( 'Shown in the admin menu and the app header.', 'subtleforms' ) }
					onChange={ () => {} }
				/>
				<div className="sf-settings-field">
					<p className="components-base-control__label">{ __( 'Logo', 'subtleforms' ) }</p>
					<Button variant="secondary" disabled>
						{ __( 'Choose from Media Library', 'subtleforms' ) }
					</Button>
				</div>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Hide SubtleForms credits, help links and upgrade prompts', 'subtleforms' ) }
					checked={ false }
					onChange={ () => {} }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Only I can see the License and Branding screens', 'subtleforms' ) }
					checked={ false }
					onChange={ () => {} }
				/>
			</fieldset>
		</div>
	);
}
