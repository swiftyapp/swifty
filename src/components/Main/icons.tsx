// The app's icon set: lucide, themed through `currentColor` so a `text-*`
// token colors every glyph in both themes.
//
// System rules (from the Keyring design system):
//   · stroke 1.75 — tracks the prototype's 1.7 hairline look (lucide's
//     default 2 reads too heavy at our sizes)
//   · three sizes — 14 inside 24–28px controls, 16 for rows and tiles, 20 for
//     the rail; call sites may override for hero surfaces
//
// Components keep the historical `*Glyph` names so this module stays the one
// place an icon choice lives.
import {
  Activity,
  ArrowDownWideNarrow,
  AtSign,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Globe,
  LayoutGrid,
  Lock,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  User,
  X,
  type LucideIcon
} from 'lucide-react'

interface IconProps {
  size?: number
  className?: string
  // Solid rather than outline, for the glyphs that carry an on/off state (the
  // favorite star). Outline is lucide's default, so this is opt-in everywhere.
  filled?: boolean
}

const glyph =
  (Icon: LucideIcon, defaultSize: 14 | 16 | 20) =>
  ({ size = defaultSize, className, filled }: IconProps) => (
    <Icon
      size={size}
      strokeWidth={1.75}
      className={className}
      fill={filled ? 'currentColor' : 'none'}
    />
  )

// Control tier (24–28px hit areas)
export const SearchGlyph = glyph(Search, 14)
export const LockGlyph = glyph(Lock, 14)
export const SunGlyph = glyph(Sun, 14)
export const MoonGlyph = glyph(Moon, 14)
export const CopyGlyph = glyph(Copy, 14)
export const CheckGlyph = glyph(Check, 14)
export const MoreGlyph = glyph(MoreHorizontal, 14)
export const EyeGlyph = glyph(Eye, 14)
export const EyeOffGlyph = glyph(EyeOff, 14)
export const PencilGlyph = glyph(Pencil, 14)
export const TrashGlyph = glyph(Trash2, 14)
export const RefreshGlyph = glyph(RefreshCw, 14)
export const DownloadGlyph = glyph(Download, 14)
export const CloseGlyph = glyph(X, 14)
export const ChevronDownGlyph = glyph(ChevronDown, 14)
export const FingerprintGlyph = glyph(Fingerprint, 14)
export const SortGlyph = glyph(ArrowDownWideNarrow, 14)
export const ExternalGlyph = glyph(ExternalLink, 14)
export const AtGlyph = glyph(AtSign, 14)
export const UserGlyph = glyph(User, 14)
export const StarGlyph = glyph(Star, 14)

// Row / tile / rail tier
export const PlusGlyph = glyph(Plus, 16)
export const GearGlyph = glyph(Settings, 16)
export const LoginGlyph = glyph(Globe, 16)
export const NoteGlyph = glyph(FileText, 16)
export const CardGlyph = glyph(CreditCard, 16)
export const ShieldGlyph = glyph(ShieldCheck, 16)
export const GlobeGlyph = glyph(Globe, 16)
export const ActivityGlyph = glyph(Activity, 16)

// Rail tier (20px, for the 40px+ rail hit areas and Settings nav headers)
export const PlusRailGlyph = glyph(Plus, 20)
export const GearRailGlyph = glyph(Settings, 20)
export const GridRailGlyph = glyph(LayoutGrid, 20)
export const StarRailGlyph = glyph(Star, 20)
export const TrashRailGlyph = glyph(Trash2, 20)
