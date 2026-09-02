import { useStore, closeSettings, setSettingsSection } from '@/store'
import { t } from '@/i18n'
import Modal from '@/components/elements/Modal'
import IconButton from '@/components/elements/IconButton'
import Nav from './Nav'
import { titleOf } from './sections'
import Sync from './Sections/Sync'
import Security from './Sections/Security'
import Audit from './Sections/Audit'
import Import from './Sections/Import'
import Language from './Sections/Language'
import { CloseGlyph } from '../../icons'

const TITLE_ID = 'settings-title'

export default function SettingsModal() {
  const section = useStore(state => state.ui.settingsSection)

  return (
    <Modal
      onClose={closeSettings}
      className="h-[600px] w-[860px]"
      labelledBy={TITLE_ID}
      testid="settings-modal"
      hideClose
    >
      <Nav section={section} onSelect={setSettingsSection} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-none items-center gap-4 px-7 pt-6">
          <h1
            id={TITLE_ID}
            className="min-w-0 flex-1 truncate text-xl font-semibold tracking-display text-text"
          >
            {titleOf(section)}
          </h1>
          <IconButton
            onClick={closeSettings}
            title={t('Close')}
            testid="modal-close"
            muted
          >
            <CloseGlyph />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-7">
          {section === 'sync' && <Sync />}
          {section === 'security' && <Security />}
          {section === 'audit' && <Audit />}
          {section === 'import' && <Import />}
          {section === 'language' && <Language />}
        </div>
      </div>
    </Modal>
  )
}
