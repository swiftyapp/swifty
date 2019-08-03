import React from 'react'
import NoteIcon from 'notes/note.svg'

const Note = ({ entry }) => {
  return (
    <>
      <div className="icon">
        <NoteIcon width="26" height="26" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
      </div>
    </>
  )
}

export default Note
