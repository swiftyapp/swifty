import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Panel from '@/components/elements/Panel'
import { useField } from '@/components/elements/fields'
import { requiredError } from '@/components/elements/fields/formats'
import {
  appendVar,
  bandsOf,
  duplicateKeys,
  isValidKey,
  parseEnv,
  removeLine,
  setKey,
  setValue,
  varsOf,
  type EnvVar
} from '../parse'
import Band, { AddVariable } from './Band'
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
  band: number
  /** The line to insert after; undefined appends at the end of the file. */
  after: number | undefined
  key: string
  value: string
}

// The Variables face: bands cut from the file, each row a key and a value.
// Reading, a row is masked until its eye (or the panel's) is pressed and the
// value is a click-to-copy target; editing, the pair is two boxes and every
// keystroke rewrites just that line of the file.
export default function Table({ revealAll }: { revealAll: boolean }) {
  const { t } = useTranslation()
  const { value: body, set, editing, attempted } = useField('body')
  const lines = parseEnv(body)
  const vars = varsOf(lines)
  const bands = bandsOf(lines)
  const dupes = duplicateKeys(vars)

  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  // The row that should hold the caret after the next render: the one a
  // pending row just became, so typing carries straight on into it.
  const [focus, setFocus] = useState<number | null>(null)

  const toggle = (index: number) =>
    setRevealed(prev => {
      const next = new Set(prev)
      if (!next.delete(index)) next.add(index)
      return next
    })

  const write = (next: string) => {
    set(next)
    setFocus(null)
  }

  // Keys and captions only. Values are masked, and a filter that matched them
  // would let anyone narrow a secret down by typing prefixes at it.
  const filtering = vars.length > FILTER_FROM
  const needle = filtering ? query.trim().toLowerCase() : ''
  const matches = (text: string | null) => text !== null && text.toLowerCase().includes(needle)
  const shown = bands
    .map((band, index) => ({
      index,
      caption: band.caption,
      vars: !needle || matches(band.caption) ? band.vars : band.vars.filter(v => matches(v.key))
    }))
    .filter(band => band.vars.length > 0)

  // dotenv tolerates a duplicate (last wins), so this warns rather than blocks,
  // and on the later occurrence — the first is the one that was there.
  const firstOf = new Map<string, number>()
  for (const v of vars) if (!firstOf.has(v.key)) firstOf.set(v.key, v.index)
  const errorOf = (v: EnvVar) =>
    dupes.has(v.key) && firstOf.get(v.key) !== v.index ? t('Duplicate key') : ''

  const start = (band: number, after: number | undefined) =>
    setPending({ band, after, key: '', value: '' })

  const update = (next: Pending) => {
    if (!isValidKey(next.key)) return setPending(next)
    const written = appendVar(body, next.key, next.value, next.after)
    write(written)
    setPending(null)
    // Appended at the end of the file, the new line is its last variable.
    const added = varsOf(parseEnv(written))
    setFocus(next.after === undefined ? (added[added.length - 1]?.index ?? null) : next.after + 1)
  }

  // A pasted block goes in as rows, in order, each after the one before it.
  const paste = (after: number | undefined, text: string) => {
    const pasted = varsOf(parseEnv(text))
    write(
      pasted.reduce(
        (acc, v, i) => appendVar(acc, v.key, v.value, after === undefined ? undefined : after + i),
        body
      )
    )
    setPending(null)
  }

  const pendingError = pending
    ? pending.key === ''
      ? requiredError('', true, attempted)
      : t('Not a valid name')
    : ''

  const pendingRow = pending && (
    <EditRow
      name="new"
      row={pending}
      error={pendingError}
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

          {shown.map((band, i) => {
            const rows = bands[band.index].vars
            const last = rows[rows.length - 1]?.index
            return (
              <Fragment key={band.index}>
                {/* A gutter cut through the panel, as the identity kind does:
                    the bands read apart without a heading over each of them. */}
                {i > 0 && <div className="h-2 bg-app" />}
                <Band
                  caption={band.caption}
                  index={band.index}
                  onAdd={editing ? () => start(band.index, last) : undefined}
                  pending={pending?.band === band.index ? pendingRow : null}
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
                        onAppend={v.index === last ? () => start(band.index, last) : undefined}
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
                </Band>
              </Fragment>
            )
          })}

          {/* No bands to add into, so one button for the whole file. */}
          {editing && bands.length === 0 && (
            <div>
              {pendingRow}
              <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="text-base text-bad">{requiredError(body, true, attempted)}</span>
                <AddVariable testid="add-env-var-0" onClick={() => start(0, undefined)} />
              </div>
            </div>
          )}
        </div>
      </Panel>
    </>
  )
}
