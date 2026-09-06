import { useTranslation } from 'react-i18next'
import type { BiometryType } from '@/lib/commands'
import { biometryLabel, biometryGlyph } from '@/lib/biometry'

interface Props {
  /** Which gate this device has, so the caption is the OS's own word for it. */
  biometry: BiometryType
  onUnlock: () => void
}

// The phone's lead affordance: an 88px tile a thumb lands on without aiming,
// the glyph in the biometric rose the desktop card already uses. It names
// itself with whatever the OS calls the gate here (Face ID / Touch ID) — the
// caption is that name rather than a sentence, so no locale has to translate
// a proper noun.
export default function BiometricTile({ biometry, onUnlock }: Props) {
  const { t } = useTranslation()
  const label = t(biometryLabel(biometry))
  const Glyph = biometryGlyph(biometry)

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        data-testid="biometric-tile"
        aria-label={label}
        onClick={onUnlock}
        className="flex h-22 w-22 cursor-pointer items-center justify-center rounded-2xl border border-line2 bg-card text-touchid shadow-float transition-transform active:scale-95"
      >
        <Glyph size={40} />
      </button>
      <span className="text-base text-text2">{label}</span>
    </div>
  )
}
