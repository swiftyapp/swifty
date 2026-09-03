import Panel from '@/components/elements/Panel'
import { NoteField, TagsField } from '@/components/elements/fields'

export default function Fields() {
  return (
    <>
      <Panel>
        {/* No label: the body is the entry, and the title is already overhead. */}
        <NoteField required />
      </Panel>
      <TagsField />
    </>
  )
}
