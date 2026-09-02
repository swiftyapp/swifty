import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toggle from '@/components/elements/Toggle'

describe('Toggle', () => {
  it('exposes its state as a switch', () => {
    render(<Toggle checked onChange={vi.fn()} aria-label="Biometrics" />)
    expect(screen.getByRole('switch', { name: 'Biometrics' })).toBeChecked()
  })

  it('reports the flipped value on click and on space', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} testid="t" />)

    await userEvent.click(screen.getByTestId('t'))
    expect(onChange).toHaveBeenCalledWith(true)

    screen.getByTestId('t').focus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('does not fire while disabled', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} disabled testid="t" />)

    await userEvent.click(screen.getByTestId('t'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
