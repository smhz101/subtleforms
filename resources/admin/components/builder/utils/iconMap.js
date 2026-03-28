import Icon from '../../ui/Icon';
import { FIELD_ICON_MAP, UI_ICON_MAP } from '../../../utils/iconRegistry';

/**
 * Icon resolver for builder components.
 *
 * Delegates to the central iconRegistry for all resolutions.
 * Handles both field types (FIELD_ICON_MAP) and UI/action keys (UI_ICON_MAP).
 * Fallback: Icon.Circle (not Icon.Type).
 *
 * @param {string} nameOrType  Field type or UI key
 * @returns {React.ComponentType}
 */
export const getIcon = (nameOrType) =>
  FIELD_ICON_MAP[nameOrType] ?? UI_ICON_MAP[nameOrType] ?? Icon.Circle;

