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

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true
})

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

const placeholders = (value: string) => [...value.matchAll(/\{[^}]*\}/g)].map(m => m[0]).join()

const catalogue: Record<string, string> = enUS

const translated = Object.entries(locales).filter(([path]) => !path.endsWith('en-US.json'))

describe('i18n', () => {
  it('has an en-US entry for every literal t() key in src/', () => {
    const missing = [...literalKeys()]
      .filter(([key]) => !(key in catalogue))
      .map(([key, path]) => `${JSON.stringify(key)} (${path})`)

    expect(missing).toEqual([])
  })

  it('keeps en-US placeholders in every locale that carries the key', () => {
    const mismatched = translated.flatMap(([path, locale]) =>
      Object.entries(locale)
        .filter(
          ([key, value]) =>
            key in catalogue && placeholders(catalogue[key]) !== placeholders(value)
        )
        .map(([key, value]) => `${path}: ${JSON.stringify(key)} -> ${JSON.stringify(value)}`)
    )

    expect(mismatched).toEqual([])
  })

  it('carries no keys en-US has dropped', () => {
    const orphans = translated.flatMap(([path, locale]) =>
      Object.keys(locale)
        .filter(key => !(key in catalogue))
        .map(key => `${path}: ${JSON.stringify(key)}`)
    )

    expect(orphans).toEqual([])
  })
})
