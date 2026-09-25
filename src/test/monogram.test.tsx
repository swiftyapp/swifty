import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Monogram from '@/components/elements/Monogram'
import { WORKSPACE_COLORS } from '@/lib/workspaceColor'

const tile = (color?: string) => {
  const { container } = render(<Monogram name="Work" seed="w2" color={color} />)
  return container.firstElementChild as HTMLElement
}

describe('Monogram', () => {
  // A palette key is a themed solid with white ink, and none of the hashed
  // tint: no `monogram` utility and no `--hue` for it to read.
  it.each(WORKSPACE_COLORS)('draws %s as a solid tile', color => {
    const el = tile(color)

    expect(el).toHaveClass(`bg-ws-${color}`, 'text-white', 'rounded-[30%]')
    expect(el).not.toHaveClass('monogram')
    expect(el.style.getPropertyValue('--hue')).toBe('')
    expect(el).toHaveTextContent('W')
  })

  it('falls back to the hue its seed hashes to with no colour', () => {
    const el = tile()

    expect(el).toHaveClass('monogram')
    expect(el.className).not.toMatch(/bg-ws-/)
    expect(el.style.getPropertyValue('--hue')).not.toBe('')
  })

  // A key this build has no palette entry for (a newer one wrote it, say)
  // is no colour at all rather than a tile with no background.
  it('treats an unknown key as no colour', () => {
    const el = tile('chartreuse')

    expect(el).toHaveClass('monogram')
    expect(el.className).not.toMatch(/bg-ws-|text-white/)
  })

  it('keeps the same hue for the same seed', () => {
    const a = tile().style.getPropertyValue('--hue')
    const b = tile().style.getPropertyValue('--hue')
    expect(a).toBe(b)
  })
})
