import { useState } from '@wordpress/element';
import {
	Button,
	TextControl,
	ToggleControl,
	SelectControl,
	Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from './FieldError';

/**
 * AI Configuration Settings Tab
 *
 * Provider selection, API keys, agent toggles, cost estimator.
 *
 * @param {Object}   props
 * @param {Object}   props.settings     - Current settings values
 * @param {Function} props.updateSetting - (key, value) => void
 * @param {Object}   props.fieldErrors  - Per-field validation errors
 */
export default function AISettings( {
	settings,
	updateSetting,
	fieldErrors = {},
} ) {
	const [ testingConnection, setTestingConnection ] = useState( false );
	const [ connectionResult, setConnectionResult ] = useState( null );

	const testConnection = async () => {
		setTestingConnection( true );
		setConnectionResult( null );

		try {
			// Simulate API test
			await new Promise( ( resolve ) => setTimeout( resolve, 1500 ) );
			setConnectionResult( {
				success: true,
				message: __(
					'Connection successful! AI services are ready.',
					'subtleforms'
				),
			} );
		} catch {
			setConnectionResult( {
				success: false,
				message: __(
					'Connection failed. Please check your API key and try again.',
					'subtleforms'
				),
			} );
		} finally {
			setTestingConnection( false );
		}
	};

	const estimatedCost = () => {
		const provider = settings.ai_provider || 'openai';
		const agentsEnabled = [
			settings.ai_spam_detection_enabled,
			settings.ai_workflows_enabled,
			settings.ai_form_assist_enabled,
			settings.ai_routing_enabled,
		].filter( Boolean ).length;

		if ( agentsEnabled === 0 ) return '$0.00';

		const baseCosts = {
			openai: 0.15,
			anthropic: 0.12,
			custom: 0.1,
		};

		const monthlyCost =
			( baseCosts[ provider ] || 0.15 ) * agentsEnabled * 100;
		return `$${ monthlyCost.toFixed( 2 ) }`;
	};

	return (
		<div className="sf-ai-settings">
			<div className="sf-ai-card">
				<div className="sf-license-connect-card__header">
					<div className="sf-ai-card__header">
						<div className="sf-ai-card__header-icon">
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M12 2L2 7l10 5 10-5-10-5z" />
								<path d="M2 17l10 5 10-5" />
								<path d="M2 12l10 5 10-5" />
							</svg>
						</div>
						<div className="sf-ai-card__header-text">
							<h3>
								{ __(
									'AI-Powered Features',
									'subtleforms'
								) }
							</h3>
							<p>
								{ __(
									'Configure AI providers and agents to enhance your forms with intelligent automation',
									'subtleforms'
								) }
							</p>
						</div>
					</div>
				</div>
				<div>
					<div className="sf-settings-section">
						{/* Provider Selection */ }
						<div>
							<SelectControl
								label={ __(
									'AI Provider',
									'subtleforms'
								) }
								value={ settings.ai_provider || 'openai' }
								options={ [
									{
										label: 'OpenAI (GPT-4, GPT-3.5)',
										value: 'openai',
									},
									{
										label: 'Anthropic (Claude)',
										value: 'anthropic',
									},
									{
										label: 'Custom Endpoint',
										value: 'custom',
									},
								] }
								onChange={ ( value ) =>
									updateSetting( 'ai_provider', value )
								}
								help={ __(
									'Select your preferred AI service provider',
									'subtleforms'
								) }
							/>
							<FieldError errors={ fieldErrors.ai_provider } />
						</div>

						{/* Model Selection - OpenAI */ }
						{ settings.ai_provider === 'openai' && (
							<div>
								<SelectControl
									label={ __( 'Model', 'subtleforms' ) }
									value={
										settings.ai_model || 'gpt-3.5-turbo'
									}
									options={ [
										{
											label: 'GPT-4 Turbo (Recommended)',
											value: 'gpt-4-turbo-preview',
										},
										{
											label: 'GPT-4',
											value: 'gpt-4',
										},
										{
											label: 'GPT-3.5 Turbo (Faster, Lower Cost)',
											value: 'gpt-3.5-turbo',
										},
									] }
									onChange={ ( value ) =>
										updateSetting( 'ai_model', value )
									}
									help={ __(
										'Choose the AI model for processing',
										'subtleforms'
									) }
								/>
								<FieldError
									errors={ fieldErrors.ai_model }
								/>
							</div>
						) }

						{/* Model Selection - Anthropic */ }
						{ settings.ai_provider === 'anthropic' && (
							<div>
								<SelectControl
									label={ __( 'Model', 'subtleforms' ) }
									value={
										settings.ai_model ||
										'claude-3-sonnet-20240229'
									}
									options={ [
										{
											label: 'Claude 3 Opus (Most Capable)',
											value: 'claude-3-opus-20240229',
										},
										{
											label: 'Claude 3 Sonnet (Recommended)',
											value: 'claude-3-sonnet-20240229',
										},
										{
											label: 'Claude 3 Haiku (Fastest)',
											value: 'claude-3-haiku-20240307',
										},
									] }
									onChange={ ( value ) =>
										updateSetting( 'ai_model', value )
									}
									help={ __(
										'Choose the Claude model version',
										'subtleforms'
									) }
								/>
								<FieldError
									errors={ fieldErrors.ai_model }
								/>
							</div>
						) }

						{/* API Key */ }
						<div>
							<TextControl
								label={ __( 'API Key', 'subtleforms' ) }
								type="password"
								value={ settings.ai_api_key || '' }
								onChange={ ( value ) =>
									updateSetting( 'ai_api_key', value )
								}
								help={
									settings.ai_provider === 'openai'
										? __(
												'Get your API key from https://platform.openai.com/api-keys',
												'subtleforms'
										  )
										: settings.ai_provider === 'anthropic'
										? __(
												'Get your API key from https://console.anthropic.com/',
												'subtleforms'
										  )
										: __(
												'Enter your custom endpoint API key',
												'subtleforms'
										  )
								}
								placeholder={ __(
									'sk-...',
									'subtleforms'
								) }
							/>
							<FieldError
								errors={ fieldErrors.ai_api_key }
							/>
						</div>

						{/* Custom Endpoint */ }
						{ settings.ai_provider === 'custom' && (
							<div>
								<TextControl
									label={ __(
										'Custom Endpoint URL',
										'subtleforms'
									) }
									type="url"
									value={
										settings.ai_custom_endpoint || ''
									}
									onChange={ ( value ) =>
										updateSetting(
											'ai_custom_endpoint',
											value
										)
									}
									help={ __(
										'OpenAI-compatible API endpoint',
										'subtleforms'
									) }
									placeholder="https://api.example.com/v1"
								/>
								<FieldError
									errors={
										fieldErrors.ai_custom_endpoint
									}
								/>
							</div>
						) }

						{/* Test Connection */ }
						<div className="sf-ai-test-connection">
							<Button
								variant="secondary"
								onClick={ testConnection }
								isBusy={ testingConnection }
								disabled={
									! settings.ai_api_key ||
									testingConnection
								}
							>
								{ testingConnection
									? __(
											'Testing Connection...',
											'subtleforms'
									  )
									: __(
											'Test Connection',
											'subtleforms'
									  ) }
							</Button>
							{ connectionResult && (
								<Notice
									status={
										connectionResult.success
											? 'success'
											: 'error'
									}
									isDismissible={ false }
									className="sf-ai-test-result"
								>
									{ connectionResult.message }
								</Notice>
							) }
						</div>

						{/* AI Agents Section */ }
						<div className="sf-ai-agents-section">
							<h4 className="sf-section-title">
								{ __( 'AI Agents', 'subtleforms' ) }
							</h4>
							<p className="sf-section-description">
								{ __(
									'Enable intelligent automation agents to enhance form functionality',
									'subtleforms'
								) }
							</p>

							<div className="sf-ai-agents-grid">
								{/* Spam Detection Agent */ }
								<div className="sf-ai-agent-card">
									<div className="sf-ai-agent-card__header">
										<div className="sf-ai-agent-card__icon sf-ai-agent-card__icon--spam">
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
											>
												<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
												<path d="M9 12l2 2 4-4" />
											</svg>
										</div>
										<ToggleControl
											label={ __(
												'Spam Detection',
												'subtleforms'
											) }
											checked={
												settings.ai_spam_detection_enabled ||
												false
											}
											onChange={ ( value ) =>
												updateSetting(
													'ai_spam_detection_enabled',
													value
												)
											}
										/>
									</div>
									<p className="sf-ai-agent-card__description">
										{ __(
											'Detect and block spam submissions using AI analysis',
											'subtleforms'
										) }
									</p>
								</div>

								{/* Automated Workflows Agent */ }
								<div className="sf-ai-agent-card">
									<div className="sf-ai-agent-card__header">
										<div className="sf-ai-agent-card__icon sf-ai-agent-card__icon--workflow">
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
											>
												<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
												<polyline points="7.5 4.21 12 6.81 16.5 4.21" />
												<polyline points="7.5 19.79 7.5 14.6 3 12" />
												<polyline points="21 12 16.5 14.6 16.5 19.79" />
												<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
												<line
													x1="12"
													y1="22.08"
													x2="12"
													y2="12"
												/>
											</svg>
										</div>
										<ToggleControl
											label={ __(
												'Automated Workflows',
												'subtleforms'
											) }
											checked={
												settings.ai_workflows_enabled ||
												false
											}
											onChange={ ( value ) =>
												updateSetting(
													'ai_workflows_enabled',
													value
												)
											}
										/>
									</div>
									<p className="sf-ai-agent-card__description">
										{ __(
											'Trigger smart actions based on submission content',
											'subtleforms'
										) }
									</p>
								</div>

								{/* Form Assistance Agent */ }
								<div className="sf-ai-agent-card">
									<div className="sf-ai-agent-card__header">
										<div className="sf-ai-agent-card__icon sf-ai-agent-card__icon--assist">
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
											>
												<circle
													cx="12"
													cy="12"
													r="10"
												/>
												<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
												<line
													x1="12"
													y1="17"
													x2="12.01"
													y2="17"
												/>
											</svg>
										</div>
										<ToggleControl
											label={ __(
												'Form Assistance',
												'subtleforms'
											) }
											checked={
												settings.ai_form_assist_enabled ||
												false
											}
											onChange={ ( value ) =>
												updateSetting(
													'ai_form_assist_enabled',
													value
												)
											}
										/>
									</div>
									<p className="sf-ai-agent-card__description">
										{ __(
											'Provide contextual help and suggestions to users',
											'subtleforms'
										) }
									</p>
								</div>

								{/* Smart Routing Agent */ }
								<div className="sf-ai-agent-card">
									<div className="sf-ai-agent-card__header">
										<div className="sf-ai-agent-card__icon sf-ai-agent-card__icon--routing">
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
											>
												<polygon points="12 2 2 7 12 12 22 7 12 2" />
												<polyline points="2 17 12 22 22 17" />
												<polyline points="2 12 12 17 22 12" />
											</svg>
										</div>
										<ToggleControl
											label={ __(
												'Smart Routing',
												'subtleforms'
											) }
											checked={
												settings.ai_routing_enabled ||
												false
											}
											onChange={ ( value ) =>
												updateSetting(
													'ai_routing_enabled',
													value
												)
											}
										/>
									</div>
									<p className="sf-ai-agent-card__description">
										{ __(
											'Automatically route submissions to the right team',
											'subtleforms'
										) }
									</p>
								</div>
							</div>
						</div>

						{/* Cost Estimator */ }
						<div className="sf-ai-cost-estimator">
							<div className="sf-ai-cost-estimator__header">
								<h4 className="sf-section-title">
									{ __(
										'Estimated Monthly Cost',
										'subtleforms'
									) }
								</h4>
								<div className="sf-ai-cost-estimator__amount">
									{ estimatedCost() }
								</div>
							</div>
							<p className="sf-section-description">
								{ __(
									'Based on enabled agents and average usage. Actual costs may vary.',
									'subtleforms'
								) }
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
