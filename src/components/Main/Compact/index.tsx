import { useStore } from '@/store'
import { useVisualViewport, viewportStyle } from '@/hooks/useVisualViewport'
import Detail from './Detail'
import Form from './Form'
import Settings from './Settings'
import Vault from './Vault'
import TabBar from './TabBar'

/**
 * The phone shell: one screen at a time, derived from the store.
 *
 * There is no router. The screen is the first row of the navigation model
 * (docs/compact-shell.md) that the store makes true — a draft or an edit is the
 * form, a selection is the detail, otherwise a tab root. Nothing here is new
 * state, so ⌘K, the tray and a save all navigate by doing what they already do.
 *
 * The two pushed screens (form, detail) hide the tab bar: switching view from
 * inside one would drop the selection, and any draft, out from under it.
 */
export default function Compact() {
  // `entries.new`/`edit` before `current`: editing an entry is both, and what
  // it is is a form.
  const writing = useStore(state => state.entries.new !== null || state.entries.edit)
  const entry = useStore(state => state.entries.current !== null)
  const settings = useStore(state => state.ui.settings)
  const viewport = useVisualViewport()
  const pushed = writing || entry

  return (
    <div
      data-testid="compact-shell"
      style={viewportStyle(viewport)}
      // `relative` is what the floating tab bar and its fade are pinned to.
      className="relative flex h-full min-h-0 flex-col"
    >
      {writing ? <Form /> : entry ? <Detail /> : settings ? <Settings /> : <Vault />}
      {/* The standalone generator is still the sheet `Main` mounts (slice 5
          makes it a root), so it is not a screen here — only a lit tab. */}
      {!pushed && <TabBar />}
    </div>
  )
}
