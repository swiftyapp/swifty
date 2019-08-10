import React from 'react'
import Close from 'close.svg'

const Modal = ({ onClose, children }) => (
  <div className="modal">
    <div className="window">
      <div className="close" onClick={onClose}>
        <Close />
      </div>
      {children}
    </div>
  </div>
)

export default Modal
