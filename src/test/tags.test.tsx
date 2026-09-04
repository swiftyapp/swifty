import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Tags from '@/components/Main/Sidebar/Tags'
import ListColumn from '@/components/Main/Body/ListColumn'
import { listDeleted } from '@/lib/commands'
import { makeStore, useStore, setView, setFilterType } from '@/store'
import { renderWithStore, withEntries, loginMeta, deletedMeta } from './utils'

const entries = [
  loginMeta({ id: 'a', title: 'Google', tags: ['work', 'mail'] }),
  loginMeta({ id: 'b', title: 'Airbnb', tags: ['work'], favorite: true }),
  loginMeta({ id: 'c', title: 'Monzo', tags: ['money'] }),
  loginMeta({ id: 'd', type: 'card', title: 'Visa', tags: ['money'], urlHost: '' })
]

const titles = () => screen.getAllByTestId('entry-item-title').map(el => el.textContent)
const options = () => screen.getAllByRole('menuitem').map(item => item.textContent)

// The rail tile and the column it narrows: the filter is only legible across
// both, one lighting up and the other explaining why it is short.
const seed = (rows = entries, prepare?: () => void) => {
  const store = makeStore()
  withEntries(rows)
  prepare?.()
  return renderWithStore(
    <>
      <Tags />
      <ListColumn />
    </>,
    { store }
  )
}

const open = () => userEvent.click(screen.getByTestId('tags-button'))

beforeEach(() => vi.clearAllMocks())

describe('the tags popover', () => {
  it('lists every tag in the view, busiest first, with its count', async () => {
    seed()
    await open()

    expect(options()).toEqual(['money2', 'work2', 'mail1'])
  })

  it('counts the tags of the open view, not of the whole vault', async () => {
    seed(entries, () => setView('favorites'))
    await open()

    // Only the starred row is in scope, so only its tag is offered.
    expect(options()).toEqual(['work1'])
  })

  it('counts the tombstones in the Trash', async () => {
    vi.mocked(listDeleted).mockResolvedValue([deletedMeta({ id: 't', tags: ['gone'] })])
    seed(entries, () => setView('trash'))
    await vi.waitFor(() => expect(useStore.getState().entries.trash).toHaveLength(1))

    await open()
    expect(options()).toEqual(['gone1'])
  })

  it('lights the tile and shows the active chip once a tag is picked', async () => {
    seed()
    expect(screen.getByTestId('tags-button')).toHaveAttribute('aria-pressed', 'false')

    await open()
    await userEvent.click(screen.getByTestId('tag-option-work'))

    expect(useStore.getState().filters.tag).toBe('work')
    expect(screen.getByTestId('tags-button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('active-tag')).toHaveTextContent('#work')
    expect(titles()).toEqual(expect.arrayContaining(['Google', 'Airbnb']))
    expect(titles()).toHaveLength(2)
    // Picking is also what closes it.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('clears the filter from the chip', async () => {
    seed()
    await open()
    await userEvent.click(screen.getByTestId('tag-option-work'))
    await userEvent.click(screen.getByTestId('active-tag'))

    expect(useStore.getState().filters.tag).toBeNull()
    expect(screen.queryByTestId('active-tag')).not.toBeInTheDocument()
    expect(titles()).toHaveLength(4)
  })

  it('keeps offering the active tag at its full count, and clears on a second pick', async () => {
    seed()
    await open()
    await userEvent.click(screen.getByTestId('tag-option-work'))

    // Counting the filtered list would have left "work" alone in the menu.
    await open()
    expect(options()).toEqual(['money2', 'work2', 'mail1'])

    await userEvent.click(screen.getByTestId('tag-option-work'))
    expect(useStore.getState().filters.tag).toBeNull()
  })

  it('composes with the kind filter', async () => {
    seed(entries, () => setFilterType('card'))
    await open()
    await userEvent.click(screen.getByTestId('tag-option-money'))

    // Both narrow the same list: only the card tagged "money" is left.
    expect(titles()).toEqual(['Visa'])
  })

  it('says how to fill itself when the vault carries no tags', async () => {
    seed([loginMeta({ id: 'bare', title: 'Basecamp' })])
    await open()

    expect(screen.getByTestId('tags-empty')).toBeInTheDocument()
    expect(screen.getByText('Add tags to an entry and they show up here.')).toBeInTheDocument()
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })

  it('closes on Escape and on a click outside', async () => {
    seed()

    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await open()
    await userEvent.click(screen.getByTestId('dropdown-scrim'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
