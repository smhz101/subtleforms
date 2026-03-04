/**
 * Lazy Import with Retry
 *
 * Wraps React.lazy() with automatic retry logic for chunk load failures.
 * Retries up to 3 times with exponential backoff before throwing.
 *
 * @param {Function} importFn - Dynamic import function, e.g. () => import('./Page')
 * @param {number}   retries  - Max retry attempts (default: 3)
 * @returns {React.LazyExoticComponent}
 */
import { lazy } from '@wordpress/element';

export default function lazyWithRetry( importFn, retries = 3 ) {
	return lazy( () => {
		const attempt = ( remaining ) =>
			importFn().catch( ( error ) => {
				if ( remaining <= 0 ) {
					throw error;
				}

				const delay = Math.pow( 2, retries - remaining ) * 1000; // 1 s, 2 s, 4 s …

				return new Promise( ( resolve ) =>
					setTimeout( resolve, delay )
				).then( () => attempt( remaining - 1 ) );
			} );

		return attempt( retries );
	} );
}
