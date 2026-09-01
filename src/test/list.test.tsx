import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListColumn from '@/components/Main/Body/ListColumn'
import type { Audit } from '@/lib/commands'
import { makeStore, setSort } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

// A fixed clock (Date only, so userEvent's real timers keep working) makes the
// recency buckets and the relative times deterministic.
const NOW = new Date(2024, 2, 14, 12, 0, 0)
const at = (...args: [number, number, number, number]) => new Date(...args).toISOString()

const entries = [
  loginMeta({ id: 'fresh', title: 'Zebra', updatedAt: at(2024, 2, 14, 9) }),
  loginMeta({ id: 'yday', title: 'Airbnb', updatedAt: at(2024, 2, 13, 18) }),
  loginMeta({ id: 'week', title: 'Monzo', updatedAt: at(2024, 2, 10, 12) }),
  loginMeta({ id: 'old', title: 'Basecamp', updatedAt: at(2024, 0, 12, 12) })
]

const titles = () =>
  screen
    .getAllByTestId('entry-item')
    .map(row => row.querySelector('.text-base')?.textContent)

const seed = (audit?: Audit) => {
  const store = makeStore()
  withEntries(store, entries, audit)
  return store
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  setSort('recent')
})

afterEach(() => vi.useRealTimers())

describe('Entry list', () => {
  it('lists newest first as a flat list, no date headers', () => {
    renderWithStore(<ListColumn />, { store: seed() })

    expect(titles()).toEqual(['Zebra', 'Airbnb', 'Monzo', 'Basecamp'])
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument()
  })

  it('shows a relative time on every row', () => {
    renderWithStore(<ListColumn />, { store: seed() })
    expect(screen.getByText('3h')).toBeInTheDocument()
    expect(screen.getByText('4d')).toBeInTheDocument()
    expect(screen.getByText('Jan 12')).toBeInTheDocument()
  })

  it('flags weak and reused entries from the audit already in the store', () => {
    const audit: Audit = {
      fresh: { score: 0, isWeak: true, isRepeating: false, breached: false },
      yday: { score: 2, isWeak: false, isRepeating: true, breached: false }
    }
    renderWithStore(<ListColumn />, { store: seed(audit) })

    expect(screen.getByText('weak')).toBeInTheDocument()
    expect(screen.getByText('reused')).toBeInTheDocument()
    // Only the two audited entries carry a chip.
    expect(screen.getAllByTestId('entry-item')).toHaveLength(4)
  })

  it('sorts alphabetically', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.click(screen.getByTestId('sort-menu'))
    await userEvent.click(screen.getByText('Alphabetical'))

    expect(titles()).toEqual(['Airbnb', 'Basecamp', 'Monzo', 'Zebra'])
  })
})
