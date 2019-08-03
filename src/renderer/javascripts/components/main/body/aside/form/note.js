import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import Field from './field'

import { saveEntry } from 'actions/entries'

const Note = ({ entry }) => {
  const dispatch = useDispatch()
  const [validate, setValidate] = useState(false)
  const [note, setNote] = useState(
    entry || {
      type: 'note',
      title: '',
      note: ''
    }
  )

  const reset = () => {
    if (entry) {
      dispatch({ type: 'SET_CURRENT_ENTRY', id: entry.id })
    } else {
      dispatch({ type: 'SET_NO_ENTRY' })
    }
  }

  const saveNote = () => {
    if (note.title && note.note) {
      dispatch(saveEntry(note))
    } else {
      setValidate(true)
    }
  }

  const updateNote = event => {
    let obj = {}
    obj[event.target.name] = event.target.value
    setNote({ ...note, ...obj })
  }

  return (
    <div className="aside">
      <Field
        name="Title"
        entry={note}
        onChange={updateNote}
        validate={validate}
      />
      <Field
        name="Note"
        entry={note}
        onChange={updateNote}
        validate={validate}
        rows="15"
      />
      <div className="actions">
        <span className="cancel" onClick={reset}>
          Cancel
        </span>
        <span className="button" onClick={saveNote}>
          Save
        </span>
      </div>
    </div>
  )
}

export default Note
