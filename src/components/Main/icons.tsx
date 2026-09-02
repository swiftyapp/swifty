// The app's icon set: lucide, themed through `currentColor` so a `text-*`
// token colors every glyph in both themes.
//
// System rules (from the Keyring design system):
//   · stroke 1.75 — tracks the prototype's 1.7 hairline look (lucide's
//     default 2 reads too heavy at our sizes)
//   · two sizes — 14 inside 24–28px controls, 16 everywhere else
//     (rows, tiles, rail); call sites may override for hero surfaces
//
// Components keep the historical `*Glyph` names so this module stays the one
// place an icon choice lives.
import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
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
  Sun,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react'

interface IconProps {
  size?: number
  className?: string
}

const glyph =
  (Icon: LucideIcon, defaultSize: 14 | 16) =>
  ({ size = defaultSize, className }: IconProps) => (
    <Icon size={size} strokeWidth={1.75} className={className} />
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

// Row / tile / rail tier
export const PlusGlyph = glyph(Plus, 16)
export const GearGlyph = glyph(Settings, 16)
export const LoginGlyph = glyph(Globe, 16)
export const NoteGlyph = glyph(FileText, 16)
export const CardGlyph = glyph(CreditCard, 16)
export const ShieldGlyph = glyph(ShieldCheck, 16)
export const AllItemsGlyph = glyph(LayoutGrid, 16)
