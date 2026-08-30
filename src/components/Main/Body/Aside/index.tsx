import { useAppSelector } from '@/store'
import Form from './Form'
import Show from './Show'
import Empty from './Empty'
import Audit from './Audit'

export default function Aside() {
  const { isNew, isEditing, entry, scope } = useAppSelector(state => ({
    scope: state.filters.scope,
    isNew: state.entries.new,
    isEditing: state.entries.edit,
    entry: state.entries.current
  }))

  if (isNew) return <Form />
  if (isEditing && entry) return <Form entry={entry} />
  if (entry) return <Show entry={entry} />
  if (scope === 'audit') return <Audit />
  return <Empty />
}
