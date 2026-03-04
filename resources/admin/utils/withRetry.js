/**
 * Retry with Exponential Backoff
 *
 * Generic retry utility for async operations (API calls, etc.).
 * Uses exponential backoff with jitter to avoid thundering herd.
 *
 * @param {Function} fn          - Async function to retry
 * @param {Object}   options
 * @param {number}   options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number}   options.baseDelay  - Base delay in ms (default: 1000)
 * @returns {Promise<*>} Result of fn()
 * @throws Last error if all retries exhausted
 *
 * @example
 * const data = await withRetry(
 *   () => apiFetch({ path: '/subtleforms/v1/forms' }),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export default async function withRetry(
	fn,
	{ maxRetries = 3, baseDelay = 1000 } = {}
) {
	let lastError;

	for ( let i = 0; i <= maxRetries; i++ ) {
		try {
			return await fn();
		} catch ( error ) {
			lastError = error;

			if ( i < maxRetries ) {
				// Exponential backoff + jitter (±100 ms)
				const delay =
					baseDelay * Math.pow( 2, i ) + Math.random() * 200 - 100;
				await new Promise( ( resolve ) =>
					setTimeout( resolve, Math.max( 0, delay ) )
				);
			}
		}
	}

	throw lastError;
}
