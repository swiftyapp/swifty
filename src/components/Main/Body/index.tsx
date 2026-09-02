import { useStore } from '@/store'
import ListColumn from './ListColumn'
import DetailPane from './DetailPane'
import Form from './Aside/Form'

// The two content panes to the right of the rail: list column + detail pane.
// Creating or editing an entry floats the Form over both in a right slide-in
// sheet, so the detail pane keeps showing the entry underneath.
export default function Body() {
  // The kind being created, or null. An edit takes its kind from the entry.
  const newType = useStore(state => state.entries.new)
  const isEditing = useStore(state => state.entries.edit)
  const entry = useStore(state => state.entries.current)
  const editing = isEditing ? entry : null

  return (
    <>
      <ListColumn />
      <DetailPane />
      {newType && <Form type={newType} />}
      {editing && <Form type={editing.type} entry={editing} />}
    </>
  )
}
