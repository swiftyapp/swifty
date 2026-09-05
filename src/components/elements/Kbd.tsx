import type { ReactNode } from 'react'
import { MONO_META } from './tokens'

// Keyboard-hint chip (⌘K, ⏎, esc). Bordered mono micro text on any surface;
// inside a filled primary Button use its `kbd` prop instead (borderless).
export default function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className={`flex-none rounded-xs border border-line px-[5px] py-px ${MONO_META}`}>
      {children}
    </span>
  )
}
