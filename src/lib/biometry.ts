import type { TKey } from '@/i18n'
import { isIOS } from '@/lib/platform'
import { FingerprintGlyph, ScanFaceGlyph } from '@/components/Main/icons'

/**
 * What this build calls the OS biometric gate, decided once at compile time
 * (rule 3 — `isIOS` is baked in by vite.config.ts, not sniffed at runtime).
 *
 * The backend only reports *whether* biometrics are available, not which kind:
 * `is_biometric_available` is one `LAContext::canEvaluatePolicy` on Apple
 * platforms. So iOS is labelled Face ID, which is right for every current
 * iPhone; the few Touch ID iPads read the wrong name until `LAContext`'s
 * `biometryType` is plumbed through (see docs/compact-shell.md, Follow-ups).
 * Everywhere else keeps Touch ID / Windows Hello's fingerprint, which is what
 * the desktop has always said.
 */
export const BIOMETRY_LABEL: TKey = isIOS ? 'Face ID' : 'Touch ID'

/** The glyph that goes with that name. */
export const BiometryGlyph = isIOS ? ScanFaceGlyph : FingerprintGlyph
