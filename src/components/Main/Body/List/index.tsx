import { useStore } from '@/store'
import Manager from './Manager'
import AuditList from './Audit'
import TagList from './Tags'

// What fills the column: the audit's groups, the Tags view's tag list until a
// tag is picked, and otherwise the entry rows.
export default function List() {
  const view = useStore(state => state.ui.view)
  const tag = useStore(state => state.filters.tag)
  if (view === 'health') return <AuditList />
  if (view === 'tags' && !tag) return <TagList />
  return <Manager />
}
