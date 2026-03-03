/**
 * EmptyFormWelcome - Onboarding for new empty forms
 * 
 * Shows a beautiful welcome screen instead of generic "No fields found" message
 */

import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import './EmptyFormWelcome.scss';

export default function EmptyFormWelcome() {
	return (
		<div className="sf-empty-form-welcome">
			<div className="sf-empty-form-welcome__container">
				<div className="sf-empty-form-welcome__icon">
					<Icon.Sparkles />
				</div>
				
				<h2 className="sf-empty-form-welcome__title">
					{__('Your Canvas Awaits', 'subtleforms')}
				</h2>
				
				<p className="sf-empty-form-welcome__description">
					{__('Start building your form by dragging fields from the sidebar, or choose from our templates to get going faster.', 'subtleforms')}
				</p>

				<div className="sf-empty-form-welcome__suggestions">
					<div className="sf-empty-form-suggestion">
						<div className="sf-empty-form-suggestion__number">1</div>
						<div className="sf-empty-form-suggestion__content">
							<strong>{__('Add Fields', 'subtleforms')}</strong>
							<span>{__('Drag fields from the right sidebar', 'subtleforms')}</span>
						</div>
					</div>
					
					<div className="sf-empty-form-suggestion">
						<div className="sf-empty-form-suggestion__number">2</div>
						<div className="sf-empty-form-suggestion__content">
							<strong>{__('Customize', 'subtleforms')}</strong>
							<span>{__('Click any field to configure it', 'subtleforms')}</span>
						</div>
					</div>
					
					<div className="sf-empty-form-suggestion">
						<div className="sf-empty-form-suggestion__number">3</div>
						<div className="sf-empty-form-suggestion__content">
							<strong>{__('Publish', 'subtleforms')}</strong>
							<span>{__('Save and embed with shortcode', 'subtleforms')}</span>
						</div>
					</div>
				</div>

				<div className="sf-empty-form-welcome__hint">
					<Icon.Lightbulb />
					<span>
						{__('Tip: Use Ctrl/Cmd+Z to undo, Ctrl/Cmd+S to save', 'subtleforms')}
					</span>
				</div>
			</div>
		</div>
	);
}
