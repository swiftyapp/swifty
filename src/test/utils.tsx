import {
  useApp,
  useUi,
  useVault,
  usePrefs,
  initialApp,
  initialUi,
  initialVault,
  DEFAULT_PREFS,
  setEntries,
  flowMain,
  auditDone
} from '@/store'
import type { Entry, EntryMeta, Audit } from '@/lib/commands'

// Puts every store back to its initial state so tests never share state.
export const resetStores = () => {
  useApp.setState(initialApp, true)
  useUi.setState(initialUi, true)
  useVault.setState(initialVault, true)
  usePrefs.setState(DEFAULT_PREFS)
}

// A promise a test settles by hand, for specs about what happens between the
// call and the answer — two in flight at once, or one that lands too late.
export const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

// Puts the stores into the unlocked "main" flow with the given entry metadata.
export const withEntries = (entries: EntryMeta[], audit?: Audit) => {
  setEntries(entries)
  flowMain()
  if (audit) auditDone(audit)
}

// A tombstone, as `list_deleted` reports one.
export const deletedMeta = (overrides: Partial<EntryMeta> = {}): EntryMeta =>
  loginMeta({ id: 'd1', title: 'Old Account', deletedAt: '2024-01-05T00:00:00.000Z', ...overrides })

// List metadata for a login, as the backend returns it (no secret fields).
export const loginMeta = (overrides: Partial<EntryMeta> = {}): EntryMeta => ({
  id: 'l1',
  type: 'login',
  title: 'Google',
  tags: [],
  urlHost: 'google.com',
  favorite: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides
})

export const loginEntry = (overrides: Partial<Entry> = {}): Entry => ({
  id: 'l1',
  type: 'login',
  title: 'Google',
  website: 'https://google.com',
  username: 'me@example.com',
  password: 'secret',
  email: 'contact@example.com',
  note: '',
  otp: '',
  tags: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides
}) as Entry
