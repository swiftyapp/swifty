import { useState } from 'react'
import { useUi, type Section } from '@/store'
import Root from './Root'
import Pane from './Pane'

/**
 * Settings as a tab root, not an overlay: it has no close button, because the
 * tab bar is how you leave it. A section is one level deeper — a row on the
 * root pushes its pane, and the nav row on the pane comes back.
 *
 * That "root or pane" is local state, not `ui.settingsSection`: the store's
 * section is the *wide* modal's nav selection, which persists so the desktop
 * reopens where it was left. A phone reusing it would open Settings already
 * inside a pane. Local state starts at the root and resets with the screen,
 * which is what a tab root wants — and it is not navigation the store implies,
 * so it earns no place in it.
 *
 * What the store *does* say is when the section may not be left
 * (`settingsLocked`): the wide modal's close and nav refuse under it, and the
 * pane's Back is the same move here, so it refuses the same way. The tab bar
 * needs nothing of its own — leaving Settings from there goes through
 * `closeSettings`, which is already guarded.
 */
export default function Settings() {
  const [section, setSection] = useState<Section | null>(null)
  const locked = useUi(state => state.settingsLocked)

  return section ? (
    <Pane
      section={section}
      locked={locked}
      onBack={() => {
        if (!locked) setSection(null)
      }}
    />
  ) : (
    <Root onSelect={setSection} />
  )
}
