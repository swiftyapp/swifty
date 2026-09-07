import type { BiometryType } from '@/lib/commands'
import { FingerprintGlyph, FaceIdGlyph } from '@/components/Main/icons'

/**
 * The glyph for the biometric gate this device has — the pair to
 * `biometryLabel` (lib/biometry.ts), sized by the call site.
 *
 * A component rather than the `type => Component` lookup it used to be:
 * choosing the component in the caller's render body is what
 * `react-hooks/static-components` flags, since it cannot see that both
 * branches are module-level icons. Choosing the *element* here draws the same
 * thing and keeps the rule on everywhere else.
 */
export default function BiometryGlyph({
  type,
  size
}: {
  type: BiometryType
  size?: number
}) {
  return type === 'face' ? <FaceIdGlyph size={size} /> : <FingerprintGlyph size={size} />
}
