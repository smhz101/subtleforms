/**
 * Draws what add-ons registered in an admin slot (registerSlotItem in
 * shared/extend.js). With nothing registered it draws `fallback` (nothing by
 * default).
 */
import { getSlotItems } from '../../shared/extend';

export default function ExtensionSlot({ name, fallback = null, ...props }) {
  const items = getSlotItems(name);
  if (!items.length) {
    return fallback;
  }
  return items.map((item) => {
    const Item = item.component;
    return <Item key={item.id} {...props} />;
  });
}
