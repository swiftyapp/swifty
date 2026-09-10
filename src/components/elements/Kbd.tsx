import type { ReactNode } from 'react'
import { META } from './tokens'

// Keyboard-hint chip (⌘K, ⏎, esc). Bordered micro text on any surface;
// inside a filled primary Button use its `kbd` prop instead (borderless).
export default function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className={`flex-none rounded-xs border border-line px-[5px] py-px ${META}`}>
      {children}
    </span>
  )
}
