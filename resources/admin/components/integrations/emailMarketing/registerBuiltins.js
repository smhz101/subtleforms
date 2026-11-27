import { getEmailMarketingServices, registerEmailMarketingService } from '../../../../shared/extend';
import { pageData } from './api';
import { LOGOS, logoFor } from './logos';
import ServiceSettings, { BrevoScreen } from './ServiceSettings';
import MailPoetStatus from './MailPoetStatus';
import ServiceFormPanel from './ServiceFormPanel';

/**
 * Mailchimp, Brevo, Kit and MailPoet go through the same registry an add-on
 * uses. Registered once, when the Email marketing screens load.
 */
const BUILT_IN = [
  { slug: 'mailchimp', order: 10, settingsComponent: ServiceSettings },
  { slug: 'brevo', order: 20, settingsComponent: BrevoScreen },
  { slug: 'kit', order: 30, settingsComponent: ServiceSettings },
  { slug: 'mailpoet', order: 40, settingsComponent: MailPoetStatus },
];

BUILT_IN.forEach(({ slug, order, settingsComponent }) => {
  registerEmailMarketingService(slug, {
    label: LOGOS[slug].title,
    icon: logoFor(slug),
    brandColor: LOGOS[slug].brandColor,
    order,
    settingsComponent,
    formComponent: ServiceFormPanel,
  });
});

/**
 * Every service the screens can draw: the registered ones, then each service
 * the server says this plugin sends for (`core`) that no add-on registered in
 * the browser. Those get the generic screens (key, test, list, mapping, tags).
 *
 * @return {Array} Services { slug, label, order, ... } in grid order.
 */
export function listServices() {
  const registered = getEmailMarketingServices();
  const known = new Set(registered.map((s) => s.slug));
  const generic = Object.entries(pageData().services)
    .filter(([slug, entry]) => entry && entry.core && !known.has(slug))
    .map(([slug, entry]) => ({ slug, label: entry.label || slug, order: 100 }));
  return [...registered, ...generic];
}
