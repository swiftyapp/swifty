import React from 'react'
import TagsInput from 'react-tagsinput'

export default ({ entry, onChange }) => {
  const { i18n } = window
  return (
    <div className="field">
      <label htmlFor="">{i18n('Tags')}</label>
      <TagsInput value={entry.tags || []} onChange={onChange} />
    </div>
  )
}
