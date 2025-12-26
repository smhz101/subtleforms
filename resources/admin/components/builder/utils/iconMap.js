import {
  FiType,
  FiMail,
  FiPhone,
  FiGlobe,
  FiHash,
  FiAlignLeft,
  FiCheckSquare,
  FiCircle,
  FiChevronDown,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiCode,
  FiImage,
  FiFile,
  FiPlus,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiCopy,
  FiX,
  FiEdit2,
  FiMoreVertical,
  FiMove,
  FiNavigation,
  FiLock,
  FiDollarSign,
  FiCreditCard,
  FiShoppingCart,
} from 'react-icons/fi';

/**
 * Centralized icon mapping for SubtleForms
 * Uses Feather Icons (react-icons/fi) for consistency
 */
export const getIcon = (iconNameOrType) => {
  const map = {
    // Field Types - Basic
    text: FiType,
    email: FiMail,
    phone: FiPhone,
    url: FiGlobe,
    number: FiHash,
    textarea: FiAlignLeft,
    password: FiLock,

    // Field Types - Selection
    checkbox: FiCheckSquare,
    radio: FiCircle,
    multiple_choice: FiCheckSquare,
    dropdown: FiChevronDown,

    // Field Types - Date/Time
    date: FiCalendar,
    time: FiClock,
    datetime: FiCalendar,

    // Field Types - Location
    country: FiGlobe,
    address: FiMapPin,

    // Field Types - Special
    hidden: FiCode,
    html: FiCode,
    image_upload: FiImage,
    file_upload: FiFile,
    step: FiNavigation,

    // Field Types - Payment
    payment_amount: FiDollarSign,
    payment_card: FiCreditCard,
    payment_product: FiShoppingCart,
    payment_currency: FiDollarSign,

    // Actions
    add: FiPlus,
    delete: FiTrash2,
    moveUp: FiArrowUp,
    moveDown: FiArrowDown,
    duplicate: FiCopy,
    close: FiX,
    edit: FiEdit2,
    more: FiMoreVertical,
    drag: FiMove,
    move: FiMove,

    // Icon string names (for string-based references)
    'arrow-up-alt2': FiArrowUp,
    'arrow-down-alt2': FiArrowDown,
    'admin-page': FiCopy,
    trash: FiTrash2,

    // Fallback
    default: FiType,
  };

  return map[iconNameOrType] || map.default;
};
