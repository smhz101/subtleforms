/**
 * CRM as cached queries: the state of a service, its switch, connect, test
 * and disconnect, and the contact properties of the account. Every change
 * writes the new state back to the cache.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../data/queryKeys';
import { crmApi, pageData } from './api';

export const STATE_STALE_TIME = 60 * 1000;
export const PROPERTIES_STALE_TIME = 5 * 60 * 1000;

/**
 * The connection state of one service. The all-services answer in the cache is
 * its starting point.
 *
 * @param {string} service Service slug.
 * @return {Object} useQuery result.
 */
export function useServiceState(service) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.crm.state(service),
    queryFn: () => {
      // An add-on's service keeps its connection in the add-on's own API: this plugin's route answers only for its own services.
      const listed = pageData().services?.[service];
      return listed && listed.builtin === false ? Promise.resolve(listed) : crmApi.state(service);
    },
    staleTime: STATE_STALE_TIME,
    initialData: () => client.getQueryData(queryKeys.crm.all())?.services?.[service],
    initialDataUpdatedAt: () => client.getQueryState(queryKeys.crm.all())?.dataUpdatedAt,
  });
}

/**
 * Store a service's new state in the cache and mark the all-services answer stale.
 *
 * @return {Function} (service, state) => void
 */
export function useStoreServiceState() {
  const client = useQueryClient();
  return (service, state) => {
    if (state && typeof state === 'object') {
      client.setQueryData(queryKeys.crm.state(service), state);
    }
    client.invalidateQueries({ queryKey: queryKeys.crm.all() });
  };
}

/** The switch of a service. Resolves with the new state. */
export function useSetServiceEnabled() {
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: ({ service, enabled }) => crmApi.setEnabled(service, enabled),
    onSuccess: (state, { service }) => store(service, state),
  });
}

/** Save and check a token. Resolves with the new state. */
export function useConnectService(service) {
  const client = useQueryClient();
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: (token) => crmApi.connect(service, token),
    onSuccess: (state) => {
      client.removeQueries({ queryKey: queryKeys.crm.properties(service) });
      store(service, state);
    },
  });
}

/** Test the saved token. Resolves with `{ ok, message, state }`. */
export function useTestService(service) {
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: () => crmApi.test(service),
    onSuccess: (res) => store(service, res?.state),
  });
}

/** Remove the saved token. Resolves with the new state. */
export function useDisconnectService(service) {
  const client = useQueryClient();
  const store = useStoreServiceState();
  return useMutation({
    retry: false,
    mutationFn: () => crmApi.disconnect(service),
    onSuccess: (state) => {
      client.removeQueries({ queryKey: queryKeys.crm.properties(service) });
      store(service, state);
    },
  });
}

/**
 * Contact properties of the account, cached for five minutes (the server
 * caches them too); `refresh` asks the CRM again.
 *
 * @param {Object}  client  Query client.
 * @param {string}  service Service slug.
 * @param {boolean} refresh Skip the cache.
 * @return {Promise<Array>} Properties { name, label }.
 */
export function fetchProperties(client, service, refresh = false) {
  return client.fetchQuery({
    queryKey: queryKeys.crm.properties(service),
    queryFn: () => crmApi.properties(service, refresh),
    staleTime: refresh ? 0 : PROPERTIES_STALE_TIME,
  });
}
