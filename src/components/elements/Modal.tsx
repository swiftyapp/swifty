import type { ReactNode } from 'react'
import Close from '@/assets/images/close.svg?react'

interface Props {
  onClose: () => void
  children: ReactNode
}

export default function Modal({ onClose, children }: Props) {
  return (
    <div className="modal">
      <div className="window">
        <div className="close" onClick={onClose}>
          <Close />
        </div>
        {children}
      </div>
    </div>
  )
}
