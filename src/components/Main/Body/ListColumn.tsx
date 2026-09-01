import { useStore } from '@/store'
import { scopeEyebrow, scopeTitle } from '../scope'
import Tags from '../Header/Tags'
import List from './List'
import SortMenu from './List/SortMenu'

// The middle pane: a scope header (mono eyebrow + large title) with the sort
// control and the tag filter chips, over the scrollable entry list.
export default function ListColumn() {
  const scope = useStore(state => state.filters.scope)

  return (
    <div className="flex w-[348px] min-h-0 flex-none flex-col border-r border-line bg-list">
      <div className="flex-none px-4 pt-4 pb-2.5">
        <div className="flex items-end gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs uppercase tracking-label text-text3">
              {scopeEyebrow(scope)}
            </div>
            <div className="mt-1.5 text-xl font-semibold tracking-display text-text">
              {scopeTitle(scope)}
            </div>
          </div>
          {/* The audit list has its own severity order — nothing to sort. */}
          {scope !== 'audit' && <SortMenu />}
        </div>
        <Tags />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <List />
      </div>
    </div>
  )
}
