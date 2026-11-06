import '../../../shared/extend';
import PageHeader, { PageHeaderActions } from './PageHeader';
import DataTable from '../DataTable';
import RowActions from '../RowActions';

/**
 * Put the page header and the data table on the public extension object
 * (`window.SubtleFormsExtend`), so an add-on page looks like the rest of
 * SubtleForms (SubtleForms Pro does it for Orders and Coupons). Available since
 * 2.7.5; add-ons check for them.
 *
 * @param {Object} target The object to add them to; defaults to `window.SubtleFormsExtend`.
 * @return {Object} The object.
 */
export function exposePageHeader(target = typeof window !== 'undefined' ? window.SubtleFormsExtend : null) {
  if (target) {
    target.PageHeader = PageHeader;
    target.PageHeaderActions = PageHeaderActions;
    target.DataTable = DataTable;
    target.RowActions = RowActions;
  }
  return target;
}

exposePageHeader();
