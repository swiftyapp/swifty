import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Show from '@/components/Main/Body/Aside/Show'
import Aside from '@/components/Main/Body/Aside'
import Body from '@/components/Main/Body'
import { setCurrentEntry, useUi, useVault } from '@/store'
import { kindOf } from '@/kinds'
import { t } from '@/i18n'
import { withEntries, loginEntry, loginMeta } from './utils'
import { mockCommand } from './ipc'

beforeEach(() => vi.clearAllMocks())

// The detail pane's chrome: what it says about the entry around the kind's own
// field set. The field set itself is covered by entry.test.tsx.
describe('Show chrome', () => {
  it('names the kind once and reduces the stamps to one footer line', async () => {
    mockCommand('reveal_entry', () => loginEntry())
    render(<Show entry={loginMeta()} />)

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
    mockCommand('reveal_entry', () => loginEntry({ tags: ['work'] }))
    render(<Show entry={loginMeta({ tags: ['work'] })} />)

    await userEvent.click(await screen.findByLabelText('Filter by tag work'))
    expect(useUi.getState().query).toBe('work')
  })
})

// Entering edit mode: the pane swaps faces in place, and the list column steps
// back while it does.
describe('Edit mode in the pane', () => {
  const seed = () => {
    withEntries([loginMeta()])
    setCurrentEntry('l1')
  }

  beforeEach(() => mockCommand('reveal_entry', () => loginEntry()))

  // Edit lives under the header's one menu, not as a button of its own.
  const openEdit = async () => {
    await userEvent.click(screen.getByTestId('more-actions-button'))
    await userEvent.click(screen.getByTestId('edit-entry-button'))
  }

  it('replaces the read view with the editor, in the same pane', async () => {
    seed()
    render(<Aside />)

    expect(screen.queryByTestId('entry-sheet')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-entry-button')).not.toBeInTheDocument()
    await openEdit()

    expect(useVault.getState().editing).toBe(true)
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument()
    // The read cluster goes with it: one set of actions at a time.
    expect(screen.queryByTestId('primary-action-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('save-entry-button')).toBeInTheDocument()
  })

  // The footer's tags cell is never a hole: with nothing filed, it is the way
  // to file something, and that goes straight to the editor.
  it('opens the editor from the empty tags cell', async () => {
    seed()
    render(<Aside />)

    expect(screen.queryByLabelText(/Filter by tag/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('add-tag-button'))

    expect(useVault.getState().editing).toBe(true)
    expect(screen.getByTestId('tags-input')).toBeInTheDocument()
  })

  it('leaves the list column visible but quiet and inert while writing', async () => {
    seed()
    render(<Body />)
    expect(screen.getByTestId('list-column')).not.toHaveClass('opacity-60')

    await openEdit()
    expect(screen.getByTestId('list-column')).toHaveClass('opacity-60')
    // `inert`, not `pointer-events-none`: the keyboard has to stand down too.
    expect(screen.getByTestId('list-column')).toHaveAttribute('inert')
  })
})
