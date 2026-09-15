import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { useStore, makeStore, setEntries, flowMain, auditDone } from '@/store'
import type { Entry, EntryMeta } from '@/api/types'
import type { AppStatus } from '@/api/app'
import type { Audit } from '@/api/tools'
import { appStatusDefault } from './ipc'

interface Options {
  store?: ReturnType<typeof makeStore>
}

// The launch probe's answer, in the store the way `main.tsx` leaves it, with
// whatever one spec needs different about it (a gate that is enrolled, a vault
// that is not on disk yet). Every screen reads its half of this rather than
// asking the backend, so this is how a spec sets the scene.
export const seedApp = (overrides: Partial<AppStatus> = {}) =>
  useStore.setState({ app: { ...appStatusDefault(), ...overrides } })

// Renders a component against a freshly reset store so tests never share state.
export const renderWithStore = (ui: ReactElement, { store = makeStore() }: Options = {}) => {
  seedApp()
  return { store, ...render(ui) }
}

// Puts the (singleton) store into the unlocked "main" flow with the given entry
// metadata. Acts on the store the bound actions already point at, so there is
// nothing to hand it.
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
