import { registerCrmService } from '../../../../shared/extend';
import { LOGOS, logoFor } from './logos';
import HubSpotSettings from './HubSpotSettings';
import HubSpotFormPanel from './HubSpotFormPanel';

/**
 * HubSpot goes through the same registry an add-on uses. Registered once,
 * when the CRM screens load.
 */
registerCrmService('hubspot', {
  label: LOGOS.hubspot.title,
  icon: logoFor('hubspot'),
  brandColor: LOGOS.hubspot.brandColor,
  order: 10,
  settingsComponent: HubSpotSettings,
  formComponent: HubSpotFormPanel,
});
