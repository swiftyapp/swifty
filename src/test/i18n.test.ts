import { describe, it, expect } from 'vitest'
import enUS from '@/i18n/locales/en-US.json'

/*
 * Copy hygiene, English only.
 *
 * en-US is the key catalogue: `t()` falls back to the key itself, so a key
 * missing there still renders — it just renders untranslatable, invisible to
 * every other locale. This is the producer-side check for that.
 *
 * The translated locales are expected to be complete. The gate below is looser
 * than that on purpose: it fails only when a key has *no* translation in any of
 * the nine, so a PR that adds a key and translates it into some of them can
 * still land. Tightening it to per-locale parity is a one-line change — drop
 * the `every` in favour of a per-locale filter. The per-run coverage line says
 * how far each locale has drifted meanwhile.
 *
 * Any key a locale does carry has to keep en-US's placeholders, or the
 * interpolation silently drops a value.
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

// The unit a key belongs to: a plural set collapses to its base, so en-US's
// `X_one`/`X_other` is one unit `X` that a locale covers by carrying any
// `X_<suffix>` form — Polish `X_few` and zh-CN's lone `X_other` both count.
const unit = (key: string) => key.replace(PLURAL_SUFFIX, '')

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

  it('has a translation for every en-US key in at least one locale', () => {
    const units = [...new Set(Object.keys(catalogue).map(unit))]
    const carried = translated.map(([path, locale]) => ({
      name: path.slice(path.lastIndexOf('/') + 1).replace('.json', ''),
      units: new Set(Object.keys(locale).map(unit))
    }))

    const percent = (locale: (typeof carried)[number]) =>
      Math.round((units.filter(key => locale.units.has(key)).length / units.length) * 100)

    const coverage =
      `i18n coverage of ${units.length} en-US keys — ` +
      carried.map(locale => `${locale.name} ${percent(locale)}%`).join(', ')
    console.info(coverage)

    const untranslated = units.filter(key => carried.every(locale => !locale.units.has(key)))

    expect(untranslated, coverage).toEqual([])
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
