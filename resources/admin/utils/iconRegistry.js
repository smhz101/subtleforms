/**
 * SubtleForms Icon Registry
 *
 * Single source of truth for all icon resolutions.
 * - FIELD_ICON_MAP  — field type  → Icon component
 * - UI_ICON_MAP     — UI key      → Icon component
 * - getFieldIcon()  — resolve field type, fallback Icon.Circle
 * - getUIIcon()     — resolve UI key,    fallback Icon.Circle
 *
 * NOTE: Import Icon components only from components/ui/Icon, never lucide-react directly.
 */

import Icon from '../components/ui/Icon';

// ── Field type icons ──────────────────────────────────────────────────────────

export const FIELD_ICON_MAP = {
  // Text inputs
  text: Icon.Type,
  email: Icon.Mail,
  phone: Icon.Phone,
  url: Icon.Globe,
  number: Icon.Hash,
  textarea: Icon.AlignLeft,
  password: Icon.Lock,

  // Selection
  checkbox: Icon.CheckSquare,
  radio: Icon.Circle,
  multiple_choice: Icon.CheckSquare,
  dropdown: Icon.ChevronDown,

  // Date / Time
  date: Icon.Calendar,
  time: Icon.Clock,
  datetime: Icon.Calendar,

  // Location
  country: Icon.Globe,
  address: Icon.MapPin,

  // Content / Layout
  hidden: Icon.Code,
  html: Icon.Code,
  section_break: Icon.List,
  image_upload: Icon.Image,
  file_upload: Icon.File,
  step: Icon.Navigation,

  // CAPTCHA (no Shield in Icon.jsx — use Lock)
  captcha: Icon.Lock,
  recaptcha: Icon.Lock,
  hcaptcha: Icon.Lock,
  turnstile: Icon.Lock,

  // Composite fields
  name_group: Icon.Users,
  address_group: Icon.MapPin,

  // Containers
  columns: Icon.Columns,
  column_layout: Icon.Columns,
  repeat_container: Icon.Layers,

  // Payment
  payment_amount: Icon.DollarSign,
  payment_card: Icon.CreditCard,
  payment_product: Icon.ShoppingCart,
  payment_currency: Icon.DollarSign,
};

// ── UI element icons ──────────────────────────────────────────────────────────

export const UI_ICON_MAP = {
  // Settings page tab names
  general: Icon.Settings,
  license: Icon.Key,
  frontend: Icon.Monitor,
  email: Icon.Mail,
  ai: Icon.Sparkles,
  advanced: Icon.Wrench,
  extensions: Icon.Package,

  // Template selector
  'blank-form': Icon.Plus,
  template: Icon.FileText,

  // Toolbar / action keys
  add: Icon.Plus,
  close: Icon.Close,
  delete: Icon.Trash,
  duplicate: Icon.Copy,
  edit: Icon.Edit,
  more: Icon.MoreVertical,
  move: Icon.Move,
  drag: Icon.Move,
  up: Icon.Up,
  down: Icon.Down,
  search: Icon.Search,
  lock: Icon.Lock,

  // Legacy string aliases kept for backwards-compat with FieldToolbar
  'arrow-up-alt2': Icon.Up,
  'arrow-down-alt2': Icon.Down,
  'admin-page': Icon.Copy,
  trash: Icon.Trash,
};

// ── Resolvers ─────────────────────────────────────────────────────────────────

/**
 * Resolve a field type string to its Icon component.
 * Returns Icon.Circle when the type is unknown (not the "T" Type icon).
 *
 * @param {string} fieldType
 * @returns {React.ComponentType}
 */
export const getFieldIcon = (fieldType) =>
  FIELD_ICON_MAP[fieldType] ?? Icon.Circle;

/**
 * Resolve a UI element key to its Icon component.
 * Returns Icon.Circle when the key is unknown.
 *
 * @param {string} uiKey
 * @returns {React.ComponentType}
 */
export const getUIIcon = (uiKey) =>
  UI_ICON_MAP[uiKey] ?? Icon.Circle;
