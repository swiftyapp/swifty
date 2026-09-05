import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLayout } from '@/hooks/useLayout'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { setLayout } from './layout'

describe('useLayout', () => {
  it('reads wide when the compact query does not match', () => {
    expect(renderHook(() => useLayout()).result.current).toBe('wide')
  })

  it('reads compact when the query matches', () => {
    setLayout('compact')
    expect(renderHook(() => useLayout()).result.current).toBe('compact')
  })

  it('falls back to wide where matchMedia is missing', () => {
    const original = window.matchMedia
    // @ts-expect-error — modelling a webview without the API at all.
    delete window.matchMedia
    expect(renderHook(() => useLayout()).result.current).toBe('wide')
    window.matchMedia = original
  })
})

describe('useVisualViewport', () => {
  it('is null where the API is absent', () => {
    expect(renderHook(() => useVisualViewport()).result.current).toBeNull()
  })

  it('reports the visible height when the API is there', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { height: 640, addEventListener: () => {}, removeEventListener: () => {} }
    })
    expect(renderHook(() => useVisualViewport()).result.current).toBe(640)
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
  })
})
