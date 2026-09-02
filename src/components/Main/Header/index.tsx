import Search from './Search'
import SyncIndicator from './SyncIndicator'
import LockButton from './LockButton'
import Controls from '@/components/elements/Controls'

// Top chrome bar (~46px): window controls · command search · sync pill + lock.
// The right side carries only controls that change state the user cares about
// now, so the sync pill is absent until sync is configured.
//
// `data-tauri-drag-region="deep"` makes the whole bar and its subtree a native
// window drag region: Tauri's injected handler starts a window drag on
// mousedown and, on macOS, zooms the window on double click (cancelled if the
// pointer moves, matching AppKit). "deep" is required because the bar's drag
// surface is mostly spacer children -- the bare attribute only reacts to clicks
// landing on the element itself.
//
// The handler already treats button/input/a/label/[role]/[tabindex] as
// non-drag, so the sync pill, LockButton and the search input opt out for free.
// Search additionally gets an explicit "false" so the field's padding and
// border read as a text field rather than as window chrome.
export default function Header() {
  return (
    <header
      data-tauri-drag-region="deep"
      className="relative z-10 flex h-[46px] flex-none items-center gap-3.5 border-b border-line bg-[var(--chrome)] pl-[78px] pr-3 backdrop-blur-[14px]"
    >
      <Controls />
      <div className="flex-1" />
      <div data-tauri-drag-region="false" className="flex-none">
        <Search />
      </div>
      <div className="flex flex-1 items-center justify-end gap-1.5">
        <SyncIndicator />
        <LockButton />
      </div>
    </header>
  )
}
