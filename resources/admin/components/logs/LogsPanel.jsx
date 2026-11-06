import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useToolsForms } from '../../data/queries/tools';
import { getSlotItems } from '../../../shared/extend';
import SectionPanel from '../sectionPanel/SectionPanel';
import SectionHeader from '../sectionPanel/SectionHeader';
import LogList from './LogList';
import ApiLog from './ApiLog';
import './logs.scss';

/**
 * The sections this plugin ships. An add-on adds more in the `settings.logs`
 * slot.
 */
export const BUILT_IN_LOGS = [
  {
    id: 'activity',
    order: 10,
    label: () => __('Activity', 'subtleforms'),
    description: () => __('What happened after each entry was sent.', 'subtleforms'),
  },
  {
    id: 'webhooks',
    order: 20,
    label: () => __('Webhooks', 'subtleforms'),
    description: () => __('Calls this site made to another address.', 'subtleforms'),
  },
  {
    id: 'api',
    order: 30,
    label: () => __('API', 'subtleforms'),
    description: () =>
      __('SubtleForms REST calls from the last 30 days. The address and the result are stored; the request itself is not.', 'subtleforms'),
  },
];

/**
 * Section ids in list order, built in first, then the add-ons'.
 *
 * @return {string[]} Ids.
 */
export function logSectionIds() {
  return [...BUILT_IN_LOGS.map((s) => s.id), ...getSlotItems('settings.logs').map((s) => s.id)];
}

/**
 * Settings > Logs: Activity, Webhooks and API, and the sections add-ons
 * register in the `settings.logs` slot (SubtleForms Pro adds Integrations).
 * Each section has the standard header, then its table.
 */
export default function LogsPanel() {
  const { data: forms = [] } = useToolsForms();

  const addOns = getSlotItems('settings.logs');

  const sections = useMemo(() => {
    const built = BUILT_IN_LOGS.map((item) => ({
      id: item.id,
      label: item.label(),
      status: null,
      order: item.order,
      render: () =>
        item.id === 'api' ? (
          <ApiLog title={item.label()} description={item.description()} />
        ) : (
          <LogList
            kind={item.id === 'webhooks' ? 'webhook' : 'activity'}
            forms={forms}
            title={item.label()}
            description={item.description()}
          />
        ),
    }));
    const extra = addOns
      .filter((item) => !BUILT_IN_LOGS.some((b) => b.id === item.id))
      .map((item, index) => {
        const Body = item.component;
        return {
          id: item.id,
          label: item.label || item.title || item.id,
          status: null,
          order: 100 + (item.order ?? 100) + index / 100,
          render: () => (
            <>
              <SectionHeader title={item.title || item.label || item.id} description={item.description} />
              <Body />
            </>
          ),
        };
      });
    return [...built, ...extra];
    // The registry can grow while the page loads, so it is read on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, addOns.length]);

  return <SectionPanel sections={sections} urlParam='section' label={__('Logs', 'subtleforms')} />;
}
