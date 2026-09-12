import type { DocType } from '../templates'
import type { Doc } from './DocCell'

/**
 * The machine-readable zone, generated from what the document already says.
 *
 * ICAO 9303 defines two formats the documents in this vault use: TD3, the
 * passport's two lines of 44, and TD1, the three lines of 30 an ID card or a
 * residence permit carries. Both are the same fields laid out in fixed columns
 * with check digits over them, so the band is derived rather than stored —
 * nothing to fill in, and it stays true as the document is edited.
 *
 * A driving licence has no MRZ (it carries a barcode, which the face draws
 * instead) and `other` is not a format at all, so both get no band: `null`.
 *
 * The one liberty taken is the name. ICAO wants the primary identifier — the
 * surname — first, then `<<`, then the given names; the vault stores `name`
 * whole and deliberately, and guessing where to cut it is wrong for most of the
 * world. So the whole name goes in the name field, transliterated. A `surname`
 * row in `templates.ts` would make it exact.
 */

const FILLER = '<'

// ICAO's character values: digits are themselves, A–Z run 10–35, and the filler
// — along with anything that reached here unfolded — counts as zero.
const charValue = (ch: string): number => {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55
  return 0
}

const WEIGHTS = [7, 3, 1]

/** ICAO's check digit over one field: values against a repeating 7-3-1, mod 10. */
export const checkDigit = (field: string): string =>
  String([...field].reduce((sum, ch, i) => sum + charValue(ch) * WEIGHTS[i % 3], 0) % 10)

// The Latin subset the band is printed in. Decomposing first drops the accents
// onto their base letters, and everything the subset has no room for — spaces,
// hyphens, apostrophes — becomes the filler. Which is what a real document does
// to a name too: the band is the machine's reading of it, not the printed one.
const transliterate = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, FILLER)

// A field cut or padded to the width its column has.
const fit = (text: string, width: number): string =>
  transliterate(text).slice(0, width).padEnd(width, FILLER)

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// The band's six-digit date. A value that is not a stored date — half typed, or
// never filled in — prints as filler rather than as a wrong date.
const yymmdd = (iso: string): string => {
  const match = ISO_DATE.exec(iso.trim())
  return match ? `${match[1].slice(2)}${match[2]}${match[3]}` : FILLER.repeat(6)
}

// The band has one column for sex and three values for it.
const sexOf = (value: string): string => {
  const first = value.trim().toUpperCase()[0]
  return first === 'M' || first === 'F' ? first : FILLER
}

/*
 * A secret stays a secret in the band.
 *
 * The document number and the personal number are the two fields the vault
 * encrypts, and the face masks them until the eye is pressed — so their columns
 * here are overwritten too, and so is every check digit computed from them. A
 * check digit is a function of the field it covers: left standing it would hand
 * back a digit of what the mask is holding, and the composite digit at the end
 * of the line covers the document number along with everything else.
 */
const DOT = '•'

const blank = (line: string, from: number, to: number): string =>
  line.slice(0, from) + DOT.repeat(to - from) + line.slice(to)

// TD3 — the passport data page. Line 1 is the document code, the issuing state
// and the name; line 2 is every other field in fixed columns, each followed by
// its check digit, and a composite digit over the lot.
const td3 = (doc: Doc, state: string, nationality: string): string[] => {
  const number = fit(doc.value('number'), 9)
  const dob = yymmdd(doc.value('birth_date'))
  const expiry = yymmdd(doc.value('expiry_date'))
  const optional = fit(doc.value('personal_number'), 14)

  const fields =
    number +
    checkDigit(number) +
    nationality +
    dob +
    checkDigit(dob) +
    sexOf(doc.value('sex')) +
    expiry +
    checkDigit(expiry) +
    optional +
    checkDigit(optional)

  // The composite covers the number, the dates and the optional data with their
  // own check digits — but not the nationality or the sex between them.
  const composite = checkDigit(fields.slice(0, 10) + fields.slice(13, 20) + fields.slice(21, 43))
  const line = fields + composite

  return [
    `P${FILLER}${state}${fit(doc.value('name'), 39)}`,
    doc.shown ? line : blank(blank(line, 28, 44), 0, 10)
  ]
}

// TD1 — the ID-1 card. The same fields over three shorter lines: the number and
// the optional data on the first, the dates on the second, the name on the third.
const td1 = (doc: Doc, docType: DocType, state: string, nationality: string): string[] => {
  const number = fit(doc.value('number'), 9)
  const dob = yymmdd(doc.value('birth_date'))
  const expiry = yymmdd(doc.value('expiry_date'))

  const code = docType === 'residence_permit' ? 'IR' : `I${FILLER}`
  const first = code + state + number + checkDigit(number) + fit(doc.value('personal_number'), 15)
  const second =
    dob +
    checkDigit(dob) +
    sexOf(doc.value('sex')) +
    expiry +
    checkDigit(expiry) +
    nationality +
    FILLER.repeat(11)

  const composite = checkDigit(
    first.slice(5) + second.slice(0, 7) + second.slice(8, 15) + second.slice(18, 29)
  )
  const line2 = second + composite

  return doc.shown
    ? [first, line2, fit(doc.value('name'), 30)]
    : [blank(first, 5, 30), blank(line2, 29, 30), fit(doc.value('name'), 30)]
}

/** The band this document prints, or `null` where it has none to print. */
export const mrz = (docType: DocType, doc: Doc): string[] | null => {
  const state = fit(doc.value('country'), 3)
  // The band always names a nationality; a document that only says where it was
  // issued lends that, which is true of every document that omits the field.
  const nationality = fit(doc.value('nationality') || doc.value('country'), 3)

  if (docType === 'passport') return td3(doc, state, nationality)
  if (docType === 'id_card' || docType === 'residence_permit')
    return td1(doc, docType, state, nationality)
  return null
}
