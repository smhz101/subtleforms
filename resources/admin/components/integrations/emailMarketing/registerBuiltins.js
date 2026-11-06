import { registerEmailMarketingService } from '../../../../shared/extend';
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
