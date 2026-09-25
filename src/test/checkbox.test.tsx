import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Checkbox from '@/components/elements/Checkbox'

describe('Checkbox', () => {
  it('is a checkbox named by its label, and flips on click', async () => {
    const onChange = vi.fn()
    render(
      <Checkbox checked={false} onChange={onChange} testid="ack">
        I understand the risk
      </Checkbox>
    )

    const box = screen.getByRole('checkbox', { name: 'I understand the risk' })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reports checked and refuses while disabled', async () => {
    const onChange = vi.fn()
    render(
      <Checkbox checked onChange={onChange} disabled testid="ack">
        Confirmed
      </Checkbox>
    )

    expect(screen.getByTestId('ack')).toBeChecked()
    await userEvent.click(screen.getByTestId('ack'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
