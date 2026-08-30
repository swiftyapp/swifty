import React, { useState } from 'react'
import Dropdown from './dropdown'
import Selected from './selected'
import TagIcon from 'tag.svg'

const Tags = () => {
  const [visible, setVisible] = useState(false)

  const onToggle = () => {
    setVisible(!visible)
  }

  return (
    <div className="tag-filter">
      <span className="tag-icon">
        <TagIcon width="16" onClick={onToggle} />
      </span>
      <Selected />
      <Dropdown visible={visible} setVisible={setVisible} />
    </div>
  )
}

export default Tags
