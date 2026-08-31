import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { makeStore, setEntries, flowMain, auditDone } from '@/store'
import type { Entry, Audit } from '@/lib/commands'

type Store = ReturnType<typeof makeStore>

interface Options {
  store?: Store
}

// Renders a component against a freshly reset store so tests never share state.
export const renderWithStore = (ui: ReactElement, { store = makeStore() }: Options = {}) => ({
  store,
  ...render(ui)
})

// Puts the store into the unlocked "main" flow with the given entries.
export const withEntries = (_store: Store, entries: Entry[], audit?: Audit) => {
  setEntries(entries)
  flowMain()
  if (audit) auditDone(audit)
}

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
