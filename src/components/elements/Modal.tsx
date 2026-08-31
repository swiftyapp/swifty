import type { ReactNode } from 'react'
import { CloseGlyph } from '../Main/icons'

interface Props {
  onClose: () => void
  children: ReactNode
}

export default function Modal({ onClose, children }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] p-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-[720px] overflow-hidden rounded-xl border border-line2 bg-detail text-text shadow-[var(--shadow)]"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-sm text-text3 transition-colors hover:bg-hover hover:text-text"
        >
          <CloseGlyph />
        </button>
        {children}
      </div>
    </div>
  )
}
