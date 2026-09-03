import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Segmented from '@/components/elements/Segmented'

const OPTIONS = [
  { value: 'random', label: 'Random' },
  { value: 'memorable', label: 'Memorable' }
]

describe('Segmented', () => {
  it('marks the active segment and keys testids off the prefix', () => {
    render(<Segmented options={OPTIONS} value="random" onChange={vi.fn()} testidPrefix="mode" />)

    expect(screen.getByTestId('mode-random')).toBeChecked()
    expect(screen.getByTestId('mode-memorable')).not.toBeChecked()
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('names the radiogroup', () => {
    render(<Segmented options={OPTIONS} value="random" onChange={vi.fn()} name="Mode" />)

    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
  })

  it('selects on click', async () => {
    const onChange = vi.fn()
    render(<Segmented options={OPTIONS} value="random" onChange={onChange} />)

    await userEvent.click(screen.getByText('Memorable'))
    expect(onChange).toHaveBeenCalledWith('memorable')
  })

  it('moves selection with the arrow keys, wrapping around the ends', async () => {
    const Harness = () => {
      const [value, setValue] = useState('random')
      return <Segmented options={OPTIONS} value={value} onChange={setValue} testidPrefix="mode" />
    }
    render(<Harness />)

    screen.getByTestId('mode-random').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByTestId('mode-memorable')).toBeChecked()

    // Past the last segment, selection wraps to the first.
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByTestId('mode-random')).toBeChecked()
  })
})
