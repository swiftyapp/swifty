import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RailButton from '@/components/elements/RailButton'

describe('RailButton', () => {
  it('is a button named by its label, with the label as its tooltip', () => {
    render(
      <RailButton label="All Items" testid="rail">
        <span />
      </RailButton>,
    )

    const button = screen.getByRole('button', { name: 'All Items' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).not.toHaveAttribute('aria-pressed')
    // The tooltip panel carries the same copy, next to the button.
    expect(screen.getAllByText('All Items')).toHaveLength(1)
    expect(screen.getByTestId('rail')).toBe(button)
  })

  it('reflects the selected state', () => {
    const { rerender } = render(
      <RailButton label="All Items" selected={false}>
        <span />
      </RailButton>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <RailButton label="All Items" selected>
        <span />
      </RailButton>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('fires on click', async () => {
    const onClick = vi.fn()
    render(
      <RailButton label="Settings" testid="rail" onClick={onClick}>
        <span />
      </RailButton>,
    )

    await userEvent.click(screen.getByTestId('rail'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
