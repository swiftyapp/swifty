import { useState } from 'react'
import Dropdown from './Dropdown'
import Selected from './Selected'
import TagIcon from '@/assets/images/tag.svg?react'

export default function Tags() {
  const [visible, setVisible] = useState(false)

  return (
    <div className="tag-filter">
      <span className="tag-icon">
        <TagIcon width="16" onClick={() => setVisible(!visible)} />
      </span>
      <Selected />
      <Dropdown visible={visible} setVisible={setVisible} />
    </div>
  )
}
