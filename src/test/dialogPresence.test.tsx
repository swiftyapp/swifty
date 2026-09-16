import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { isModalOpen } from '@/store'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { useDialogPresence } from '@/hooks/useDialogPresence'

/**
 * `isModalOpen()` is what every window-level accelerator asks before acting.
 * It has to be true for exactly as long as any dialog is mounted — one the
 * store opened, one a component keeps in its own state, one stacked over
 * another — or a ⌘⏎ saves the draft behind a prompt that was still asking.
 */

function Frame() {
  const frame = useRef<HTMLDivElement>(null)
  useDialogFocus(frame, () => {})
  return <div ref={frame} role="dialog" tabIndex={-1} />
}

function Bare() {
  useDialogPresence()
  return null
}

describe('modal presence', () => {
  it('is open for as long as a focus-trapping frame is mounted', () => {
    expect(isModalOpen()).toBe(false)
    const { unmount } = render(<Frame />)
    expect(isModalOpen()).toBe(true)
    unmount()
    expect(isModalOpen()).toBe(false)
  })

  it('stays open while any of several is still up', () => {
    const first = render(<Frame />)
    const second = render(<Bare />)
    first.unmount()
    expect(isModalOpen()).toBe(true)
    second.unmount()
    expect(isModalOpen()).toBe(false)
  })
})

// Every surface that renders as a dialog has to be one of these two. A frame
// that traps focus registers through the shared hook; anything that handles
// its own keyboard says so with `useDialogPresence` directly.
describe('every dialog registers its presence', () => {
  const components = import.meta.glob('../**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true
  }) as Record<string, string>

  it('by trapping focus or by saying so', () => {
    const unregistered = Object.entries(components)
      .filter(([path]) => !path.includes('/test/') && !/\.test\.tsx$/.test(path))
      .filter(([, source]) => /role=["']dialog["']/.test(source))
      .filter(([, source]) => !/useDialogFocus\(|useDialogPresence\(/.test(source))
      .map(([path]) => path)
    expect(unregistered).toEqual([])
  })
})
