/**
 * Email marketing as cached queries.
 *
 * The state of every service (`GET /integrations/email-marketing`) is
 * preloaded with Settings, so a service screen opens with its state and no
 * spinner. One service's state is read from that answer first and fetched
 * only when it is older than a minute. Every change (switch, connect, test,
 * disconnect) writes the new state back to the cache.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../data/queryKeys';
import { emailMarketingApi } from './api';

export const STATE_STALE_TIME = 60 * 1000;

/**
 * The connection state of every service.
 *
 * @return {Object} useQuery result; `data.services` maps a slug to its state.
 */
export function useEmailMarketingServices() {
  return useQuery({
    queryKey: queryKeys.emailMarketing.all(),
    queryFn: () => emailMarketingApi.all(),
    staleTime: STATE_STALE_TIME,
  });
}

/**
 * The connection state of one service. The all-services answer in the cache
 * (preloaded with the page) is its starting point.
 *
 * @param {string} service Service slug.
 * @return {Object} useQuery result.
 */
export function useServiceState(service) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.emailMarketing.state(service),
    queryFn: () => emailMarketingApi.state(service),
    staleTime: STATE_STALE_TIME,
    initialData: () => client.getQueryData(queryKeys.emailMarketing.all())?.services?.[service],
    initialDataUpdatedAt: () => client.getQueryState(queryKeys.emailMarketing.all())?.dataUpdatedAt,
  });
}

/**
 * Store a service's new state in the cache and mark the all-services answer
 * stale.
 *
 * @return {Function} (service, state) => void
 */
export function useStoreServiceState() {
  const client = useQueryClient();
  return (service, state) => {
    if (state && typeof state === 'object') {
      client.setQueryData(queryKeys.emailMarketing.state(service), state);
    }
    client.invalidateQueries({ queryKey: queryKeys.emailMarketing.all() });
  };
}

/** The switch of a service. Resolves with the new state. */
export function useSetServiceEnabled() {
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: ({ service, enabled }) => emailMarketingApi.setEnabled(service, enabled),
    onSuccess: (state, { service }) => store(service, state),
  });
}

/**
 * A new or removed key means another account: its lists, fields and templates
 * are not the ones in the cache.
 *
 * @param {Object} client  Query client.
 * @param {string} service Service slug.
 */
function forgetAccountData(client, service) {
  client.removeQueries({ queryKey: ['emailMarketing', 'lists', service] });
  client.removeQueries({ queryKey: ['emailMarketing', 'fields', service] });
  if (service === 'brevo') client.removeQueries({ queryKey: queryKeys.emailMarketing.templates() });
}

/** Save and check an API key. Resolves with the new state. */
export function useConnectService(service) {
  const client = useQueryClient();
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: (apiKey) => emailMarketingApi.connect(service, apiKey),
    onSuccess: (state) => {
      forgetAccountData(client, service);
      store(service, state);
    },
  });
}

/** Test the saved key. Resolves with `{ ok, message, state }`. */
export function useTestService(service) {
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: () => emailMarketingApi.test(service),
    onSuccess: (res) => store(service, res?.state),
  });
}

/** Remove the saved key. Resolves with the new state. */
export function useDisconnectService(service) {
  const client = useQueryClient();
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: () => emailMarketingApi.disconnect(service),
    onSuccess: (state) => {
      forgetAccountData(client, service);
      store(service, state);
    },
  });
}

export const LIST_STALE_TIME = 5 * 60 * 1000;

/**
 * Lists of a service, from the cache while they are under five minutes old
 * (the server caches them too); `refresh` asks the service again.
 *
 * @param {Object}  client  Query client.
 * @param {string}  service Service slug.
 * @param {boolean} refresh Skip the cache.
 * @return {Promise<Array>} Lists.
 */
export function fetchLists(client, service, refresh = false) {
  return client.fetchQuery({
    queryKey: queryKeys.emailMarketing.lists(service),
    queryFn: () => emailMarketingApi.lists(service, refresh),
    staleTime: refresh ? 0 : LIST_STALE_TIME,
  });
}

/**
 * Merge fields of a service (of an audience, for Mailchimp), cached like lists.
 *
 * @param {Object}  client  Query client.
 * @param {string}  service Service slug.
 * @param {string}  listId  List id, '' for the account.
 * @param {boolean} refresh Skip the cache.
 * @return {Promise<Array>} Fields.
 */
export function fetchFields(client, service, listId = '', refresh = false) {
  return client.fetchQuery({
    queryKey: queryKeys.emailMarketing.fields(service, listId),
    queryFn: () => emailMarketingApi.fields(service, listId, refresh),
    staleTime: refresh ? 0 : LIST_STALE_TIME,
  });
}

/**
 * Brevo's email templates, cached like lists.
 *
 * @param {Object}  client  Query client.
 * @param {boolean} refresh Skip the cache.
 * @return {Promise<Array>} Templates.
 */
export function fetchBrevoTemplates(client, refresh = false) {
  return client.fetchQuery({
    queryKey: queryKeys.emailMarketing.templates(),
    queryFn: () => emailMarketingApi.brevoTemplates(refresh),
    staleTime: refresh ? 0 : LIST_STALE_TIME,
  });
}

/** Save a service's own settings. Resolves with the new state. */
export function useSaveServiceSettings(service) {
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: (values) => emailMarketingApi.saveSettings(service, values),
    onSuccess: (state) => store(service, state),
  });
}
