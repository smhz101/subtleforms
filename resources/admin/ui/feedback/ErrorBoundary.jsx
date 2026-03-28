/**
 * Error Boundary
 *
 * Catches React errors and displays fallback UI.
 */

import React from 'react';
import { __ } from '@wordpress/i18n';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="sf-error-boundary">
          <div className="sf-error-boundary__content">
            <h2>{__('Unexpected issue detected', 'subtleforms')}</h2>
            <p>{__('Something interrupted the page. Please refresh or try again in a moment.', 'subtleforms')}</p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="sf-error-boundary__details">
                <summary>{__('Error details', 'subtleforms')}</summary>
                <pre>{this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="sf-error-boundary__reload"
            >
              {__('Reload page', 'subtleforms')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
