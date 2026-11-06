/**
 * Test helper: wrap a screen in a query client that never retries and never
 * keeps data fresh, so a test sees exactly the requests it expects.
 */
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';

// The library hands results to React on a timer by default; a microtask lets an
// awaited `act()` see them, so a test needs no waiting loops.
notifyManager.setScheduler( ( callback ) => queueMicrotask( callback ) );

export function testClient( options = {} ) {
	return new QueryClient( {
		defaultOptions: {
			queries: { retry: false, staleTime: 0, gcTime: Infinity, refetchOnWindowFocus: false, ...( options.queries || {} ) },
			mutations: { retry: false },
		},
	} );
}

export function withClient( node, client = testClient() ) {
	return <QueryClientProvider client={ client }>{ node }</QueryClientProvider>;
}
