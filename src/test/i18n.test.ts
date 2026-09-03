import { describe, it, expect } from 'vitest'
import enUS from '@/i18n/locales/en-US.json'

/*
 * Copy hygiene, English only.
 *
 * en-US is the key catalogue: `t()` falls back to the key itself, so a key
 * missing there still renders — it just renders untranslatable, invisible to
 * every other locale. This is the producer-side check for that.
 *
 * The translated locales are deliberately *not* required to be complete;
 * translating is its own task. But any key they do carry has to keep en-US's
 * placeholders, or the interpolation silently drops a value.
 *
 * Sources are read through `import.meta.glob` rather than node:fs so the suite
 * needs no Node types in the app's tsconfig.
 */

const sources = import.meta.glob<string>(
  ['../**/*.{ts,tsx}', '!../test/**', '!../**/*.d.ts'],
  {
    query: '?raw',
    import: 'default',
    eager: true
  }
)

const locales = import.meta.glob<Record<string, string>>('../i18n/locales/*.json', {
  import: 'default',
  eager: true
})

// `t('…')`, `t("…")` and `t(`…`)` without interpolation. Dynamic `t(variable)`
// sites are out of reach here and stay the reviewer's job.
const CALL = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$\\]*)`)\s*[,)]/g

// Every literal key, mapped to the first file that asks for it.
const literalKeys = (): Map<string, string> => {
  const found = new Map<string, string>()
  for (const [path, text] of Object.entries(sources))
    for (const match of text.matchAll(CALL)) {
      const key = (match[1] ?? match[2] ?? match[3]).replace(/\\(['"])/g, '$1')
      if (!found.has(key)) found.set(key, path)
    }
  return found
}

// `{{appName}}` is exempt: it is the app's name (a constant, see `@/lib/app`,
// supplied to every call through i18next's `defaultVariables`), not per-call
// data, so nothing is lost when a locale names the app where en-US does not —
// or says nothing about it where en-US does. Every other placeholder stands
// for a value the sentence needs, so it stays symmetric.
const placeholders = (value: string) =>
  [...value.replace(/\{\{appName\}\}/g, '').matchAll(/\{\{[^}]*\}\}/g)].map(m => m[0]).join()

const catalogue: Record<string, string> = enUS

// i18next resolves `t(key, { count })` against `${key}_zero|one|two|few|many|other`
// rather than the bare key, so a pluralized entry never appears under `key`
// itself in the catalogue.
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other']
const inCatalogue = (key: string) =>
  key in catalogue || PLURAL_SUFFIXES.some(suffix => `${key}${suffix}` in catalogue)

// A locale legitimately carries plural categories English does not have:
// English needs `_one`/`_other`, Russian and Polish need `_few` and `_many`
// too. Such a key is recognised by its base having a plural entry in en-US.
const PLURAL_SUFFIX = new RegExp(`(${PLURAL_SUFFIXES.join('|')})$`)
const knownKey = (key: string) => {
  if (key in catalogue) return true
  const base = key.replace(PLURAL_SUFFIX, '')
  return base !== key && PLURAL_SUFFIXES.some(suffix => `${base}${suffix}` in catalogue)
}

const translated = Object.entries(locales).filter(([path]) => !path.endsWith('en-US.json'))

describe('i18n', () => {
  it('has an en-US entry for every literal t() key in src/', () => {
    const missing = [...literalKeys()]
      .filter(([key]) => !inCatalogue(key))
      .map(([key, path]) => `${JSON.stringify(key)} (${path})`)

    expect(missing).toEqual([])
  })

  it('keeps en-US placeholders in every locale that carries the key', () => {
    // A plural form English does not have (`_few`, `_many`) is compared against
    // whichever form en-US does define — it needs the same placeholders.
    const counterpart = (key: string): string | undefined => {
      if (key in catalogue) return catalogue[key]
      const base = key.replace(PLURAL_SUFFIX, '')
      if (base === key) return undefined
      const match = PLURAL_SUFFIXES.map(s => `${base}${s}`).find(k => k in catalogue)
      return match && catalogue[match]
    }

    const mismatched = translated.flatMap(([path, locale]) =>
      Object.entries(locale)
        .filter(([key, value]) => {
          const source = counterpart(key)
          return source !== undefined && placeholders(source) !== placeholders(value)
        })
        .map(([key, value]) => `${path}: ${JSON.stringify(key)} -> ${JSON.stringify(value)}`)
    )

    expect(mismatched).toEqual([])
  })

  it('carries no keys en-US has dropped', () => {
    const orphans = translated.flatMap(([path, locale]) =>
      Object.keys(locale)
        .filter(key => !knownKey(key))
        .map(key => `${path}: ${JSON.stringify(key)}`)
    )

    expect(orphans).toEqual([])
  })
})
