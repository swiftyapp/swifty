import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore, type AppStore, type RootState } from '@/store'
import { setEntries } from '@/store/entriesSlice'
import { flowMain } from '@/store/flowSlice'
import { auditDone } from '@/store/auditSlice'
import type { Entry, Audit } from '@/lib/commands'

interface Options {
  store?: AppStore
}

// Renders a component inside a fresh store so tests never share state.
export const renderWithStore = (ui: ReactElement, { store = makeStore() }: Options = {}) => ({
  store,
  ...render(<Provider store={store}>{ui}</Provider>)
})

export const state = (store: AppStore): RootState => store.getState()

// Puts the store into the unlocked "main" flow with the given entries.
export const withEntries = (store: AppStore, entries: Entry[], audit?: Audit) => {
  store.dispatch(setEntries(entries))
  store.dispatch(flowMain())
  if (audit) store.dispatch(auditDone(audit))
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
