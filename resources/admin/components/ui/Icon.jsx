/**
 * SubtleForms Icon Component Library
 *
 * NOTE: All icons in SubtleForms must be imported from this file only.
 * DO NOT import icons directly from lucide-react or any other icon library.
 *
 * This abstraction layer allows us to:
 * - Control which icons are available app-wide
 * - Switch icon libraries without touching every file
 * - Ensure consistent icon usage across the plugin
 * - Keep bundle size minimal through tree-shaking
 */

import {
  Check,
  X,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Edit3,
  Move,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  Zap,
  Play,
  Book,
  FileText,
  File,
  Layers,
  List,
  MessageCircle,
  CreditCard,
  Database,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Package,
  Mail,
  Clipboard,
  Users,
  BarChart2,
  ShoppingCart,
  Globe,
  DownloadCloud,
  ExternalLink,
  Columns,
  Loader,
  Square,
  Type,
  Phone,
  Hash,
  AlignLeft,
  CheckSquare,
  Circle,
  Clock,
  MapPin,
  Code,
  Image,
  Navigation,
  Lock,
  DollarSign,
  Undo2,
  Redo2,
  Search,
} from 'lucide-react';

/**
 * Exported Icon Library
 *
 * Usage:
 * import Icon from '../components/ui/Icon';
 * <Icon.Check size={16} />
 * <Icon.Plus className="sf-text-blue-600" />
 */
const Icon = {
  // Actions
  Check,
  Close: X,
  Add: Plus,
  Plus,
  Copy,
  Delete: Trash2,
  Trash: Trash2,
  Edit: Edit2,
  Edit2,
  Edit3,
  Move,
  Undo: Undo2,
  Redo: Redo2,

  // Navigation
  Up: ChevronUp,
  Down: ChevronDown,
  Left: ChevronLeft,
  Right: ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,

  // UI Elements
  Eye,
  Preview: Eye,
  MoreVertical,
  More: MoreVertical,
  Loader,
  Loading: Loader,
  Square,

  // Status & Feedback
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Help: HelpCircle,

  // Content Types
  FileText,
  File,
  Layers,
  List,
  MessageCircle,
  Message: MessageCircle,
  CreditCard,
  Database,
  Calendar,
  Clipboard,

  // Communication
  Mail,

  // Layout
  Columns,

  // Analytics & Charts
  TrendingUp,
  BarChart2,

  // Misc
  Zap,
  Play,
  Book,
  Package,
  Users,
  ShoppingCart,
  Globe,
  DownloadCloud,
  ExternalLink,
  Search,

  // Form Field Types
  Type,
  Phone,
  Hash,
  AlignLeft,
  CheckSquare,
  Circle,
  Clock,
  MapPin,
  Code,
  Image,
  Navigation,
  Lock,
  DollarSign,

  // Aliases for convenience
  Text: Type,
  Number: Hash,
  Textarea: AlignLeft,
  Address: MapPin,
  Password: Lock,
};

// Export both named and default
export { Icon };
export default Icon;
