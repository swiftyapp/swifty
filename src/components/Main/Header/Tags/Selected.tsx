import { useStore, unsetFilterTag } from '@/store'

export default function Selected() {
  const tag = useStore(state => state.filters.tags[0])

  if (!tag) return null

  return (
    <span className="tag-selected">
      {tag}
      <span className="tag-clear" onClick={() => unsetFilterTag()}>
        x
      </span>
    </span>
  )
}
