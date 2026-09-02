import type { Kind } from './types'

// The glyph-tile classes for each kind's identity ink (see styles/theme.css).
// Tailwind resolves class names statically, so the tokens are spelled out per
// kind rather than interpolated — which is exactly why this lives in one place
// instead of being rewritten by every surface that shows a kind glyph.
export const KIND_TINT: Record<Kind['tint'], string> = {
  login: 'bg-kind-login-soft text-kind-login',
  card: 'bg-kind-card-soft text-kind-card',
  note: 'bg-kind-note-soft text-kind-note'
}
