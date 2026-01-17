import Icon from '../../ui/Icon';

/**
 * Centralized icon mapping for SubtleForms
 * Uses lucide-react icons via internal Icon abstraction
 */
export const getIcon = (iconNameOrType) => {
  const map = {
    // Field Types - Basic
    text: Icon.Type,
    email: Icon.Mail,
    phone: Icon.Phone,
    url: Icon.Globe,
    number: Icon.Hash,
    textarea: Icon.AlignLeft,
    password: Icon.Lock,

    // Field Types - Selection
    checkbox: Icon.CheckSquare,
    radio: Icon.Circle,
    multiple_choice: Icon.CheckSquare,
    dropdown: Icon.ChevronDown,

    // Field Types - Date/Time
    date: Icon.Calendar,
    time: Icon.Clock,
    datetime: Icon.Calendar,

    // Field Types - Location
    country: Icon.Globe,
    address: Icon.MapPin,

    // Field Types - Special
    hidden: Icon.Code,
    html: Icon.Code,
    image_upload: Icon.Image,
    file_upload: Icon.File,
    step: Icon.Navigation,
    recaptcha: Icon.Shield,
    hcaptcha: Icon.Shield,
    turnstile: Icon.Shield,
    name_group: Icon.User,
    address_group: Icon.MapPin,

    // Field Types - Payment
    payment_amount: Icon.DollarSign,
    payment_card: Icon.CreditCard,
    payment_product: Icon.ShoppingCart,
    payment_currency: Icon.DollarSign,

    // Actions
    add: Icon.Add,
    delete: Icon.Delete,
    moveUp: Icon.Up,
    moveDown: Icon.Down,
    duplicate: Icon.Copy,
    close: Icon.Close,
    edit: Icon.Edit,
    more: Icon.MoreVertical,
    drag: Icon.Move,
    move: Icon.Move,

    // Icon string names (for string-based references)
    'arrow-up-alt2': Icon.Up,
    'arrow-down-alt2': Icon.Down,
    'admin-page': Icon.Copy,
    trash: Icon.Delete,

    // Fallback
    default: Icon.Type,
  };

  return map[iconNameOrType] || map.default;
};
