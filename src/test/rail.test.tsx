import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '@/components/Main/Sidebar'
import { setView } from '@/store'
import { calls } from './ipc'

beforeEach(() => vi.clearAllMocks())

describe('the rail', () => {
  // The lock used to be a top-chrome control with a native `title`; as a rail
  // tile its name comes from the aria-label, since the tooltip panel is
  // aria-hidden.
  it('locks the vault from its foot, named without a native tooltip', async () => {
    render(<Sidebar />)
    const lock = screen.getByTestId('lock-vault-button')
    expect(lock).toHaveAccessibleName('Lock vault')
    expect(lock).not.toHaveAttribute('title')

    await userEvent.click(lock)
    expect(calls('lock')).toHaveLength(1)
  })

  it('has no generator tile', () => {
    render(<Sidebar />)
    expect(screen.queryByTestId('generator-button')).not.toBeInTheDocument()
  })

  it('presses exactly the tile of the current view', () => {
    setView('favorites')
    render(<Sidebar />)

    expect(screen.getByTestId('view-favorites')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('view-items')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('view-archive')).toHaveAttribute('aria-pressed', 'false')
  })
})
