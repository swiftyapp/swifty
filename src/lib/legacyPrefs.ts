import { appStatus, DATE_FORMATS, setSettings, type AppStatus, type Settings } from '@/api/app'
import { LANGUAGES } from '@/i18n'

/**
 * One-shot import of the preferences the webview used to keep in localStorage,
 * before Rust owned `settings.json`.
 *
 * Runs at boot, once: the keys are removed after a successful write, so a
 * second launch finds nothing and does nothing. A failed write leaves them in
 * place to be retried next time. Every value is validated the way the old
 * getter did, so a junk key is skipped rather than written into the file.
 *
 * Three generations of keys, newest winning:
 * - `rowel:prefs`, one JSON blob in zustand's `persist` shape (`{ state }`),
 *   from the builds just before this one;
 * - `rowel:<name>` per-key values from the builds after the rebrand;
 * - `swifty:<name>` per-key values from before it.
 * `theme` and `locale` were never prefixed.
 */

const BLOB = 'rowel:prefs'
const PREFIXES = ['rowel:', 'swifty:']
const PREFIXED = [
  'autolockSecs',
  'clipboardTimeout',
  'dateFormat',
  'generatorDefaults',
  'breachCheck',
  'listSort'
]
const BARE = ['theme', 'locale']

const storage = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    // A locked-down webview can throw on access; there is nothing to import.
    return null
  }
}

const read = (store: Storage, name: string): string | null => {
  for (const prefix of PREFIXES) {
    const value = store.getItem(prefix + name)
    if (value !== null) return value
  }
  return null
}

const number = (raw: unknown, ok: (n: number) => boolean): number | undefined => {
  const value = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(value) && ok(value) ? value : undefined
}

const oneOf = <T extends string>(raw: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(raw as T) ? (raw as T) : undefined

const parse = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The per-key generation, as the raw values it stored. */
const perKey = (store: Storage): Record<string, unknown> => ({
  autolockSecs: read(store, 'autolockSecs'),
  clipboardTimeoutMs: read(store, 'clipboardTimeout'),
  dateFormat: read(store, 'dateFormat'),
  sort: read(store, 'listSort'),
  breachCheck: read(store, 'breachCheck') === 'true' ? true : read(store, 'breachCheck'),
  theme: store.getItem('theme'),
  locale: store.getItem('locale'),
  generator: parse(read(store, 'generatorDefaults'))
})

type Generator = Settings['generator']

/**
 * The stored generator knobs that are the right type, laid over the current
 * group; undefined when nothing usable was stored. A wrong-typed field falls
 * back to the current value rather than poisoning the patch.
 */
const legacyGenerator = (raw: unknown, current: Generator): Generator | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const stored = raw as Record<string, unknown>
  const merged: Generator = { ...current }
  let kept = false
  const take = <K extends keyof Generator>(key: K, ok: (v: unknown) => v is Generator[K]) => {
    if (ok(stored[key])) {
      merged[key] = stored[key]
      kept = true
    }
  }
  take('length', (v): v is number => typeof v === 'number' && Number.isFinite(v))
  for (const key of ['numbers', 'symbols', 'uppercase', 'excludeSimilarCharacters'] as const)
    take(key, (v): v is boolean => typeof v === 'boolean')
  take('exclude', (v): v is string => typeof v === 'string')
  return kept ? merged : undefined
}

/** What the old keys say, as a patch — or null when there is nothing to carry over. */
export const legacyPatch = (current: Settings): Partial<Settings> | null => {
  const store = storage()
  if (!store) return null

  // The blob is the newest generation, so its fields win over the per-key ones.
  const blob = parse(store.getItem(BLOB))?.state
  const raw: Record<string, unknown> = {
    ...perKey(store),
    ...Object.fromEntries(
      Object.entries((blob as Record<string, unknown> | undefined) ?? {}).filter(
        ([, value]) => value !== null && value !== undefined
      )
    )
  }

  const patch: Partial<Settings> = {}
  const autolock = number(raw.autolockSecs, n => n > 0)
  if (autolock !== undefined) patch.autolockSecs = autolock
  const clipboard = number(raw.clipboardTimeoutMs, n => n >= 0)
  if (clipboard !== undefined) patch.clipboardTimeoutMs = clipboard
  const dateFormat = oneOf(raw.dateFormat, DATE_FORMATS)
  if (dateFormat) patch.dateFormat = dateFormat
  const sort = oneOf(raw.sort, ['recent', 'alpha'] as const)
  if (sort) patch.sort = sort
  if (raw.breachCheck === true) patch.breachCheck = true
  const theme = oneOf(raw.theme, ['light', 'dark', 'system'] as const)
  if (theme) patch.theme = theme
  const locale = oneOf(raw.locale, Object.keys(LANGUAGES))
  if (locale) patch.locale = locale

  // Rust replaces the group whole, so the stored knobs are laid over the
  // current group rather than sent alone — and field by field, because the
  // old storage never checked types: one `"numbers": "yes"` would otherwise
  // fail Rust's typed decode and take every other preference down with it.
  const generator = legacyGenerator(raw.generator, current.generator)
  if (generator) patch.generator = generator

  return Object.keys(patch).length > 0 ? patch : null
}

export const clearLegacyPrefs = (): void => {
  const store = storage()
  if (!store) return
  store.removeItem(BLOB)
  for (const name of PREFIXED) for (const prefix of PREFIXES) store.removeItem(prefix + name)
  for (const name of BARE) store.removeItem(name)
}

/**
 * Carry the old keys into `settings.json` and hand back the status to boot
 * with. After a write the probe is asked again rather than the answer patched
 * here: `status.locale` is Rust's narrowing of the stored choice to a catalogue
 * the app ships, and only Rust can say what the new choice resolves to. Without
 * anything to import — or when the write failed — `status` comes back as it was.
 */
export const adoptLegacyPrefs = (status: AppStatus): Promise<AppStatus> => {
  const patch = legacyPatch(status.settings)
  if (!patch) return Promise.resolve(status)
  return setSettings(patch)
    .then(() => {
      clearLegacyPrefs()
      return appStatus()
    })
    .catch(() => status)
}
