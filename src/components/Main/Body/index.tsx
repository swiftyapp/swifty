import { useStore } from '@/store'
import ListColumn from './ListColumn'
import DetailPane from './DetailPane'
import Form from './Aside/Form'

// The two content panes to the right of the rail: list column + detail pane.
// Creating or editing an entry floats the Form over both in a right slide-in
// sheet, so the detail pane keeps showing the entry underneath.
export default function Body() {
  const isNew = useStore(state => state.entries.new)
  const isEditing = useStore(state => state.entries.edit)
  const entry = useStore(state => state.entries.current)
  const editing = isEditing ? entry : null

  return (
    <>
      <ListColumn />
      <DetailPane />
      {isNew && <Form />}
      {editing && <Form entry={editing} />}
    </>
  )
}
