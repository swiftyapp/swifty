import { useShallow } from 'zustand/react/shallow'
import { useStore, setFilterTag } from '@/store'
import { Dropdown as Menu, DropdownItem } from '@/components/elements/Dropdown'
import Empty from './Empty'

interface Props {
  visible: boolean
  setVisible: (visible: boolean) => void
}

export default function Dropdown({ visible, setVisible }: Props) {
  const tags = useStore(
    useShallow(state =>
      Array.from(
        new Set(
          state.entries.items
            .filter(item => item.type === state.filters.scope)
            .flatMap(entry => entry.tags ?? [])
        )
      )
    )
  )

  if (!visible) return null

  const setTag = (tag: string) => {
    setFilterTag(tag)
    setVisible(false)
  }

  return (
    <Menu onBlur={() => setVisible(false)}>
      <Empty tags={tags} />
      {tags.map(tag => (
        <DropdownItem key={tag} onClick={() => setTag(tag)}>
          {tag}
        </DropdownItem>
      ))}
    </Menu>
  )
}
