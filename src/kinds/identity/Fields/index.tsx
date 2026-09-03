import Panel from '@/components/elements/Panel'
import {
  CustomFieldsField,
  DateField,
  Field,
  NoteField,
  TagsField,
  useFields
} from '@/components/elements/fields'
import { docTypeOf, droppedKeys, specOf, TEMPLATES, type DocType } from '../templates'
import DocTypeRow from './DocType'

// An ID document, rendered from its template: the document type picks the rows,
// and each row is one of the three faces the field set already has (a text row,
// a date row, the note body). No row is written out here, so adding a field to a
// document is an entry in `templates.ts` and nothing else.
export default function Fields() {
  const { entry, set } = useFields()
  const editing = !!set
  const docType = docTypeOf(entry)

  // Switching the type re-cuts the form. The rows it drops are cleared on the
  // way out, so a value nobody can see any more never rides along into a save.
  const switchTo = (next: DocType) => {
    if (!set) return
    set('doc_type', next)
    for (const key of droppedKeys(docType, next)) set(key, '')
  }

  return (
    <>
      <div className="mb-3">
        <DocTypeRow value={docType} onChange={switchTo} editing={editing} />
      </div>
      <Panel>
        {TEMPLATES[docType].map(({ key, required }) => {
          const spec = specOf(key)
          if (spec.note)
            return <NoteField key={key} name={key} label={spec.label} required={required} />
          if (spec.date)
            return <DateField key={key} name={key} label={spec.label} required={required} />
          return (
            <Field
              key={key}
              name={key}
              label={spec.label}
              required={required}
              secure={spec.secret}
              big={spec.big}
              placeholder={spec.placeholder}
              maxLength={spec.maxLength}
            />
          )
        })}
      </Panel>
      <CustomFieldsField />
      <TagsField />
    </>
  )
}
