import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListColumn from '@/components/Main/Body/ListColumn'
import { copyToClipboard, fetchFavicon, revealEntry, type Audit } from '@/lib/commands'
import { makeStore, useStore, setFilterType } from '@/store'
import { resetFavicons } from '@/hooks/useFavicon'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'

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
  withEntries(entries, audit)
  return store
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetFavicons()
  vi.mocked(fetchFavicon).mockClear()
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
    expect(screen.getByText('01/12/2024')).toBeInTheDocument()
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

  it('swaps the glyph for the site favicon once it resolves, one fetch per host', async () => {
    const uri = 'data:image/png;base64,AAAA'
    vi.mocked(fetchFavicon).mockResolvedValue(uri)
    renderWithStore(<ListColumn />, { store: seed() })

    await waitFor(() =>
      expect(document.querySelectorAll(`img[src="${uri}"]`)).toHaveLength(4)
    )
    // All four rows share one host — the lookup is deduped across them.
    expect(fetchFavicon).toHaveBeenCalledTimes(1)
  })

  it('keeps the type glyph when the host has no favicon', async () => {
    vi.mocked(fetchFavicon).mockResolvedValue(null)
    renderWithStore(<ListColumn />, { store: seed() })

    await waitFor(() => expect(fetchFavicon).toHaveBeenCalled())
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })

  it('shows the network mark on card rows that carry a brand', () => {
    const store = makeStore()
    withEntries([
      loginMeta({ id: 'c1', type: 'card', title: 'Company Visa', cardBrand: 'visa', urlHost: '' }),
      loginMeta({ id: 'c2', type: 'card', title: 'Mystery Card', urlHost: '' })
    ])
    setFilterType('card')
    renderWithStore(<ListColumn />, { store })

    expect(document.querySelector('svg[aria-label="visa"]')).toBeInTheDocument()
    // The brandless card falls back to the generic glyph, not an empty tile.
    expect(document.querySelectorAll('svg[aria-label]')).toHaveLength(1)
    setFilterType(null)
  })

  it('sorts alphabetically', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.click(screen.getByTestId('sort-menu'))
    await userEvent.click(screen.getByText('Alphabetical'))

    expect(titles()).toEqual(['Airbnb', 'Basecamp', 'Monzo', 'Zebra'])
  })
})

// The app's only search field lives in this column, so its accelerators are
// asserted against the same rows they act on.
describe('List search', () => {
  const field = () => screen.getByTestId('search-input')

  beforeEach(() => vi.clearAllMocks())

  it('narrows the list as you type and restores it on clear', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.type(field(), 'air')
    expect(screen.getByText('Airbnb')).toBeInTheDocument()
    expect(screen.queryByText('Zebra')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('search-clear-button'))
    expect(titles()).toEqual(['Zebra', 'Airbnb', 'Monzo', 'Basecamp'])
  })

  // A query is answered by relevance, not by the sort control: re-sorting the
  // ranked results buried the closest match under whatever was newest.
  it('keeps the search ranking, so the best match leads', async () => {
    const store = makeStore()
    withEntries([
      loginMeta({ id: 'loose', title: 'Monzo Business Account', updatedAt: at(2024, 2, 14, 9) }),
      loginMeta({ id: 'exact', title: 'Monzo', updatedAt: at(2024, 0, 12, 12) })
    ])
    renderWithStore(<ListColumn />, { store })

    // Recency alone would lead with the newer, looser match.
    expect(titles()).toEqual(['Monzo Business Account', 'Monzo'])

    await userEvent.type(field(), 'monzo')
    expect(titles()).toEqual(['Monzo', 'Monzo Business Account'])
  })

  it('selects the first visible row on ⏎', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    // No query: the first row of the list as sorted (newest first).
    await userEvent.type(field(), '{Enter}')
    expect(useStore.getState().entries.current?.id).toBe('fresh')

    // With one: the first row the query leaves standing.
    await userEvent.type(field(), 'air{Enter}')
    expect(useStore.getState().entries.current?.id).toBe('yday')
  })

  it('copies the first visible row’s primary secret on ⌘⏎', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'fresh', password: 's3cret' }))
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.click(field())
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    expect(revealEntry).toHaveBeenCalledWith('fresh')
    await vi.waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith('s3cret', expect.anything())
    )
    // Copying is not selecting.
    expect(useStore.getState().entries.current).toBeNull()
  })

  it('clears the query on Esc, then blurs', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.type(field(), 'air')
    await userEvent.keyboard('{Escape}')
    expect(field()).toHaveValue('')
    expect(field()).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(field()).not.toHaveFocus()
  })
})

