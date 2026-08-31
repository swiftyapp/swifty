import { useEffect } from 'react'
import { openPalette } from '@/store'
import { lockVault } from './Palette/commands'

// App-wide chords for the unlocked vault. Mounted once from `Main`, so they are
// live only while the vault is open and die with it.
//
// Deliberately one small effect with one `switch`: adding a chord is a case,
// not a new listener, and two branches touching this file merge cleanly.
const BINDINGS: Record<string, () => void> = {
  k: openPalette,
  l: lockVault
}

export const useShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const run = BINDINGS[e.key.toLowerCase()]
      if (!run) return
      e.preventDefault()
      run()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
