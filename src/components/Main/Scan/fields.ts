import type { EntryDraft } from '@/defaults/entries'

/**
 * Turning what a scan read into what a draft holds.
 *
 * The backend already speaks the draft's language — its field keys are the
 * kind's keys, its dates are ISO, its expiry month and year are two digits, and
 * the names it reads off a card or an MRZ are uppercase because that is how
 * they are printed. So there is no reformatting here: only which values are
 * worth carrying, and which of the draft's own values may be overwritten.
 */

// What the OS recognizers can open, and what the file dialog filters to.
// Anything else dropped on the window is somebody else's business — the Import
// drop zone still wants its .csv.
export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'heic',
  'heif',
  'webp',
  'tiff',
  'tif',
  'bmp',
  'gif'
]

export const isImagePath = (path: string): boolean => {
  const extension = /\.([^.\\/]+)$/.exec(path)?.[1]
  return !!extension && IMAGE_EXTENSIONS.includes(extension.toLowerCase())
}

/** The first image among dropped paths — a drop can carry more than one file. */
export const firstImage = (paths: string[]): string | undefined =>
  paths.find(isImagePath)

// A field the user has not answered yet. A missing key counts (a card draft has
// no `doc_type`), and so does whitespace — it is nothing typed, not an answer.
const blank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/**
 * Drop the fields the recognizer could not fill. An MRZ hands back its whole
 * field set, empty entries and all (an optional personal number is often
 * filler), and an empty string is not something to overwrite a draft with.
 */
export const cleanFields = (fields: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => !blank(value)))

/**
 * Fold scanned fields into a draft.
 *
 * What the user has already typed wins: a scan fills the blanks, it does not
 * correct anybody. `doc_type` is the exception — it is not typed but chosen
 * from a default (`passport`), and it decides which rows the form even shows,
 * so a document that says what it is always gets to say so.
 */
export const mergeFields = (
  draft: EntryDraft,
  fields: Record<string, string>
): EntryDraft => {
  const next = { ...draft }
  for (const [key, value] of Object.entries(fields))
    if (key === 'doc_type' || blank(next[key])) next[key] = value
  return next
}
