import type { TKey } from '@/i18n'
import type { BiometryType } from '@/lib/commands'
import { FingerprintGlyph, ScanFaceGlyph } from '@/components/Main/icons'

/**
 * What the OS biometric gate is called on *this device*, and the glyph that
 * goes with the name.
 *
 * Asked of the backend (`biometry_type`, over `LAContext.biometryType`) rather
 * than derived from the build: iPhones and Touch ID iPads run the same iOS
 * binary, so a compile-time `isIOS` labelled the iPads Face ID.
 *
 * `'none'` falls to the fingerprint pair. It only reaches a call site when the
 * device has no biometry at all — in which case nothing biometric is drawn —
 * or before the probe has answered, where the desktop's historical name is the
 * safer placeholder.
 */
export const biometryLabel = (type: BiometryType): TKey =>
  type === 'face' ? 'Face ID' : 'Touch ID'

/** The matching glyph, as a component the call site sizes itself. */
export const biometryGlyph = (type: BiometryType) =>
  type === 'face' ? ScanFaceGlyph : FingerprintGlyph
