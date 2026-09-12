/**
 * The `.env` file, read and rewritten line by line.
 *
 * The file text is the entry's canonical secret; everything here is a view over
 * it or a minimal edit to it. Nothing normalises: comments, blank lines,
 * `export` prefixes, quoting, CRLF, a BOM and `${VAR}` references all come back
 * out exactly as they went in, and a line that cannot be read is kept verbatim.
 *
 * `index` everywhere is a position in the array `parseEnv` returns — a logical
 * line, since a quoted value may span several physical ones.
 */

export type Quote = '' | '"' | "'"

export type EnvLine =
  | {
      kind: 'var'
      key: string
      /** Unquoted, unescaped — what the row shows and the clipboard gets. */
      value: string
      /** Carried an `export ` prefix. */
      exported: boolean
      quote: Quote
      /** A trailing `# …` on the same line, without the `#`. */
      comment?: string
      /** The physical text, newlines included for a multi-line value. */
      raw: string
    }
  | { kind: 'comment'; text: string; raw: string }
  | { kind: 'blank'; raw: string }
  | { kind: 'other'; raw: string }

export interface EnvVar {
  index: number
  key: string
  value: string
  comment?: string
}

/** A run of variables under the comment(s) that precede it, or under none. */
export interface EnvBand {
  caption: string | null
  vars: EnvVar[]
}

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

// Everything up to and including the `=` and the whitespace around it. A BOM
// is allowed so the first line of a BOM-prefixed file still reads as a var;
// `\s` is avoided so a CRLF's `\r` never gets swallowed into the head.
const HEAD = /^(\uFEFF?[ \t]*(?:export[ \t]+)?)([A-Za-z_][A-Za-z0-9_]*)([ \t]*=[ \t]*)/

/**
 * A var line cut into the pieces an edit swaps out. Concatenated in order they
 * give back `raw` exactly, which is what lets `setValue` and `setKey` touch one
 * span and leave the rest of the line byte-identical.
 */
interface VarSpans {
  head: string
  key: string
  eq: string
  /** Quotes included when the value is quoted. */
  valueText: string
  /** Trailing whitespace, comment and `\r`. */
  tail: string
  line: Extract<EnvLine, { kind: 'var' }>
}

/** The text after `#`, dropping the single space people put after it. */
const commentText = (hash: string): string => hash.slice(1).replace(/^ /, '')

// `\n`, `\"` and `\\` are the escapes dotenv understands in double quotes; any
// other backslash sequence is kept literally so we do not invent meaning.
const decodeDouble = (inner: string): string =>
  inner
    .replace(/\r\n/g, '\n')
    .replace(/\\([\s\S])/g, (_, c: string) =>
      c === 'n' ? '\n' : c === '"' || c === '\\' ? c : `\\${c}`
    )

const encodeDouble = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`

/** The index of the closing unescaped `"`, or -1. */
const closingDouble = (text: string, open: number): number => {
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === '"') return i
  }
  return -1
}

