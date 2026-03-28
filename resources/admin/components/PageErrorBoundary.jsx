/**
 * PageErrorBoundary - Per-Page Error Isolation
 *
 * Catches errors within a single page without crashing the entire admin.
 * Provides:
 *  - Recovery options and error details for debugging
 *  - Automatic retry with exponential backoff for chunk-load failures
 *  - aria-live announcement so screen readers are informed of errors
 */

import { Component } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Spinner } from '@wordpress/components';
import './PageErrorBoundary.scss';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_CHUNK_RETRIES = 3;

/**
 * Detect chunk / dynamic-import failures across browsers.
 * Webpack sets error.name = 'ChunkLoadError'; Vite uses a different message.
 */
function isChunkLoadError( error ) {
	if ( ! error ) return false;
	return (
		error.name === 'ChunkLoadError' ||
		/loading chunk/i.test( error.message || '' ) ||
		/failed to fetch dynamically imported module/i.test(
			error.message || ''
		)
	);
}

// ─── Component ────────────────────────────────────────────────────────────────

export class PageErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			chunkRetryCount: 0,
			isRetrying: false,
		};
		this._retryTimer = null;
	}

	static getDerivedStateFromError( error ) {
		return { hasError: true, error };
	}

	componentDidCatch( error, errorInfo ) {
		this.setState( { errorInfo } );

		// Log to console for debugging
		console.error(
			`[PageErrorBoundary: ${ this.props.pageName || 'unknown' }]`,
			error,
			errorInfo
		);

		// Optional: Send to error tracking service
		if ( window.subtleformsAdmin?.errorTracking ) {
			window.subtleformsAdmin.errorTracking.logError( {
				error: error.toString(),
				componentStack: errorInfo.componentStack,
				page: this.props.pageName,
			} );
		}

		// Auto-retry chunk load failures with exponential backoff
		if (
			isChunkLoadError( error ) &&
			this.state.chunkRetryCount < MAX_CHUNK_RETRIES
		) {
			this.scheduleChunkRetry();
		}
	}

	componentWillUnmount() {
		if ( this._retryTimer ) {
			clearTimeout( this._retryTimer );
		}
	}

	// ── Chunk retry ──────────────────────────────────────────────────────

	scheduleChunkRetry() {
		const delay =
			Math.pow( 2, this.state.chunkRetryCount ) * 1000; // 1 s → 2 s → 4 s

		this.setState( { isRetrying: true } );

		this._retryTimer = setTimeout( () => {
			this.setState( ( prev ) => ( {
				hasError: false,
				error: null,
				errorInfo: null,
				isRetrying: false,
				chunkRetryCount: prev.chunkRetryCount + 1,
			} ) );
		}, delay );
	}

	// ── Manual reset ─────────────────────────────────────────────────────

	handleReset = () => {
		this.setState( {
			hasError: false,
			error: null,
			errorInfo: null,
			chunkRetryCount: 0,
			isRetrying: false,
		} );

		if ( this.props.onReset ) {
			this.props.onReset();
		}
	};

	handleReload = () => {
		window.location.reload();
	};

	// ── Render ───────────────────────────────────────────────────────────

	render() {
		// Retrying a chunk load — show a spinner
		if ( this.state.isRetrying ) {
			return (
				<div className="sf-page-error-boundary sf-page-error-boundary--retrying">
					<div className="sf-page-error-boundary__container" role="status">
						<Spinner />
						<p className="sf-page-error-boundary__message">
							{ sprintf(
								/* translators: %d: retry attempt number */
								__( 'Retrying… (attempt %d of %d)', 'subtleforms' ),
								this.state.chunkRetryCount + 1,
								MAX_CHUNK_RETRIES
							) }
						</p>
						{/* Live announcement for screen readers */}
						<div
							className="sf-sr-only"
							aria-live="polite"
							aria-atomic="true"
						>
							{ sprintf(
								__( 'Retrying to load page, attempt %d', 'subtleforms' ),
								this.state.chunkRetryCount + 1
							) }
						</div>
					</div>
				</div>
			);
		}

		if ( this.state.hasError ) {
			const { pageName = 'Page' } = this.props;
			const isDev = window.subtleformsAdmin?.isDev || false;
			const isChunk = isChunkLoadError( this.state.error );
			const retriesExhausted =
				isChunk &&
				this.state.chunkRetryCount >= MAX_CHUNK_RETRIES;

			return (
				<div className="sf-page-error-boundary" role="alert">
					<div className="sf-page-error-boundary__container">
						{/* Live announcement for screen readers */}
						<div
							className="sf-sr-only"
							aria-live="assertive"
							aria-atomic="true"
						>
							{ sprintf(
								/* translators: %s: page name */
								__( 'An error occurred on the %s page.', 'subtleforms' ),
								pageName
							) }
						</div>

						{/* Error Icon */}
						<div className="sf-page-error-boundary__icon" aria-hidden="true">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<circle cx="12" cy="12" r="10" strokeWidth="2" />
								<line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
								<circle cx="12" cy="16" r="1" fill="currentColor" />
							</svg>
						</div>

						{/* Error Message */}
						<h2 className="sf-page-error-boundary__title">
							{ retriesExhausted
                                ? __( 'Unable to load page', 'subtleforms' )
                                : __( 'Oops! Something interrupted this page.', 'subtleforms' ) }
                        </h2>

                        <p className="sf-page-error-boundary__message">
                            { retriesExhausted
                                ? __( 'This page couldn\'t load after several attempts. Please refresh the browser and try again.', 'subtleforms' )
                                : sprintf(
                                        /* translators: %s: page name */
                                        __( 'We hit an issue loading %s. You can retry or continue working with existing content.', 'subtleforms' ),
                                        pageName
                                  ) }
                        </p>

                        { isDev && this.state.error && (
                            <details className="sf-page-error-boundary__details">
                                <summary>{ __( 'Error Details', 'subtleforms' ) }</summary>
                                <pre className="sf-page-error-boundary__stack">
                                    <code>{ this.state.error.toString() }</code>
                                    { this.state.errorInfo?.componentStack && (
                                        <code>{ this.state.errorInfo.componentStack }</code>
                                    ) }
                                </pre>
                            </details>
                        ) }
						{/* Recovery Actions */}
						<div className="sf-page-error-boundary__actions">
							{ retriesExhausted ? (
								<Button
									variant="primary"
									onClick={ this.handleReload }
									className="sf-btn sf-btn--primary"
								>
									{ __( 'Reload Page', 'subtleforms' ) }
								</Button>
							) : (
								<>
									<Button
										variant="primary"
										onClick={ this.handleReset }
										className="sf-btn sf-btn--primary"
									>
										{ __( 'Try Again', 'subtleforms' ) }
									</Button>
									<Button
										variant="secondary"
										onClick={ this.handleReload }
										className="sf-btn sf-btn--secondary"
									>
										{ __( 'Reload Page', 'subtleforms' ) }
									</Button>
								</>
							) }
						</div>

						{/* Support Link */}
						<p className="sf-page-error-boundary__support">
							{ __( 'If this problem persists, ', 'subtleforms' ) }
							<a
								href="https://subtleforms.com/support"
								target="_blank"
								rel="noopener noreferrer"
							>
								{ __( 'contact support', 'subtleforms' ) }
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
