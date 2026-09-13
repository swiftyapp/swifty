/*
 * OpenSSH's "randomart": the picture `ssh-keygen -lv` draws for a key, so a
 * fingerprint can be recognised at a glance rather than read. The drunken
 * bishop (sshkey.c, fingerprint_randomart): a bishop starts at the centre of a
 * 17×9 board and takes one diagonal step per pair of hash bits, and each square
 * is drawn by how often it was visited.
 */

const WIDTH = 17
const HEIGHT = 9
// One glyph per visit count, then the start and end marks.
const GLYPHS = ' .o+=*BOX@%&#/^SE'
const START = GLYPHS.length - 2
const END = GLYPHS.length - 1

const decode = (base64: string): Uint8Array | null => {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
  } catch {
    return null
  }
}

// The bracketed title, made to fit the board the way ssh-keygen does: a
// "[type size]" too wide for it falls back to "[type]" — "[ED25519-CERT 256]"
// becomes "[ED25519-CERT]" — and a name too long even for that is cut to the
// board, which is all the border was ever going to say.
const fit = (title: string): string => {
  if (!title) return ''
  const full = `[${title}]`
  if (full.length <= WIDTH) return full
  const short = `[${title.split(' ')[0]}]`
  return short.length <= WIDTH ? short : short.slice(0, WIDTH)
}

// `+--[title]--+`: a title no wider than the board, centred on it.
const border = (title: string): string => {
  const lead = Math.floor((WIDTH - title.length) / 2)
  return `+${'-'.repeat(lead)}${title}${'-'.repeat(WIDTH - lead - title.length)}+`
}

/**
 * The eleven rows of a key's randomart, or null when the fingerprint is not
 * one this can draw: only `SHA256:<base64 of 32 bytes>`, the form ssh-keygen
 * reports and the generator stores. `title` is what goes in the top border —
 * "ED25519 256" — and may be empty.
 */
export const randomart = (fingerprint: string, title: string): string[] | null => {
  const [hash, digest] = fingerprint.split(':')
  if (hash !== 'SHA256' || digest === undefined) return null
  const bytes = decode(digest)
  if (!bytes || bytes.length !== 32) return null

  const field = Array.from({ length: HEIGHT }, () => new Array<number>(WIDTH).fill(0))
  let x = Math.floor(WIDTH / 2)
  let y = Math.floor(HEIGHT / 2)

  for (let byte of bytes) {
    for (let step = 0; step < 4; step++) {
      x = Math.min(Math.max(x + (byte & 1 ? 1 : -1), 0), WIDTH - 1)
      y = Math.min(Math.max(y + (byte & 2 ? 1 : -1), 0), HEIGHT - 1)
      if (field[y][x] < START - 1) field[y][x]++
      byte >>= 2
    }
  }

  field[Math.floor(HEIGHT / 2)][Math.floor(WIDTH / 2)] = START
  field[y][x] = END

  return [
    border(fit(title)),
    ...field.map(row => `|${row.map(count => GLYPHS[count]).join('')}|`),
    border(`[${hash}]`)
  ]
}
