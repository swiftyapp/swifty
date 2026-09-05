import { useStore } from '@/store'
import { useLayout } from '@/hooks/useLayout'
import SettingsModal from './SettingsModal'
import SettingsSheet from './SettingsSheet'

/**
 * Settings, framed for whichever shell is up. Mounted by the rail on wide and
 * by the compact shell on phones — never both, since only one shell renders.
 */
export default function SettingsOverlay() {
  const open = useStore(state => state.ui.settings)
  const compact = useLayout() === 'compact'

  if (!open) return null
  return compact ? <SettingsSheet /> : <SettingsModal />
}
