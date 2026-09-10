import { useStore } from '@/store'
import Manager from './Manager'
import AuditList from './Audit'

export default function List() {
  const view = useStore(state => state.ui.view)
  return view === 'health' ? <AuditList /> : <Manager />
}
