import { useStore } from '@/store'
import Panel from './Panel'

// The ⌘K command palette. Mount it once inside the unlocked shell; it renders
// nothing until `ui.palette` is set (⌘K, or any other control calling
// `openPalette`).
export default function Palette() {
  const open = useStore(state => state.ui.palette)
  return open ? <Panel /> : null
}
