import '../../../../shared/extend';
import ServiceSettings from './ServiceSettings';
import ServiceFormPanel from './ServiceFormPanel';
import MappingTable from './MappingTable';

/**
 * Put the screens Free draws for its own email marketing services on the public
 * extension object (`window.SubtleFormsExtend`), so an add-on's service looks
 * and works the same. Available since 2.12.0; add-ons check for them
 * (`typeof SubtleFormsExtend.EmailMarketingServiceSettings === 'function'`).
 *
 * @param {Object} target The object to add them to; defaults to `window.SubtleFormsExtend`.
 * @return {Object} The object.
 */
export function exposeEmailMarketing(target = typeof window !== 'undefined' ? window.SubtleFormsExtend : null) {
  if (target) {
    target.EmailMarketingServiceSettings = ServiceSettings;
    target.EmailMarketingServiceFormPanel = ServiceFormPanel;
    target.EmailMarketingMappingTable = MappingTable;
  }
  return target;
}

exposeEmailMarketing();
