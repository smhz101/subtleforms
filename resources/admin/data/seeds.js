/**
 * Which preloaded REST answers go into which query.
 *
 * `{ path, key }`: the path is exactly what the server preloads
 * (`AdminPreload::defaultPaths()`), the key is the query that asks for the
 * same data. The answer is stored the way the query function would return it,
 * so the screen's first render reads it from the cache and the request is
 * never made until the data is stale.
 *
 * Keep each entry in step with the PHP list and with the query it feeds.
 */
import { queryKeys } from './queryKeys';

export const SETTINGS_PATH = '/subtleforms/v1/settings';
export const DASHBOARD_PATH = '/subtleforms/v1/dashboard';
export const EMAIL_MARKETING_PATH = '/subtleforms/v1/integrations/email-marketing';

export const PRELOAD_SEEDS = [
	{ path: SETTINGS_PATH, key: queryKeys.settings.general() },
	{ path: EMAIL_MARKETING_PATH, key: queryKeys.emailMarketing.all() },
	{ path: DASHBOARD_PATH, key: queryKeys.dashboard.stats() },
];
