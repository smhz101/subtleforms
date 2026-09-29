/**
 * Form Error Boundary
 *
 * Wraps a single mounted form so that a render crash in one form never takes
 * down the whole page or leaves an empty container. Shows a friendly fallback
 * and logs the error so it surfaces in the browser console and any error
 * reporting without breaking sibling forms.
 */

import { Component } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default class FormErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch( error, info ) {
		// eslint-disable-next-line no-console
		console.error(
			'[SubtleForms] Form failed to render:',
			error,
			info?.componentStack
		);
	}

	render() {
		if ( this.state.hasError ) {
			return (
				<div
					className='subtleforms-error subtleforms-error--boundary'
					role='alert'>
					{ __(
						'This form couldn’t load. Please refresh the page and try again.',
						'subtleforms'
					) }
				</div>
			);
		}

		return this.props.children;
	}
}
