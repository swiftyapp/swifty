import Brand from './Brand'
import Add from './Add'
import Switcher from './Switcher'
import VaultHealth from './VaultHealth'
import Settings from './Settings'

// The 68px icon rail: brand mark · new-secret · scope filters · spacer ·
// vault-health · settings. Rail tiles are 40px with 18px glyphs — one step up
// from the in-pane tiers so the rail reads as primary navigation.
export default function Sidebar() {
  return (
    <nav className="flex w-[68px] flex-none flex-col items-center gap-[3px] border-r border-line bg-rail py-3">
      <Brand />
      <div className="my-2 h-px w-6 bg-line2" />
      <Add />
      <div className="h-1.5" />
      <Switcher />
      <div className="flex-1" />
      <VaultHealth />
      <Settings />
    </nav>
  )
}
