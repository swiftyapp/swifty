import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUi, closeSettings, setSettingsSection, type Section as Key } from '@/store'
import Modal from '@/components/elements/Modal'
import Kbd from '@/components/elements/Kbd'
import { LABEL } from '@/components/elements/tokens'
import { cx } from '@/utils/cx'
import Nav from './Nav'
import Section from './Section'
import { descriptionOf, titleOf } from './sections'
import { SubpageProvider } from './sectionNav'
import SubpageBody from './SubpageBody'
import { subpageCrumbOf, subpageDescriptionOf, subpageTitleOf, type Subpage } from './subpages'
import { BackGlyph, CloseGlyph } from '../../icons'

const TITLE_ID = 'settings-title'

export default function SettingsModal() {
  const { t } = useTranslation()
  const section = useUi(state => state.settingsSection)
  // The store already refuses to close or move while locked; the controls
  // are shown disabled so that refusal is not read as a button that broke.
  const locked = useUi(state => state.settingsLocked)
  // Local, not in the store, so Settings never reopens halfway into a form.
  const [subpage, setSubpage] = useState<Subpage | null>(null)

  // Under the same lock as the section: a sub-page is a step of it.
  const open = (next: Subpage) => {
    if (!locked) setSubpage(next)
  }
  const close = () => {
    if (!locked) setSubpage(null)
  }
  // Any nav pick lands on that section's own page, the current one included.
  const select = (next: Key) => {
    if (locked) return
    setSubpage(null)
    setSettingsSection(next)
  }

  return (
    <SubpageProvider value={{ subpage, open, close }}>
      <Modal
        // Escape and the scrim step back out of a sub-page before they close.
        onClose={subpage ? close : closeSettings}
        className="flex h-[720px] max-h-[calc(100vh-56px)] w-settings max-w-[calc(100vw-56px)]"
        // Centred, not hung from the top like a picker: at its full height the
        // card is most of the window, and the top offset would push its foot
        // past the edge at the default 700px window.
        align="center"
        labelledBy={TITLE_ID}
        testid="settings-modal"
        hideClose
      >
        <Nav section={section} onSelect={select} disabled={locked} />
        <div className="flex min-w-0 flex-1 flex-col bg-pane">
          <div className="flex flex-none items-start gap-3 px-7 pt-4 pb-3.5 inset-shadow-hairline">
            {subpage && (
              <button
                type="button"
                aria-label={t('Back')}
                title={t('Back')}
                data-testid="settings-subpage-back"
                disabled={locked}
                onClick={close}
                className={cx(
                  'grid h-7.5 w-7.5 flex-none place-items-center self-center rounded-sm border border-line2 text-text2 transition-colors',
                  locked
                    ? 'cursor-default opacity-50'
                    : 'cursor-pointer hover:border-accent-line hover:text-text'
                )}
              >
                <BackGlyph size={16} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              {subpage && (
                <div data-testid="settings-subpage-crumb" className={cx(LABEL, 'mb-0.5 truncate')}>
                  {subpageCrumbOf(subpage)}
                </div>
              )}
              <h1
                id={TITLE_ID}
                className="truncate text-xl font-semibold tracking-display text-text"
              >
                {subpage ? subpageTitleOf(subpage) : titleOf(section)}
              </h1>
              <p className="mt-0.5 text-sm text-text2">
                {subpage ? subpageDescriptionOf(subpage) : descriptionOf(section)}
              </p>
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
          {/* A sub-page takes the whole column rather than the section's
              scroller: its frame scrolls itself and pins its own action bar. */}
          {subpage ? (
            <div key={subpage.key} className="flex min-h-0 flex-1 flex-col animate-step-forward">
              <SubpageBody subpage={subpage} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-7 pt-3 pb-7">
              <div key={section} className="animate-pop">
                <Section section={section} />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </SubpageProvider>
  )
}
