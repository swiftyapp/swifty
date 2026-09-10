import { setFilterTag } from '@/store'
import { MONO_META } from '@/components/elements/tokens'
import { useTagCounts } from './useTagCounts'

// The Tags view before a tag is picked: one row per tag, busiest first, drawn
// on the entry rows' grid so the column reads the same either side of the pick.
// Picking one swaps this list for the items carrying it (`useVisibleEntries`);
// the active-tag chip above the list is the way back.
//
// With no tags there is nothing to draw here — the "no tags yet" hero belongs
// to the panes' shared empty-state machinery (`Body/Empty`), like the other
// whole-view empties.
export default function TagList() {
  const tags = useTagCounts()
  if (tags.length === 0) return null

  return (
    <div className="pb-6" data-testid="tag-list">
      {tags.map(({ tag, count }) => (
        <div
          key={tag}
          role="option"
          aria-selected={false}
          tabIndex={-1}
          data-testid={`tag-row-${tag}`}
          className="flex cursor-pointer items-center gap-3 border-l-2 border-transparent py-2.5 pl-[14px] pr-4 inset-shadow-hairline hover:bg-hover any-pointer-coarse:py-3.5"
          onClick={() => setFilterTag(tag)}
        >
          <span className="min-w-0 flex-1 truncate text-base text-text">#{tag}</span>
          <span data-testid={`tag-row-${tag}-count`} className={`flex-none ${MONO_META}`}>
            {count}
          </span>
        </div>
      ))}
    </div>
  )
}
