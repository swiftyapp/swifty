import { useStore } from '@/store'
import { scopeEyebrow, scopeTitle } from '../scope'
import Tags from '../Header/Tags'
import List from './List'

// The middle pane: a scope header (mono eyebrow + large title) with the tag
// filter, over the existing scrollable entry list. Full list-item styling and
// the final tag-chip placement are PR 4 — this keeps it functional and legible.
export default function ListColumn() {
  const scope = useStore(state => state.filters.scope)

  return (
    <div className="flex w-[348px] min-h-0 flex-none flex-col border-r border-line bg-list">
      <div className="flex-none px-4 pt-4 pb-2.5">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text3">
          {scopeEyebrow(scope)}
        </div>
        <div className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-text">
          {scopeTitle(scope)}
        </div>
        <div className="mt-3">
          <Tags />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <List />
      </div>
    </div>
  )
}
