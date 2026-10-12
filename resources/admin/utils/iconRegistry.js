/**
 * SubtleForms Icon Registry
 *
 * Single source of truth for all icon resolutions.
 * - FIELD_ICON_MAP  — field type  → Icon component
 * - UI_ICON_MAP     — UI key      → Icon component
 * - getFieldIcon()  — resolve field type, fallback Icon.Circle
 * - getUIIcon()     — resolve UI key,    fallback Icon.Circle
 *
 * NOTE: Import Icon components only from ui/Icon, never lucide-react directly.
 */

import Icon from '../ui/Icon';

// ── Field type icons ──────────────────────────────────────────────────────────

export const FIELD_ICON_MAP = {
  // Text inputs — each field gets a distinct glyph.
  text: Icon.Type,
  email: Icon.AtSign,
  phone: Icon.Phone,
  url: Icon.Link,
  number: Icon.Hash,
  textarea: Icon.AlignLeft,
  password: Icon.KeyRound,

  // Selection
  checkbox: Icon.CheckSquare,
  consent: Icon.ShieldCheck,
  radio: Icon.CircleDot,
  multiple_choice: Icon.ListChecks,
  dropdown: Icon.ChevronDown,

  // Date / Time
  date: Icon.Calendar,
  time: Icon.Clock,
  datetime: Icon.CalendarClock,

  // Location
  country: Icon.Globe,
  address: Icon.MapPin,

  // Content / Layout
  hidden: Icon.EyeOff,
  html: Icon.Code,
  disclaimer: Icon.Info,
  section_break: Icon.Heading,
  image_upload: Icon.Image,
  file_upload: Icon.FileUp,
  step: Icon.Navigation,

  // CAPTCHA — distinct glyphs per provider.
  captcha: Icon.ShieldCheck,
  recaptcha: Icon.Bot,
  hcaptcha: Icon.Shield,
  turnstile: Icon.RotateCw,

  // Composite fields
  name_group: Icon.Users,
  address_group: Icon.Building2,

  // Containers
  columns: Icon.Columns,
  column_layout: Icon.Columns2,
  repeat_container: Icon.Layers,

  // Payment
  payment_amount: Icon.CircleDollarSign,
  payment_card: Icon.CreditCard,
  payment_product: Icon.ShoppingCart,
  woo_product: Icon.Package, // SubtleForms Pro: WooCommerce Product
  payment_choice: Icon.ListChecks || Icon.Tag,
  payment_currency: Icon.Coins,
  payment_coupon: Icon.Tag,
  payment_summary: Icon.Receipt,
  payment_hidden_price: Icon.Lock,

  // Advanced
  rating: Icon.Star,
  range_slider: Icon.Sliders,
  checkbox_grid: Icon.LayoutGrid,
  toggle: Icon.ToggleRight,
  scale: Icon.Gauge,
  net_promoter_score: Icon.Gauge,
  picture_choice: Icon.Images,
  signature: Icon.PenLine,
  calculation: Icon.Calculator,
  color_picker: Icon.Palette,
  chained_select: Icon.ListTree,
  rich_text: Icon.Pilcrow,
  group_container: Icon.Group,
  two_column_container: Icon.Columns2,
  three_column_container: Icon.Columns3,
  four_column_container: Icon.Columns4,
  tel: Icon.Phone,
  select: Icon.ChevronDown,
  action_hook: Icon.Webhook,
  save_resume: Icon.Save,
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
  'move-to': Icon.CornerDownRight,
  replace: Icon.Replace,
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
