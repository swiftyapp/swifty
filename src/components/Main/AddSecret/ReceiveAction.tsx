import { useTranslation } from 'react-i18next'
import { closeAddPicker, openReceive } from '@/store'
import { ShareGlyph } from '../icons'

/**
 * The one way in that adds an entry without writing one: a link someone else
 * made. It belongs under the tiles rather than among them — every tile asks
 * *what kind*, and this one already knows, because the link says.
 *
 * Sits below `EnvAction`, which owns the divider, so this only needs the gap.
 */
export default function ReceiveAction() {
  const { t } = useTranslation()

  return (
    <div className="mt-1">
      <button
        type="button"
        data-testid="add-receive-share"
        onClick={() => {
          openReceive()
          closeAddPicker()
        }}
        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-base text-text2 transition-colors hover:bg-hover hover:text-text"
      >
        <ShareGlyph size={16} className="flex-none text-text3" />
        <span>{t('Receive a shared secret…')}</span>
      </button>
      <p className="mt-1 pl-[30px] text-base text-text3">
        {t('Paste a link someone sent you from {{appName}}.')}
      </p>
    </div>
  )
}
