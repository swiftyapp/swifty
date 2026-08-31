import Search from './Search'
import SyncIndicator from './SyncIndicator'
import ThemeToggle from './ThemeToggle'
import LockButton from './LockButton'
import Controls from '@/components/elements/Controls'

// Top chrome bar (~46px): window controls · command search · sync pill +
// theme toggle + lock. The bar itself is the window drag region; interactive
// children opt out via `[-webkit-app-region:no-drag]`.
export default function Header() {
  return (
    <header className="relative z-10 flex h-[46px] flex-none items-center gap-3.5 border-b border-line bg-[var(--chrome)] pl-[78px] pr-3 backdrop-blur-[14px] [-webkit-app-region:drag]">
      <Controls />
      <div className="flex-1" />
      <Search />
      <div className="flex flex-1 items-center justify-end gap-1.5">
        <SyncIndicator />
        <ThemeToggle />
        <LockButton />
      </div>
    </header>
  )
}
