import { Fragment } from 'react'
import Panel from '@/components/elements/Panel'
import {
  CustomFieldsField,
  DateField,
  Field,
  NoteField,
  TagsField,
  useFields
} from '@/components/elements/fields'
import { countryName } from '@/utils/countries'
import {
  docTypeOf,
  droppedKeys,
  specOf,
  TEMPLATES,
  type DocType,
  type Row
} from '../templates'
import DocTypeRow from './DocType'

// The template's rows cut into bands wherever the group changes — holder,
// document, extras. The order is the template's business, so this only has to
// watch for the change.
const bands = (rows: Row[]): Row[][] =>
  rows.reduce<Row[][]>((out, row) => {
    const open = out[out.length - 1]
    if (open && specOf(open[0].key).group === specOf(row.key).group) open.push(row)
    else out.push([row])
    return out
  }, [])

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

  // Reading, an empty field renders nothing at all — so a band with nothing in
  // it must not leave its gutter and an empty block behind.
  const rows = editing
    ? TEMPLATES[docType]
    : TEMPLATES[docType].filter(({ key }) => (entry[key] ?? '') !== '')

  const row = ({ key, required }: Row) => {
    const spec = specOf(key)
    if (spec.note)
      return <NoteField key={key} name={key} label={spec.label} required={required} />
    if (spec.date)
      return (
        <DateField
          key={key}
          name={key}
          label={spec.label}
          required={required}
          expiry={spec.expiry}
        />
      )
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
        suffix={spec.country ? countryName : undefined}
      />
    )
  }

  return (
    <>
      {/* Reading, the type is in the eyebrow (see Show/Read) — a line of its
          own here would only say it twice. */}
      {editing && (
        <div className="mb-3">
          <DocTypeRow value={docType} onChange={switchTo} />
        </div>
      )}
      <Panel>
        {bands(rows).map((band, index) => (
          <Fragment key={specOf(band[0].key).group}>
            {/* A gutter cut through the panel: the bands read apart without a
                heading over each of them. */}
            {index > 0 && <div className="h-2 bg-app" />}
            {/* Each band is its own row scope, so the hairline stops at the
                band's last row (ROW_HAIRLINE drops it on `last`). */}
            <div>{band.map(row)}</div>
          </Fragment>
        ))}
      </Panel>
      <CustomFieldsField />
      <TagsField />
    </>
  )
}
