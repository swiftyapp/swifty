import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmptyState from '@/components/elements/EmptyState'
import { PlusGlyph } from '@/components/Main/icons'

describe('EmptyState', () => {
  it('renders the title, body, actions and hints, and runs the primary action', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        mark={<PlusGlyph />}
        title="No entries yet"
        body="Add your first login to get started."
        primary={{ label: 'New entry', onClick, testid: 'empty-new' }}
        secondary={{ label: 'Import', onClick: vi.fn() }}
        hints={[{ keys: '⌘N', label: 'new' }]}
      />
    )

    expect(screen.getByText('No entries yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first login to get started.')).toBeInTheDocument()
    expect(screen.getByText('⌘N')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('empty-new'))
    expect(onClick).toHaveBeenCalled()
  })

  it('drops the title tier in the compact variant and links the secondary', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        compact
        mark={<PlusGlyph />}
        title="No matches"
        body="Nothing matches this filter"
        secondary={{ label: 'Clear', onClick }}
      />
    )

    expect(screen.getByText('Nothing matches this filter')).toBeInTheDocument()
    expect(screen.queryByText('No matches')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Clear'))
    expect(onClick).toHaveBeenCalled()
  })
})
