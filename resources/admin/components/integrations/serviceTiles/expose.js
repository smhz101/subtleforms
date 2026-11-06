import '../../../../shared/extend';
import ServiceTileGrid from './ServiceTileGrid';
import ServiceDetailHeader from './ServiceDetailHeader';

/**
 * Put the shared tile grid and service header on the public extension object
 * (`window.SubtleFormsExtend`), so an add-on draws the same screens (SubtleForms
 * Pro does it for CRM). Extension point level 4.
 *
 * @param {Object} target The object to add them to; defaults to `window.SubtleFormsExtend`.
 * @return {Object} The object.
 */
export function exposeServiceTiles(target = typeof window !== 'undefined' ? window.SubtleFormsExtend : null) {
  if (target) {
    target.ServiceTileGrid = ServiceTileGrid;
    target.ServiceDetailHeader = ServiceDetailHeader;
  }
  return target;
}

exposeServiceTiles();
