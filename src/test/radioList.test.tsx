import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RadioList from '@/components/elements/RadioList'

const OPTIONS = [
  { value: '60', label: 'One minute', meta: '1 m' },
  { value: '300', label: 'Five minutes', meta: '5 m' },
  { value: '0', label: 'Never' }
]

describe('RadioList', () => {
  it('renders one radio per option with its mono meta', () => {
    render(<RadioList options={OPTIONS} value="60" onChange={vi.fn()} testidPrefix="lock" />)

    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByTestId('lock-60')).toBeChecked()
    expect(screen.getByTestId('lock-0')).not.toBeChecked()
    expect(screen.getByText('5 m')).toBeInTheDocument()
  })

  it('selects on click', async () => {
    const onChange = vi.fn()
    render(<RadioList options={OPTIONS} value="60" onChange={onChange} />)

    await userEvent.click(screen.getByText('Never'))
    expect(onChange).toHaveBeenCalledWith('0')
  })

  // The card surface clips the global focus outline, so the focused option has
  // to carry the hover treatment to be visible at all.
  it('gives the focused option the hover treatment', () => {
    render(<RadioList options={OPTIONS} value="60" onChange={vi.fn()} testidPrefix="lock" />)

    expect(screen.getByTestId('lock-60')).toHaveClass('focus-visible:bg-hover')
  })

  it('moves selection with the arrow keys', async () => {
    const Harness = () => {
      const [value, setValue] = useState('60')
      return <RadioList options={OPTIONS} value={value} onChange={setValue} testidPrefix="lock" />
    }
    render(<Harness />)

    screen.getByTestId('lock-60').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByTestId('lock-300')).toBeChecked()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByTestId('lock-60')).toBeChecked()
  })
})
