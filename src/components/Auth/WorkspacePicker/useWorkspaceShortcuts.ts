import { useEffect } from 'react'
import type { Workspace } from '@/api/types'
import { keyCode } from '@/utils/keys'

// ⌘1–⌘9 (Ctrl on a PC) pick the vault in that place on the list, the chords
// the menu prints beside each row. Keyed by physical key, like every chord
// (see `keyCode`). Mounted with the lock screen, so they are live only there —
// the unlocked shell has chords of its own.
export const useWorkspaceShortcuts = (list: Workspace[], onPick: (id: string) => void) => {
  useEffect(() => {
    if (list.length === 0) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      const digit = /^(?:Digit)?([1-9])$/.exec(keyCode(event))
      const workspace = digit && list[Number(digit[1]) - 1]
      if (!workspace) return
      event.preventDefault()
      onPick(workspace.id)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [list, onPick])
}
