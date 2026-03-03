/**
 * PageErrorBoundary - Per-Page Error Isolation
 *
 * Catches errors within a single page without crashing the entire admin.
 * Provides recovery options and error details for debugging.
 */

import { Component } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import './PageErrorBoundary.scss';

export class PageErrorBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error) {
		return { hasError: true };
	}

	componentDidCatch(error, errorInfo) {
		this.setState({
			error,
			errorInfo,
		});

		// Log to console for debugging
		console.error('Page error caught by boundary:', error, errorInfo);

		// Optional: Send to error tracking service
		if (window.subtleformsAdmin?.errorTracking) {
			window.subtleformsAdmin.errorTracking.logError({
				error: error.toString(),
				componentStack: errorInfo.componentStack,
				page: this.props.pageName,
			});
		}
	}

	handleReset = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});

		// Call optional onReset callback
		if (this.props.onReset) {
			this.props.onReset();
		}
	};

	handleReload = () => {
		window.location.reload();
	};

	render() {
		if (this.state.hasError) {
			const { pageName = 'Page' } = this.props;
			const isDev = window.subtleformsAdmin?.isDev || false;

			return (
				<div className="sf-page-error-boundary">
					<div className="sf-page-error-boundary__container">
						{/* Error Icon */}
						<div className="sf-page-error-boundary__icon">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<circle cx="12" cy="12" r="10" strokeWidth="2" />
								<line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
								<circle cx="12" cy="16" r="1" fill="currentColor" />
							</svg>
						</div>

						{/* Error Message */}
						<h2 className="sf-page-error-boundary__title">
							{__('Something went wrong', 'subtleforms')}
						</h2>

						<p className="sf-page-error-boundary__message">
							{__(`An error occurred while loading ${pageName}. This page may not work correctly.`, 'subtleforms')}
						</p>

						{/* Error Details (dev mode only) */}
						{isDev && this.state.error && (
							<details className="sf-page-error-boundary__details">
								<summary>{__('Error Details', 'subtleforms')}</summary>
								<pre className="sf-page-error-boundary__stack">
									<code>{this.state.error.toString()}</code>
									{this.state.errorInfo?.componentStack && (
										<code>{this.state.errorInfo.componentStack}</code>
									)}
								</pre>
							</details>
						)}

						{/* Recovery Actions */}
						<div className="sf-page-error-boundary__actions">
							<Button
								variant="primary"
								onClick={this.handleReset}
								className="sf-btn sf-btn--primary">
								{__('Try Again', 'subtleforms')}
							</Button>
							<Button
								variant="secondary"
								onClick={this.handleReload}
								className="sf-btn sf-btn--secondary">
								{__('Reload Page', 'subtleforms')}
							</Button>
						</div>

						{/* Support Link */}
						<p className="sf-page-error-boundary__support">
							{__('If this problem persists, ', 'subtleforms')}
							<a
								href="https://subtleforms.com/support"
								target="_blank"
								rel="noopener noreferrer">
								{__('contact support', 'subtleforms')}
							</a>
						</p>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default PageErrorBoundary;
