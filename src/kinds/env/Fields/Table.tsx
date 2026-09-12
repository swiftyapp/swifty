import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddAction from '@/components/elements/AddAction'
import Panel from '@/components/elements/Panel'
import { useField } from '@/components/elements/fields'
import { requiredError } from '@/components/elements/fields/formats'
import {
  appendVar,
  appendVars,
  parseEnv,
  removeLine,
  setKey,
  setValue,
  varsOf,
  type EnvBand,
  type EnvVar
} from '../parse'
import Band from './Band'
import EditRow from './EditRow'
import Filter from './Filter'
import Row from './Row'
import { keyColumn } from './styles'

// Past this many variables the list is worth a filter, in both modes.
const FILTER_FROM = 6

/**
 * A row being added, before the file has it.
 *
 * `appendVar` with an empty key writes a bare `=`, which the parser keeps as an
 * unreadable `other` line — it would vanish from the table into the File tab
 * the moment the button was pressed. So a new row lives here, in component
 * state, until its key is an identifier; then it is written into the file at
 * the end of the band it was asked for, and this is cleared. Blank and left
 * (or removed, or the editor closed) it simply goes away, and nothing ever
 * reaches the file that the parser cannot read back.
 */
interface Pending {
  /**
   * The line to insert after — a band's last, which is also what places the
   * row under that band; undefined appends at the end of a file with no bands.
   */
  after: number | undefined
  key: string
  value: string
}

// The Variables face: bands cut from the file, each row a key and a value.
// Reading, a row is masked until its eye (or the panel's) is pressed and the
// value is a click-to-copy target; editing, the pair is two boxes and every
// keystroke rewrites just that line of the file.
interface Props {
  /** Parsed by `Fields` once per body; the table is a view over them. */
  vars: EnvVar[]
  bands: EnvBand[]
  revealAll: boolean
}

export default function Table({ vars, bands, revealAll }: Props) {
  const { t } = useTranslation()
  const { value: body, set, editing, attempted } = useField('body')

  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  // The row that should hold the caret on the next render: the one a pending
  // row just became, so typing carries straight on into it. Spent as soon as
  // it has been rendered, or a filter re-mounting that row later would pull
  // the caret back into it.
  const [focus, setFocus] = useState<number | null>(null)
  useEffect(() => {
    if (focus !== null) setFocus(null)
  }, [focus])

  const toggle = (index: number) =>
    setRevealed(prev => {
      const next = new Set(prev)
      if (!next.delete(index)) next.add(index)
      return next
    })

  // Every write to the file drops the row being added: its `after` is a line
  // index, and a removal above it would leave it pointing at the wrong line.
  const write = (next: string, focusAt: number | null = null) => {
    set(next)
    setFocus(focusAt)
    setPending(null)
  }

  // A masked filter sees keys only. Captions come from the secret body too, so
  // matching one while hiding it would still disclose it as a search oracle.
  // Editing and reveal-all make captions visible and therefore searchable.
  const filtering = vars.length > FILTER_FROM
  const needle = filtering ? query.trim().toLowerCase() : ''
  const matches = (text: string | null) => text !== null && text.toLowerCase().includes(needle)
  const captionsVisible = editing || revealAll
  // `last` is the band's whole last row, filtered or not: it is where a new row
  // goes and which row spends Enter on one. A band holding the row being added
  // stays on screen whatever the filter says, or the half-typed row would be
  // lost behind it.
  const shown = bands
    .map((band, index) => ({
      index,
      caption: band.caption,
      last: band.vars[band.vars.length - 1]?.index,
      vars:
        !needle || (captionsVisible && matches(band.caption))
          ? band.vars
          : band.vars.filter(v => matches(v.key))
    }))
    .filter(band => band.vars.length > 0 || pending?.after === band.last)

  // dotenv tolerates a duplicate (last wins), so this warns rather than blocks,
  // and on the later occurrence — the first is the one that was there. A key
  // whose first occurrence is some other line is a duplicate by construction.
  const firstOf = new Map<string, number>()
  for (const v of vars) if (!firstOf.has(v.key)) firstOf.set(v.key, v.index)
  const errorOf = (v: EnvVar) => (firstOf.get(v.key) !== v.index ? t('Duplicate key') : '')

  // One row at a time: a second press while one is being filled would throw
  // away what was typed, so it goes to the row already there.
  const start = (after: number | undefined) => {
    if (pending) return
    setPending({ after, key: '', value: '' })
  }

  // `EditRow` hands over identifiers only, so a key here is either '' or one.
  const update = (next: Pending) => {
    if (next.key === '') return setPending(next)
    const written = appendVar(body, next.key, next.value, next.after)
    // Appended at the end of the file, the new line is its last variable.
    const added = varsOf(parseEnv(written))
    write(written, next.after === undefined ? (added[added.length - 1]?.index ?? null) : next.after + 1)
  }

  // A pasted block goes in as rows, in order, after this one.
  const paste = (after: number | undefined, text: string) =>
    write(appendVars(body, varsOf(parseEnv(text)), after))

  const pendingRow = pending && (
    <EditRow
      name="new"
      row={pending}
      autoFocus
      onKey={key => update({ ...pending, key })}
      onValue={value => update({ ...pending, value })}
      onRemove={() => setPending(null)}
      onPaste={text => paste(pending.after, text)}
      onLeave={() => {
        if (pending.key === '' && pending.value === '') setPending(null)
      }}
    />
  )

  return (
    <>
      {filtering && <Filter value={query} onChange={setQuery} />}
      <Panel>
        <div style={keyColumn(vars)}>
          {needle && shown.length === 0 && (
            <div className="px-3.5 py-6 text-center text-base text-text3">
              {t('No variables match')}
            </div>
          )}

          {shown.map((band, i) => (
            <Fragment key={band.index}>
              {/* A gutter cut through the panel, as the identity kind does:
                  the bands read apart without a heading over each of them. */}
              {i > 0 && <div className="h-2 bg-app" />}
              <Band
                caption={captionsVisible ? band.caption : null}
                index={band.index}
                onAdd={editing ? () => start(band.last) : undefined}
              >
                {band.vars.map(v =>
                  editing ? (
                    <EditRow
                      key={v.index}
                      name={String(v.index)}
                      row={v}
                      error={errorOf(v)}
                      autoFocus={focus === v.index}
                      onKey={key => write(setKey(body, v.index, key))}
                      onValue={value => write(setValue(body, v.index, value))}
                      onRemove={() => write(removeLine(body, v.index))}
                      onAppend={v.index === band.last ? () => start(band.last) : undefined}
                      onPaste={text => paste(v.index, text)}
                    />
                  ) : (
                    <Row
                      key={v.index}
                      v={v}
                      revealed={revealAll || revealed.has(v.index)}
                      onReveal={() => toggle(v.index)}
                    />
                  )
                )}
                {pending?.after === band.last && pendingRow}
              </Band>
            </Fragment>
          ))}

          {/* No bands to add into, so one button for the whole file. */}
          {editing && bands.length === 0 && (
            <div>
              {pending?.after === undefined && pendingRow}
              <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="text-base text-bad">{requiredError(body, true, attempted)}</span>
                <AddAction
                  label={t('Add variable')}
                  testid="add-env-var-0"
                  onClick={() => start(undefined)}
                />
              </div>
            </div>
          )}
        </div>
      </Panel>
    </>
  )
}