/** Whether `text` (already past the closing quote) is only spacing and a comment. */
const TRAILER = /^([ \t]*)(#.*)?$/

/**
 * Read one logical raw line as a variable. Null when it is not one — the caller
 * then keeps it as `other`.
 */
const readVar = (raw: string): VarSpans | null => {
  const cr = raw.endsWith('\r') ? '\r' : ''
  const core = raw.slice(0, raw.length - cr.length)
  const m = HEAD.exec(core)
  if (!m) return null
  const [, head, key, eq] = m
  const rest = core.slice(m[0].length)
  const exported = /export[ \t]+$/.test(head)

  let valueText: string
  let value: string
  let quote: Quote
  let after: string

  if (rest.startsWith('"')) {
    const close = closingDouble(rest, 0)
    if (close === -1) return null
    valueText = rest.slice(0, close + 1)
    value = decodeDouble(rest.slice(1, close))
    quote = '"'
    after = rest.slice(close + 1)
  } else if (rest.startsWith("'")) {
    const close = rest.indexOf("'", 1)
    if (close === -1) return null
    valueText = rest.slice(0, close + 1)
    value = rest.slice(1, close)
    quote = "'"
    after = rest.slice(close + 1)
  } else {
    if (rest.includes('\n')) return null
    // A `#` opens a comment only at the very start of the value or after
    // whitespace; `a#b` is a value.
    const hash = rest.search(/(^|[ \t])#/)
    const body = hash === -1 ? rest : rest.slice(0, hash)
    valueText = body.trimEnd()
    value = valueText
    quote = ''
    after = rest.slice(valueText.length)
  }

  const t = TRAILER.exec(after)
  if (!t) return null
  const line: VarSpans['line'] = { kind: 'var', key, value, exported, quote, raw }
  if (t[2] !== undefined) line.comment = commentText(t[2])
  return { head, key, eq, valueText, tail: after + cr, line }
}

/** Classify one physical line that is not a var. */
const readOther = (physical: string, first: boolean): EnvLine => {
  let text = physical.endsWith('\r') ? physical.slice(0, -1) : physical
  if (first) text = text.replace(/^\uFEFF/, '')
  const trimmed = text.trimStart()
  if (trimmed === '') return { kind: 'blank', raw: physical }
  if (trimmed.startsWith('#')) return { kind: 'comment', text: commentText(trimmed), raw: physical }
  return { kind: 'other', raw: physical }
}

export const parseEnv = (body: string): EnvLine[] => {
  const lines: EnvLine[] = []
  let pos = 0
  // Walk by offset rather than `split('\n')` so a double-quoted value can pull
  // in following physical lines without re-joining the whole file each time.
  for (;;) {
    const nl = body.indexOf('\n', pos)
    let end = nl === -1 ? body.length : nl
    const physical = body.slice(pos, end)
    const m = HEAD.exec(physical)
    let raw = physical
    if (m && physical[m[0].length] === '"') {
      const close = closingDouble(body, pos + m[0].length)
      if (close !== -1) {
        const closeNl = body.indexOf('\n', close)
        const closeEnd = closeNl === -1 ? body.length : closeNl
        raw = body.slice(pos, closeEnd)
      }
    }
    const spans = m ? readVar(raw) : null
    if (spans) {
      lines.push(spans.line)
      end = pos + raw.length
    } else {
      lines.push(readOther(physical, pos === 0))
    }
    if (end >= body.length) break
    // Stepping past a final `\n` lands on an empty physical line, which is
    // kept as a blank — the same final `''` that `split('\n')` would give, and
    // what keeps the trailing newline on the way back out.
    pos = end + 1
  }
  return lines
}

/** `lines.map(raw).join('\n')` — byte-identical to the body that was parsed. */
export const serializeEnv = (lines: EnvLine[]): string => lines.map((l) => l.raw).join('\n')

const toVar = (line: Extract<EnvLine, { kind: 'var' }>, index: number): EnvVar => {
  const v: EnvVar = { index, key: line.key, value: line.value }
  if (line.comment !== undefined) v.comment = line.comment
  return v
}

export const varsOf = (lines: EnvLine[]): EnvVar[] => {
  const vars: EnvVar[] = []
  lines.forEach((line, index) => {
    if (line.kind === 'var') vars.push(toVar(line, index))
  })
  return vars
}

/**
 * Cut at blank lines; a band's caption is the comment block directly above its
 * first variable (multiple comment lines joined with a space), or null.
 */
export const bandsOf = (lines: EnvLine[]): EnvBand[] => {
  const bands: EnvBand[] = []
  let vars: EnvVar[] = []
  let caption: string | null = null
  let pending: string[] = []
  const flush = () => {
    if (vars.length) bands.push({ caption, vars })
    vars = []
    caption = null
    pending = []
  }
  lines.forEach((line, index) => {
    switch (line.kind) {
      case 'blank':
        flush()
        break
      case 'comment':
        // Comments after the first var are notes inside the band, not caption.
        if (vars.length === 0) pending.push(line.text)
        break
      case 'var':
        if (vars.length === 0) caption = pending.length ? pending.join(' ') : null
        vars.push(toVar(line, index))
        break
      case 'other':
        // An unreadable line between a comment and a var breaks the "directly
        // above" contiguity but not the band itself.
        if (vars.length === 0) pending = []
        break
    }
  })
  flush()
  return bands
}

// A bare value cannot start a comment, span lines, carry edge whitespace the
// parser would trim, or open with a quote the parser would try to close.
const needsQuotes = (value: string): boolean => /[\n\r#]|^\s|\s$|^["']|["']$/.test(value)

/** The quote style to write `value` in, keeping `current` whenever it can hold it. */
const quoteFor = (current: Quote, value: string): Quote => {
  if (current === '"') return '"'
  if (current === "'") return value.includes("'") || value.includes('\n') ? '"' : "'"
  return needsQuotes(value) ? '"' : ''
}

const encode = (value: string, quote: Quote): string =>
  quote === '"' ? encodeDouble(value) : quote === "'" ? `'${value}'` : value

/**
 * One edit to the file: parse once, let `fn` rework the raw lines in place,
 * join them back (`serializeEnv`'s rule). Every line-level edit below is a
 * splice or a swap on that array, so this is the only place the body is parsed
 * and re-joined on the way to a write.
 */
const edit = (body: string, fn: (raws: string[], lines: EnvLine[]) => void): string => {
  const lines = parseEnv(body)
  const raws = lines.map((l) => l.raw)
  fn(raws, lines)
  return raws.join('\n')
}

/** The var at `index`, split into spans, or null when the line is not a var. */
const spansOf = (line: EnvLine | undefined): VarSpans | null =>
  line?.kind === 'var' ? readVar(line.raw) : null

/** Rewrite one line's value, keeping its quote style unless the value needs one. */
export const setValue = (body: string, index: number, value: string): string =>
  edit(body, (raws, lines) => {
    const s = spansOf(lines[index])
    if (!s) return
    const valueText = encode(value, quoteFor(s.line.quote, value))
    // `KEY= #c` parses with an empty value and the `#` right after the `=`;
    // writing a value there needs a space back or the comment joins the value.
    const gap = valueText && s.tail.startsWith('#') ? ' ' : ''
    raws[index] = s.head + s.key + s.eq + valueText + gap + s.tail
  })

export const setKey = (body: string, index: number, key: string): string =>
  edit(body, (raws, lines) => {
    const s = spansOf(lines[index])
    if (!s || !isValidKey(key)) return
    raws[index] = s.head + key + s.eq + s.valueText + s.tail
  })

export const removeLine = (body: string, index: number): string =>
  edit(body, (raws) => {
    if (index < 0 || index >= raws.length) return
    // Dropping the element drops one `\n` from the join with it — the one after
    // the line, or the one before it when it was last.
    const [gone] = raws.splice(index, 1)
    // The BOM rides on the first line's raw; removing that line must not take
    // the file's byte order mark with it.
    if (index === 0 && gone.startsWith('\uFEFF') && raws.length > 0) raws[0] = `\uFEFF${raws[0]}`
  })

/** The line ending the file uses, judged by its first one. */
const eolOf = (body: string): string => {
  const nl = body.indexOf('\n')
  return nl > 0 && body[nl - 1] === '\r' ? '\r\n' : '\n'
}

/**
 * Insert `KEY=value` lines, in order, after line `afterIndex`, or at the end of
 * the file when omitted. A file with no trailing newline gets one before the
 * appended lines. One parse for the whole block: a pasted file of thousands of
 * lines is one splice, not one re-parse per line.
 */
export const appendVars = (
  body: string,
  vars: readonly { key: string; value: string }[],
  afterIndex?: number
): string => {
  if (vars.length === 0) return body
  const eol = eolOf(body)
  const texts = vars.map(
    ({ key, value }) => `${key}=${needsQuotes(value) ? encodeDouble(value) : value}`
  )
  if (afterIndex !== undefined && afterIndex >= 0) {
    const spliced = edit(body, (raws) => {
      if (afterIndex < raws.length)
        raws.splice(afterIndex + 1, 0, ...texts.map((t) => (eol === '\r\n' ? `${t}\r` : t)))
    })
    // Out of range, nothing was spliced and the round-trip is byte-identical,
    // so the rows are appended at the end as they always have been.
    if (spliced !== body) return spliced
  }
  const block = texts.join(eol) + eol
  if (body === '') return block
  return body + (body.endsWith('\n') ? '' : eol) + block
}

/** One `KEY=value` line; see `appendVars`. */
export const appendVar = (body: string, key: string, value: string, afterIndex?: number): string =>
  appendVars(body, [{ key, value }], afterIndex)

/** `[A-Za-z_][A-Za-z0-9_]*` */
export const isValidKey = (key: string): boolean => KEY.test(key)

/**
 * Whether pasted text is a block of variables rather than one value: more than
 * one line, and at least one of them parses as a `var`.
 */
export const looksLikeEnv = (text: string): boolean =>
  text.trim().includes('\n') && parseEnv(text).some((l) => l.kind === 'var')
