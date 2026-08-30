import { useAppDispatch, useAppSelector } from '@/store'
import { unsetFilterTag } from '@/store/filtersSlice'

export default function Selected() {
  const dispatch = useAppDispatch()
  const tag = useAppSelector(state => state.filters.tags[0])

  if (!tag) return null

  return (
    <span className="tag-selected">
      {tag}
      <span className="tag-clear" onClick={() => dispatch(unsetFilterTag())}>
        x
      </span>
    </span>
  )
}
