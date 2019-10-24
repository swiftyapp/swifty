import React from 'react'
import TagsInput from 'react-tagsinput'

export default ({ entry, onChange }) => {
  return (
    <div className="field">
      <label htmlFor="">Tags</label>
      <TagsInput value={entry.tags || []} onChange={onChange} />
    </div>
  )
}
