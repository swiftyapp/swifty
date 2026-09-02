import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { makeStore, setEntries, flowMain, auditDone } from '@/store'
import type { Entry, EntryMeta, Audit } from '@/lib/commands'

type Store = ReturnType<typeof makeStore>

interface Options {
  store?: Store
}

// Renders a component against a freshly reset store so tests never share state.
export const renderWithStore = (ui: ReactElement, { store = makeStore() }: Options = {}) => ({
  store,
  ...render(ui)
})

// Puts the store into the unlocked "main" flow with the given entry metadata.
export const withEntries = (_store: Store, entries: EntryMeta[], audit?: Audit) => {
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
