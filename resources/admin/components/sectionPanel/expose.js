import '../../../shared/extend';
import SectionPanel from './SectionPanel';
import SectionHeader from './SectionHeader';

/**
 * Put the section panel and the section header on the public extension object
 * (`window.SubtleFormsExtend`) so an add-on draws its Integrations and Logs
 * sections the same way (SubtleForms Pro does). Available since 2.7.5;
 * add-ons check for it.
 *
 * @param {Object} target The object to add them to; defaults to `window.SubtleFormsExtend`.
 * @return {Object} The object.
 */
export function exposeSectionPanel(target = typeof window !== 'undefined' ? window.SubtleFormsExtend : null) {
  if (target) {
    target.SectionPanel = SectionPanel;
    target.SectionHeader = SectionHeader;
  }
  return target;
}

exposeSectionPanel();
