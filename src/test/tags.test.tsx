import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '@/components/Main/Sidebar'
import ListColumn from '@/components/Main/Body/ListColumn'
import { DetailEmpty } from '@/components/Main/Body/Empty'
import { useVariant } from '@/components/Main/Body/Empty/variant'
import { makeStore, useStore, setView, setFilterTag } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

const entries = [
  loginMeta({ id: 'a', title: 'Google', tags: ['work', 'mail'] }),
  loginMeta({ id: 'b', title: 'Airbnb', tags: ['work'], favorite: true }),
  loginMeta({ id: 'c', title: 'Monzo', tags: ['money'] }),
  loginMeta({ id: 'd', type: 'card', title: 'Visa', tags: ['money'], urlHost: '' })
]

const titles = () => screen.getAllByTestId('entry-item-title').map(el => el.textContent)
const tagRows = () =>
  screen.getAllByTestId(/^tag-row-[^-]+$/).map(row => row.textContent)

// The wide shell's detail pane, reduced to the one thing the tags view puts in
// it: the hero for a vault with no tags, or nothing.
const Detail = () => {
  const variant = useVariant()
  return variant ? <DetailEmpty variant={variant} /> : null
}

// The rail and the column it drives: Tags is a view, so it is read across the
// tile that lights, the title, and what the column lists.
const seed = (rows = entries, prepare?: () => void) => {
  const store = makeStore()
  withEntries(rows)
  prepare?.()
  return renderWithStore(
    <>
      <Sidebar />
      <ListColumn />
      <Detail />
    </>,
    { store }
  )
}

const openTags = () => userEvent.click(screen.getByTestId('tags-button'))

beforeEach(() => vi.clearAllMocks())

describe('the tags view', () => {
  it('sits in the rail with the other views and lights when opened', async () => {
    seed()
    expect(screen.getByTestId('tags-button')).toHaveAttribute('aria-pressed', 'false')

    await openTags()

    expect(useStore.getState().ui.view).toBe('tags')
    expect(screen.getByTestId('tags-button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('view-items')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('list-title')).toHaveTextContent('Tags')
  })

  it('lists every tag in the vault, busiest first, with its count', async () => {
    seed()
    await openTags()

    expect(tagRows()).toEqual(['#money2', '#work2', '#mail1'])
    expect(screen.queryAllByTestId('entry-item')).toHaveLength(0)
    // A list of tags has nothing to search or narrow by kind.
    expect(screen.queryByTestId('kinds-list')).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('shows the items carrying a picked tag, from across the vault, still under Tags', async () => {
    seed()
    await openTags()
    await userEvent.click(screen.getByTestId('tag-row-work'))

    expect(useStore.getState().filters.tag).toBe('work')
    expect(useStore.getState().ui.view).toBe('tags')
    expect(screen.getByTestId('tags-button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('view-items')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('list-title')).toHaveTextContent('#work')
    expect(screen.getByTestId('active-tag')).toHaveTextContent('#work')
    // The starred and the unstarred row both: a tag is not scoped to a view.
    expect(titles()).toEqual(expect.arrayContaining(['Google', 'Airbnb']))
    expect(titles()).toHaveLength(2)
  })

  it('returns to the tag list from the chip', async () => {
    seed()
    await openTags()
    await userEvent.click(screen.getByTestId('tag-row-work'))
    await userEvent.click(screen.getByTestId('active-tag'))

    expect(useStore.getState().filters.tag).toBeNull()
    expect(useStore.getState().ui.view).toBe('tags')
    expect(screen.queryByTestId('active-tag')).not.toBeInTheDocument()
    expect(tagRows()).toEqual(['#money2', '#work2', '#mail1'])
  })

  it('returns to the tag list when the rail tile is picked again', async () => {
    seed()
    await openTags()
    await userEvent.click(screen.getByTestId('tag-row-work'))
    await openTags()

    expect(useStore.getState().filters.tag).toBeNull()
    expect(screen.getByTestId('tag-list')).toBeInTheDocument()
  })

  it('drops the tag on the way to another view', async () => {
    seed()
    await openTags()
    await userEvent.click(screen.getByTestId('tag-row-work'))
    await userEvent.click(screen.getByTestId('view-items'))

    expect(useStore.getState().filters.tag).toBeNull()
    expect(screen.queryByTestId('active-tag')).not.toBeInTheDocument()
    expect(titles()).toHaveLength(4)
  })

  it('does not narrow the other views', () => {
    seed(entries, () => {
      setView('favorites')
      setFilterTag('money')
    })

    // Favorites is the starred rows, whatever tag was left in the store.
    expect(titles()).toEqual(['Airbnb'])
    expect(screen.queryByTestId('active-tag')).not.toBeInTheDocument()
  })

  it('composes with the kind filter once a tag is picked', async () => {
    seed()
    await openTags()
    await userEvent.click(screen.getByTestId('tag-row-money'))
    // The chips come back with the entry rows, scoped to the tag's items.
    expect(screen.getByTestId('filter-all-count')).toHaveTextContent('4')
    await userEvent.click(screen.getByTestId('filter-card'))

    // Both narrow the same list: only the card tagged "money" is left.
    expect(titles()).toEqual(['Visa'])
  })

  it('says how to fill itself when the vault carries no tags', async () => {
    seed([loginMeta({ id: 'bare', title: 'Basecamp' })])
    await openTags()

    expect(screen.queryByTestId('tag-list')).not.toBeInTheDocument()
    expect(screen.getByTestId('empty-tags')).toBeInTheDocument()
    expect(screen.getByText('Add tags to an entry and they show up here.')).toBeInTheDocument()
  })
})
