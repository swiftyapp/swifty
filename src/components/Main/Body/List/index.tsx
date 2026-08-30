import { useAppSelector } from '@/store'
import Manager from './Manager'
import AuditList from './Audit'

export default function List() {
  const scope = useAppSelector(state => state.filters.scope)
  return scope === 'audit' ? <AuditList /> : <Manager />
}
