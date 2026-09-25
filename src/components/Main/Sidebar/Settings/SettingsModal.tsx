import { useTranslation } from 'react-i18next'
import { useUi, closeSettings, setSettingsSection } from '@/store'
import Modal from '@/components/elements/Modal'
import Kbd from '@/components/elements/Kbd'
import { cx } from '@/utils/cx'
import Nav from './Nav'
import Section from './Section'
import { descriptionOf, titleOf } from './sections'
import { CloseGlyph } from '../../icons'

const TITLE_ID = 'settings-title'

export default function SettingsModal() {
  const { t } = useTranslation()
  const section = useUi(state => state.settingsSection)
  // The store already refuses to close or move while locked; the controls
  // are shown disabled so that refusal is not read as a button that broke.
  const locked = useUi(state => state.settingsLocked)

  return (
    <Modal
      onClose={closeSettings}
      className="flex h-[720px] max-h-[calc(100vh-56px)] w-settings max-w-[calc(100vw-56px)]"
      labelledBy={TITLE_ID}
      testid="settings-modal"
      hideClose
    >
      <Nav section={section} onSelect={setSettingsSection} disabled={locked} />
      <div className="flex min-w-0 flex-1 flex-col bg-pane">
        <div className="flex flex-none items-start gap-3 px-7 pt-4 pb-3.5 inset-shadow-hairline">
          <div className="min-w-0 flex-1">
            <h1
              id={TITLE_ID}
              className="truncate text-xl font-semibold tracking-display text-text"
            >
              {titleOf(section)}
            </h1>
            <p className="mt-0.5 text-sm text-text2">{descriptionOf(section)}</p>
          </div>
          {/* Says what closes it as well as closing it: Escape does the same. */}
          <button
            type="button"
            aria-label={t('Close')}
            title={t('Close')}
            data-testid="modal-close"
            disabled={locked}
            onClick={closeSettings}
            className={cx(
              'flex h-7 flex-none items-center gap-2 rounded-sm px-1.5 text-text2 transition-colors',
              locked ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-hover hover:text-text'
            )}
          >
            <Kbd>esc</Kbd>
            <CloseGlyph />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-7 pt-3 pb-7">
          <div key={section} className="animate-pop">
            <Section section={section} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
