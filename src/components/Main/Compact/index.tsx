import { useStore } from '@/store'
import { useVisualViewport, viewportStyle } from '@/hooks/useVisualViewport'
import Attached from '../Generator/Attached'
import Entry from './Entry'
import Generator from './Generator'
import Settings from './Settings'
import Vault from './Vault'
import TabBar from './TabBar'

/**
 * The phone shell: one screen at a time, derived from the store.
 *
 * There is no router. The screen is the first row of the navigation model
 * (docs/compact-shell.md) that the store makes true — a draft or an edit is the
 * form, a surface opened over the vault is that surface, a selection is the
 * detail, otherwise a tab root. Nothing here is new state, so ⌘K, the tray and
 * a save all navigate by doing what they already do.
 *
 * The order matters in one place: the two roots that can be *opened* while a row
 * is selected (Settings, the standalone generator) come before the selection, or
 * ⌘G with an entry on screen would set `generator.open` and change nothing
 * visible. A draft still wins over all of it — it is the one screen with
 * unsaved work on it. Tabs clear the selection through `setView` anyway.
 *
 * The two pushed screens (form, detail) hide the tab bar: switching view from
 * inside one would drop the selection, and any draft, out from under it.
 */
export default function Compact() {
  const writing = useStore(state => state.entries.new !== null || state.entries.edit)
  const entry = useStore(state => state.entries.current !== null)
  const settings = useStore(state => state.ui.settings)
  // The standalone generator is a root here. Opened from a password row it
  // carries somewhere to put the value, and stays the overlay it is on the
  // desktop — that one is `Attached`, below.
  const generator = useStore(
    state => state.generator.open && !state.generator.apply && !state.generator.ssh
  )
  const viewport = useVisualViewport()
  // A root is over the selection, so the bar it is left by has to stay up.
  const pushed = writing || (entry && !settings && !generator)

  return (
    <>
      <div
        data-testid="compact-shell"
        style={viewportStyle(viewport)}
        // `relative` is what the floating tab bar and its fade are pinned to.
        className="relative flex h-full min-h-0 flex-col"
      >
        {/* Both entry branches are the same component in the same slot, so
            React keeps the instance — and with it the one reveal — across the
            step from reading to writing. */}
        {writing ? (
          <Entry />
        ) : settings ? (
          <Settings />
        ) : generator ? (
          <Generator />
        ) : entry ? (
          <Entry />
        ) : (
          <Vault />
        )}
        {!pushed && <TabBar />}
      </div>
      {/* Outside the shell, like every fixed overlay: the shell carries
          `viewportStyle`'s translate, which makes it the containing block of
          anything `fixed` inside it — the sheet would take the keyboard offset
          a second time. */}
      <Attached />
    </>
  )
}
