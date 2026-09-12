import { useTranslation } from 'react-i18next'
import { useLayout } from '@/hooks/useLayout'
import { FrameProvider } from '@/components/elements/Frame'
import Modal from '@/components/elements/Modal'
import Sheet from '@/components/elements/Sheet'
import Wide from './Wide'
import Compact from './Compact'
import Palette from './Palette'
import AddSecret from './AddSecret'
import Scan from './Scan'
import EnvDrop from './EnvDrop'
import { useShortcuts } from './useShortcuts'

// Two shells, one set of overlays. `Wide` is the three-pane desktop/iPad layout
// (rail 56px · list 348px · detail flex); `Compact` is the phone one, a screen
// at a time over a tab bar. This is the one place that asks which: everything
// below is either shared, composed differently by the two shells, or — for the
// overlays — framed by the `Frame` handed down from here.
export function Main() {
  const { t } = useTranslation()
  const compact = useLayout() === 'compact'
  useShortcuts()

  return (
    <div
      data-testid="main-view"
      className="flex h-full flex-col overflow-hidden bg-app font-sans text-text select-none"
    >
      <FrameProvider value={compact ? Sheet : Modal}>
        {/* The generator is not here: it is a dialog on one shell and a tab
            root plus an overlay on the other, so each shell mounts its own. */}
        {compact ? <Compact /> : <Wide />}
        {/* ⌘K needs a keyboard to reach and a rail's worth of room to read: on a
            phone it is neither reachable nor the way anything is found. */}
        {!compact && <Palette />}
        <AddSecret />
        <Scan />
        <EnvDrop />
      </FrameProvider>
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
