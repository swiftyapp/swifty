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
 * Two prefixes because the rebrand renamed them: `swifty:` is what a build
 * before it wrote, `rowel:` what a build after it wrote. The newer one wins.
 * `theme` and `locale` were never prefixed.
 */

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

const number = (raw: string | null, ok: (n: number) => boolean): number | undefined => {
  const value = raw === null ? NaN : Number(raw)
  return Number.isFinite(value) && ok(value) ? value : undefined
}

const oneOf = <T extends string>(raw: string | null, allowed: readonly T[]): T | undefined =>
  allowed.includes(raw as T) ? (raw as T) : undefined

/** What the old keys say, as a patch — or null when there is nothing to carry over. */
export const legacyPatch = (current: Settings): Partial<Settings> | null => {
  const store = storage()
  if (!store) return null

  const patch: Partial<Settings> = {}
  const autolock = number(read(store, 'autolockSecs'), n => n > 0)
  if (autolock !== undefined) patch.autolockSecs = autolock
  const clipboard = number(read(store, 'clipboardTimeout'), n => n >= 0)
  if (clipboard !== undefined) patch.clipboardTimeoutMs = clipboard
  const dateFormat = oneOf(read(store, 'dateFormat'), DATE_FORMATS)
  if (dateFormat) patch.dateFormat = dateFormat
  const sort = oneOf(read(store, 'listSort'), ['recent', 'alpha'] as const)
  if (sort) patch.listSort = sort
  if (read(store, 'breachCheck') === 'true') patch.breachCheck = true
  const theme = oneOf(store.getItem('theme'), ['light', 'dark', 'system'] as const)
  if (theme) patch.theme = theme
  const locale = oneOf(store.getItem('locale'), Object.keys(LANGUAGES))
  if (locale) patch.locale = locale

  // Rust replaces the group whole, so the stored knobs are laid over the
  // current group rather than sent alone. Same tolerance as before: a partial
  // or corrupt blob degrades to what is already there.
  const generator = read(store, 'generatorDefaults')
  if (generator) {
    try {
      const stored = JSON.parse(generator) as Partial<Settings['generator']>
      const merged = { ...current.generator, ...stored }
      if (Number.isFinite(merged.length)) patch.generator = merged
    } catch {
      // Not JSON: nothing worth keeping.
    }
  }

  return Object.keys(patch).length > 0 ? patch : null
}

export const clearLegacyPrefs = (): void => {
  const store = storage()
  if (!store) return
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
