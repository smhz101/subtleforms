/**
 * ComponentErrorBoundary — Sub-page Error Isolation
 *
 * Lightweight error boundary for wrapping individual components (DataTable,
 * BuilderCanvas, InspectorPanel, etc.) so a crash in one section doesn't
 * take down the entire page.
 *
 * Features:
 * - Inline retry button
 * - aria-live announcement for screen readers
 * - Optional custom fallback
 *
 * @example
 * <ComponentErrorBoundary name="Data Table">
 *   <DataTable rows={rows} />
 * </ComponentErrorBoundary>
 */

import { Component } from '@wordpress/element';
import { __ , sprintf } from '@wordpress/i18n';
import './ComponentErrorBoundary.scss';

export class ComponentErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = {
			hasError: false,
			error: null,
		};
	}

	static getDerivedStateFromError( error ) {
		return { hasError: true, error };
	}

	componentDidCatch( error, errorInfo ) {
		const label = this.props.name || 'Component';
		console.error( `[ComponentError: ${ label }]`, error, errorInfo );

		if ( this.props.onError ) {
			this.props.onError( error, errorInfo );
		}
	}

	handleRetry = () => {
		this.setState( { hasError: false, error: null } );
	};

	render() {
		if ( ! this.state.hasError ) {
			return this.props.children;
		}

		// Allow a custom fallback renderer
		if ( this.props.fallback ) {
			return typeof this.props.fallback === 'function'
				? this.props.fallback( {
						error: this.state.error,
						retry: this.handleRetry,
				  } )
				: this.props.fallback;
		}

		const label = this.props.name || __( 'this section', 'subtleforms' );

		return (
			<div className="sf-component-error" role="alert">
				{/* Screen reader announcement via aria-live */ }
				<div
					className="sf-sr-only"
					aria-live="assertive"
					aria-atomic="true"
				>
					{ sprintf(
						/* translators: %s: component name */
						__( 'An error occurred in %s.', 'subtleforms' ),
						label
					) }
				</div>

				<div className="sf-component-error__icon">
					<svg
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<circle cx="12" cy="16" r="1" fill="currentColor" />
					</svg>
				</div>

				<p className="sf-component-error__message">
					{ sprintf(
						/* translators: %s: component name */
						__(
							'Something went wrong in %s.',
							'subtleforms'
						),
						label
					) }
				</p>

				<button
					type="button"
					className="sf-btn sf-btn--secondary sf-btn--sm"
					onClick={ this.handleRetry }
				>
					{ __( 'Try Again', 'subtleforms' ) }
				</button>
			</div>
		);
	}
}

export default ComponentErrorBoundary;
