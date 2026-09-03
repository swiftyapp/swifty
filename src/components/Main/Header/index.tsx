import SyncIndicator from './SyncIndicator'
import LockButton from './LockButton'
import Controls from '@/components/elements/Controls'

// Top chrome bar (38px): window controls · sync pill + lock. Search is not
// here — it filters the list column, so it lives in it. With search gone the
// bar carries only 28px controls, so it sits just clear of them and of the
// macOS traffic lights, which the Overlay title-bar style pins ~8-20px from
// the window top and which nothing here can move.
//
// `data-tauri-drag-region="deep"` makes the whole bar and its subtree a native
// window drag region: Tauri's injected handler starts a window drag on
// mousedown and, on macOS, zooms the window on double click (cancelled if the
// pointer moves, matching AppKit). "deep" is required because the bar's drag
// surface is mostly spacer children -- the bare attribute only reacts to clicks
// landing on the element itself.
//
// The handler already treats button/input/a/label/[role]/[tabindex] as
// non-drag, so ThemeToggle and LockButton opt out for free.
export default function Header() {
  return (
    <header
      data-tauri-drag-region="deep"
      className="relative z-10 flex h-[38px] flex-none items-center gap-3.5 border-b border-line bg-[var(--chrome)] pl-[78px] pr-3 backdrop-blur-[14px]"
    >
      <Controls />
      <div className="flex-1" />
      <div className="flex flex-none items-center gap-1.5">
        <SyncIndicator />
        <LockButton />
      </div>
    </header>
  )
}
