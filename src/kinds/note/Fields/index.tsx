import Panel from '@/components/elements/Panel'
import { NoteField, useFields } from '@/components/elements/fields'
import Read from './Read'

export default function Fields() {
  const { set } = useFields()

  if (!set) return <Read />

  return (
    <Panel>
      {/* No label: the body is the entry, and the title is already overhead. */}
      <NoteField required />
    </Panel>
  )
}
