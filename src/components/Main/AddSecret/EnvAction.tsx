import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { isMobile } from '@/lib/platform'
import { useEnvIngest } from '@/kinds/env/useIngest'
import { openEnvDraft } from '../EnvDrop/open'
import { EnvGlyph } from '../icons'

/**
 * The env file's way in that skips the tile: on the desktop a line of copy,
 * because the whole window is already the target while the picker is up (see
 * `Main/EnvDrop`); on a phone, where nothing is dropped, the file picker.
 *
 * Sits under the tiles with `ScanAction`, outside the grid the digits and
 * arrows are bound to. The divider is shared: when the scan action draws its
 * own this only needs a gap, and where the OS cannot scan this draws it.
 */
export default function EnvAction() {
  const { t } = useTranslation()
  const scan = useStore(state => state.ui.scan.supported)
  const { pick, error } = useEnvIngest(openEnvDraft)

  // A cancelled dialog leaves the picker as it was; a chosen file hands the
  // window over to the editor, which `openEnvDraft` closes the picker for.

  const row = 'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-base text-text2'

  return (
    <div className={scan ? 'mt-1' : 'mt-5 border-t border-line pt-4'}>
      {isMobile ? (
        <button
          type="button"
          data-testid="add-env-file"
          onClick={() => void pick()}
          className={`${row} cursor-pointer transition-colors hover:bg-hover hover:text-text`}
        >
          <EnvGlyph size={16} className="flex-none text-text3" />
          <span>{t('Choose a .env file')}</span>
        </button>
      ) : (
        <div data-testid="add-env-file" className={row}>
          <EnvGlyph size={16} className="flex-none text-text3" />
          <span>{t('Drop a .env file')}</span>
        </div>
      )}
      <p className="mt-1 pl-[30px] text-base text-text3">
        {isMobile
          ? t('Kept whole, read as a table of variables.')
          : t('Anywhere on this window. Kept whole, read as a table of variables.')}
      </p>
      {error && (
        <p data-testid="add-env-error" className="mt-1 pl-[30px] text-base text-bad">
          {error}
        </p>
      )}
    </div>
  )
}
