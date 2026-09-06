import { useState } from 'react'
import type { Section } from '@/store/uiSlice'
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
 */
export default function Settings() {
  const [section, setSection] = useState<Section | null>(null)

  return section ? (
    <Pane section={section} onBack={() => setSection(null)} />
  ) : (
    <Root onSelect={setSection} />
  )
}
