import { useStore } from '@/store'
import Form from './Form'
import Show from './Show'
import Empty from './Empty'
import Audit from './Audit'

export default function Aside() {
  const scope = useStore(state => state.filters.scope)
  const isNew = useStore(state => state.entries.new)
  const isEditing = useStore(state => state.entries.edit)
  const entry = useStore(state => state.entries.current)

  if (isNew) return <Form />
  if (isEditing && entry) return <Form entry={entry} />
  if (entry) return <Show entry={entry} />
  if (scope === 'audit') return <Audit />
  return <Empty />
}
