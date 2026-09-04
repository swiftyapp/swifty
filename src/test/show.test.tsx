import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Show from '@/components/Main/Body/Aside/Show'
import Aside from '@/components/Main/Body/Aside'
import Body from '@/components/Main/Body'
import { revealEntry } from '@/lib/commands'
import { makeStore, setCurrentEntry } from '@/store'
import { kindOf } from '@/kinds'
import { t } from '@/i18n'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'

beforeEach(() => vi.clearAllMocks())

// The detail pane's chrome: what it says about the entry around the kind's own
// field set. The field set itself is covered by entry.test.tsx.
describe('Show chrome', () => {
  it('names the kind once and reduces the stamps to one footer line', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry())
    renderWithStore(<Show entry={loginMeta()} />)

    // The eyebrow above the title is the only place the kind is named; the
    // "Type" ledger cell that repeated it is gone.
    expect(screen.getAllByText(t(kindOf('login').label))).toHaveLength(1)
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
    // The footer is labelled cells, not a sentence: a label over each stamp.
    const footer = screen.getByTestId('entry-footer')
    expect(footer).toHaveTextContent('Modified')
    expect(footer).toHaveTextContent('Created')
  })

  it('filters the list by a tag pressed in the detail pane', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ tags: ['work'] }))
    const { store } = renderWithStore(<Show entry={loginMeta({ tags: ['work'] })} />)

    await userEvent.click(await screen.findByLabelText('Filter by tag work'))
    expect(store.getState().filters.query).toBe('work')
  })
})

// Entering edit mode: the pane swaps faces in place, and the list column steps
// back while it does.
describe('Edit mode in the pane', () => {
  const seed = () => {
    const store = makeStore()
    withEntries([loginMeta()])
    setCurrentEntry('l1')
    return store
  }

  beforeEach(() => vi.mocked(revealEntry).mockResolvedValue(loginEntry()))

  it('replaces the read view with the editor, in the same pane', async () => {
    const { store } = renderWithStore(<Aside />, { store: seed() })

    expect(screen.queryByTestId('entry-sheet')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('edit-entry-button'))

    expect(store.getState().entries.edit).toBe(true)
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument()
    // The read cluster goes with it: one set of actions at a time.
    expect(screen.queryByTestId('primary-action-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('save-entry-button')).toBeInTheDocument()
  })

  // The footer's tags cell is never a hole: with nothing filed, it is the way
  // to file something, and that goes straight to the editor.
  it('opens the editor from the empty tags cell', async () => {
    const { store } = renderWithStore(<Aside />, { store: seed() })

    expect(screen.queryByLabelText(/Filter by tag/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('add-tag-button'))

    expect(store.getState().entries.edit).toBe(true)
    expect(screen.getByTestId('tags-input')).toBeInTheDocument()
  })

  it('leaves the list column visible but quiet and inert while writing', async () => {
    renderWithStore(<Body />, { store: seed() })
    expect(screen.getByTestId('list-column')).not.toHaveClass('opacity-60')

    await userEvent.click(screen.getByTestId('edit-entry-button'))
    expect(screen.getByTestId('list-column')).toHaveClass('opacity-60')
    // `inert`, not `pointer-events-none`: the keyboard has to stand down too.
    expect(screen.getByTestId('list-column')).toHaveAttribute('inert')
  })
})
