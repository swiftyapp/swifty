import { useStore } from '@/store'
import Manager from './Manager'
import AuditList from './Audit'

export default function List() {
  const scope = useStore(state => state.filters.scope)
  return scope === 'audit' ? <AuditList /> : <Manager />
}
