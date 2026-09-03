import { generatePassword, type GeneratorOptions } from '@/lib/commands'
import { getProps, setProps } from '@/defaults/generator'
import WORDS from './wordlist'

/*
 * Generator model behind the ⌘G dialog.
 *
 * Random passwords are produced by the existing `generate_password` Rust
 * command — one audited CSPRNG engine for the whole app, already covered by
 * its own unit tests. This module owns the parts that only exist on the
 * frontend: the settings shape the dialog binds to, the charset arithmetic the
 * entropy readout needs, and the "memorable" mode (words), which the Rust
 * command does not implement.
 */

export type GeneratorMode = 'random' | 'memorable'

export interface GeneratorSettings {
  mode: GeneratorMode
  // Characters, `random` mode.
  length: number
  // Words, `memorable` mode.
  words: number
  symbols: boolean
  numbers: boolean
  excludeSimilar: boolean
  capitalize: boolean
}

export const LENGTH_RANGE = { min: 8, max: 48 }
export const WORDS_RANGE = { min: 3, max: 8 }

// Mirrors the pools in src-tauri/src/commands/generator.rs — kept here so the
// entropy readout reports the charset the engine actually draws from.
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()+_-=}{[]|:;"/?.><,`~'
const SIMILAR = 'il1Lo0O'

// Memorable passwords end in a two-digit group, as in `quartz-lantern-drift-06`.
const SUFFIX = 100

// Bit thresholds for the five-segment meter: very weak · weak · fair · strong ·
// excellent. 128 bits (a 20-character full-charset password) fills the bar.
const THRESHOLDS = [28, 36, 60, 128]

export const ENTROPY_LABELS = ['very weak', 'weak', 'fair', 'strong', 'excellent']

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, value))

// Uniform index in [0, bound) from the CSPRNG, rejecting the tail of the 2^32
// range that would otherwise bias the modulo.
const randomIndex = (bound: number): number => {
  const limit = Math.floor(0x100000000 / bound) * bound
  const buffer = new Uint32Array(1)
  let draw: number
  do {
    crypto.getRandomValues(buffer)
    draw = buffer[0]
  } while (draw >= limit)
  return draw % bound
}

// Seeded from the shared generator defaults so the Settings page's preferences
// carry into the dialog.
export const defaultSettings = (): GeneratorSettings => {
  const stored = getProps()
  return {
    mode: 'random',
    length: clamp(stored.length, LENGTH_RANGE),
    words: 5,
    symbols: stored.symbols,
    numbers: stored.numbers,
    excludeSimilar: stored.excludeSimilarCharacters ?? false,
    capitalize: false
  }
}

// The dialog always keeps both letter cases and asks for `strict`, so toggling
// Symbols or Numbers on guarantees the class shows up in the result.
// Write the shared knobs back so the dialog and Settings › Security agree.
// Everything else in the stored props (uppercase, exclude) is left untouched.
export const persistDefaults = (settings: GeneratorSettings) =>
  setProps({
    ...getProps(),
    length: settings.length,
    symbols: settings.symbols,
    numbers: settings.numbers,
    excludeSimilarCharacters: settings.excludeSimilar
  })

export const toOptions = (settings: GeneratorSettings): GeneratorOptions => ({
  length: settings.length,
  numbers: settings.numbers,
  symbols: settings.symbols,
  uppercase: true,
  lowercase: true,
  excludeSimilarCharacters: settings.excludeSimilar,
  strict: true
})

export const charset = (settings: GeneratorSettings): string => {
  const keep = (pool: string) =>
    settings.excludeSimilar
      ? [...pool].filter(char => !SIMILAR.includes(char)).join('')
      : pool
  return (
    keep(LOWER) +
    keep(UPPER) +
    (settings.numbers ? keep(DIGITS) : '') +
    (settings.symbols ? keep(SYMBOLS) : '')
  )
}

export const memorable = (settings: GeneratorSettings): string => {
  const parts = Array.from({ length: settings.words }, () => {
    const word = WORDS[randomIndex(WORDS.length)]
    return settings.capitalize ? word[0].toUpperCase() + word.slice(1) : word
  })
  if (settings.numbers) parts.push(String(randomIndex(SUFFIX)).padStart(2, '0'))
  return parts.join('-')
}

export const generate = (settings: GeneratorSettings): Promise<string> =>
  settings.mode === 'memorable'
    ? Promise.resolve(memorable(settings))
    : generatePassword(toOptions(settings))

export const entropy = (settings: GeneratorSettings) => {
  const raw =
    settings.mode === 'memorable'
      ? settings.words * Math.log2(WORDS.length) +
        (settings.numbers ? Math.log2(SUFFIX) : 0)
      : settings.length * Math.log2(charset(settings).length)
  const bits = Math.round(raw)
  return { bits, level: THRESHOLDS.filter(threshold => bits >= threshold).length }
}
