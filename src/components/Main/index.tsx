import { useTranslation } from 'react-i18next'
import { useLayout } from '@/hooks/useLayout'
import Wide from './Wide'
import Compact from './Compact'
import Generator from './Generator'
import Palette from './Palette'
import AddSecret from './AddSecret'
import Scan from './Scan'
import { useShortcuts } from './useShortcuts'

// Two shells, one set of overlays. `Wide` is the three-pane desktop/iPad layout
// (rail 56px · list 348px · detail flex); `Compact` is the phone one, a screen
// at a time over a tab bar. The overlays frame themselves for whichever is up.
export function Main() {
  const { t } = useTranslation()
  const compact = useLayout() === 'compact'
  useShortcuts()

  return (
    <div
      data-testid="main-view"
      className="flex h-full flex-col overflow-hidden bg-app font-sans text-text select-none"
    >
      {compact ? <Compact /> : <Wide />}
      <Generator />
      {/* ⌘K needs a keyboard to reach and a rail's worth of room to read: on a
          phone it is neither reachable nor the way anything is found. */}
      {!compact && <Palette />}
      <AddSecret />
      <Scan />
      {/* `copied-notification` + `hidden` are toggled by services/copy.ts; the
          display flip is what replays `animate-pop`. App-level so copies from
          the palette and standalone generator get feedback too. Centering uses
          auto margins so the pop's transform doesn't fight it. */}
      <div
        data-testid="copy-toast"
        className="copied-notification hidden animate-pop fixed inset-x-0 top-4 z-50 mx-auto w-max rounded-full bg-text px-5 py-2 text-base text-detail shadow-float"
      >
        {t('Copied to Clipboard')}
      </div>
    </div>
  )
}

export default Main
