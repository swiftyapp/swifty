import { useUi } from '@/store'
import Manager from './Manager'
import AuditList from './Audit'

export default function List() {
  const view = useUi(state => state.view)
  return view === 'health' ? <AuditList /> : <Manager />
}
