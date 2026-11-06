/**
 * The admin app's one query client.
 *
 * It is created once, here, so the app (QueryClientProvider in AdminApp) and
 * add-ons (`window.SubtleFormsExtend.queryClient`) share a single cache. Data
 * the server sent with the page (see `preload.js` and `seeds.js`) is put in
 * the cache before the first render, so a screen opens with its data.
 */
import { QueryClient } from '@tanstack/react-query';
import { seedQueryClient } from './preload';
import { PRELOAD_SEEDS } from './seeds';

export const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 30 * 1000,
		},
		mutations: {
			retry: 1,
		},
	},
} );

seedQueryClient( queryClient, PRELOAD_SEEDS );
