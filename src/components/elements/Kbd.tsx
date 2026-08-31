import type { ReactNode } from 'react'

// Keyboard-hint chip (⌘K, ⏎, esc). Bordered mono micro text on any surface;
// inside a filled primary Button use its `kbd` prop instead (borderless).
export default function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="flex-none rounded-sm border border-line px-[5px] py-px font-mono text-xs text-text3">
      {children}
    </span>
  )
}
