import { useStore } from '@/store'
import { cx } from '@/utils/cx'
import ListColumn from './ListColumn'
import DetailPane from './DetailPane'

// The two content panes to the right of the rail: list column + detail pane.
// Creating or editing an entry happens inside the detail pane, so the list
// stays visible for context but goes quiet and inert — nothing over there can
// compete with, or navigate away from, an unsaved draft.
export default function Body() {
  const writing = useStore(state => state.entries.edit || !!state.entries.new)

  return (
    <>
      <div className={cx('flex min-h-0 flex-none', writing && 'pointer-events-none opacity-60')}>
        <ListColumn />
      </div>
      <DetailPane />
    </>
  )
}
