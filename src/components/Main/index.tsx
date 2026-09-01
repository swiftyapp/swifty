import Sidebar from './Sidebar'
import Header from './Header'
import Body from './Body'
import Generator from './Generator'
import Palette from './Palette'
import { t } from '@/i18n'
import { useShortcuts } from './useShortcuts'

// Three-pane shell: a full-width top chrome bar over a row of
// rail (68px) · list column (348px) · detail pane (flex).
export function Main() {
  useShortcuts()

  return (
    <div
      data-testid="main-view"
      className="flex h-full flex-col overflow-hidden bg-app font-sans text-text select-none"
    >
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <Body />
      </div>
      <Generator />
      <Palette />
      {/* `copied-notification` + `hidden` are toggled by services/copy.ts; the
          display flip is what replays `animate-pop`. App-level so copies from
          the palette and standalone generator get feedback too. Centering uses
          auto margins so the pop's transform doesn't fight it. */}
      <div className="copied-notification hidden animate-pop fixed inset-x-0 top-4 z-50 mx-auto w-max rounded-full bg-text px-5 py-2 text-base text-detail shadow-[var(--shadow)]">
        {t('Copied to Clipboard')}
      </div>
    </div>
  )
}

export default Main
