import { useStore } from '@/store'
import Show from './Show'
import Empty from './Empty'
import Audit from './Audit'

// Detail-pane content only. Create/edit no longer replaces it — the Form now
// renders in a right slide-in sheet over this pane (mounted by Body).
export default function Aside() {
  const scope = useStore(state => state.filters.scope)
  const entry = useStore(state => state.entries.current)

  if (entry) return <Show entry={entry} />
  if (scope === 'audit') return <Audit />
  return <Empty />
}