// The arrows belong to the whole column, so they are asserted from both ends of
// it: with the caret in the search field, and with a row itself focused.
describe('List keyboard navigation', () => {
  const field = () => screen.getByTestId('search-input')
  const currentId = () => useStore.getState().entries.current?.id

  beforeEach(() => vi.clearAllMocks())

  it('walks the visible rows with ↓/↑ without taking the caret out of the field', async () => {
    renderWithStore(<ListColumn />, { store: seed() })
    await userEvent.click(field())

    // Nothing selected yet: ↓ opens the list at its top row.
    await userEvent.keyboard('{ArrowDown}')
    expect(currentId()).toBe('fresh')

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(currentId()).toBe('week')
    await userEvent.keyboard('{ArrowUp}')
    expect(currentId()).toBe('yday')

    expect(field()).toHaveFocus()
  })

  it('clamps at both ends rather than wrapping', async () => {
    renderWithStore(<ListColumn />, { store: seed() })
    await userEvent.click(field())

    // One press more than there are rows, at each end.
    await userEvent.keyboard('{ArrowDown>5/}')
    expect(currentId()).toBe('old')
    await userEvent.keyboard('{ArrowUp>5/}')
    expect(currentId()).toBe('fresh')
  })

  it('moves on from the selected row, carrying focus when the row has it', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.click(screen.getByText('Monzo'))
    expect(currentId()).toBe('week')

    await userEvent.keyboard('{ArrowDown}')
    expect(currentId()).toBe('old')
    // A focused row hands focus to the row the arrows land on.
    expect(screen.getAllByTestId('entry-item')[3]).toHaveFocus()
  })

  it('re-aims at the first row left standing when a query hides the selection', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.click(screen.getByText('Monzo'))
    await userEvent.type(field(), 'air')
    await userEvent.keyboard('{ArrowDown}')

    expect(currentId()).toBe('yday')
  })

  it('points ⌘⏎ at the row the arrows landed on', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'yday', password: 'airbnb' }))
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.click(field())
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    // The second row, not the first the empty query would have offered.
    expect(revealEntry).toHaveBeenCalledWith('yday')
    await vi.waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith('airbnb', expect.anything())
    )
  })

  it('leaves ⏎ on the column’s own controls to that control', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    // The sort button opens its menu on ⏎; selecting a row as well would be
    // two actions on one press.
    screen.getByTestId('sort-menu').focus()
    await userEvent.keyboard('{Enter}')

    expect(screen.getByTestId('sort-option-recent')).toBeInTheDocument()
    expect(useStore.getState().entries.current).toBeNull()
  })

  it('leaves the arrows alone while the sort menu owns them', async () => {
    renderWithStore(<ListColumn />, { store: seed() })

    await userEvent.click(screen.getByTestId('sort-menu'))
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')

    expect(useStore.getState().entries.current).toBeNull()
  })

  it('leaves the arrows alone in fields outside the column', async () => {
    renderWithStore(
      <>
        <input data-testid="outside-field" />
        <ListColumn />
      </>,
      { store: seed() }
    )

    await userEvent.click(screen.getByTestId('outside-field'))
    await userEvent.keyboard('{ArrowDown}{ArrowUp}')

    expect(useStore.getState().entries.current).toBeNull()
  })
})
