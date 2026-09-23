import { useTranslation } from 'react-i18next'
import { closeAddPicker, openGenerator } from '@/store'
import { DicesGlyph } from '../icons'

/**
 * The standalone generator's pointer door: the same open as ⌘G
 * (Main/useShortcuts) with no apply callback, so the dialog just copies.
 *
 * It lives under the Add tiles because that is the moment someone needs a new
 * secret — even one for a form outside the vault. It is not a way in, though,
 * so it stands apart from the three above it under its own rule: nothing it
 * makes is saved unless the user goes on to add it.
 */
export default function GenerateAction() {
  const { t } = useTranslation()

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        data-testid="generator-button"
        onClick={() => {
          closeAddPicker()
          openGenerator()
        }}
        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-base text-text2 transition-colors hover:bg-hover hover:text-text"
      >
        <DicesGlyph size={16} className="flex-none text-text3" />
        <span>{t('Generate a password…')}</span>
      </button>
      <p className="mt-1 pl-[30px] text-base text-text3">
        {t('For anything outside the vault: copied when you’re done, never saved.')}
      </p>
    </div>
  )
}
