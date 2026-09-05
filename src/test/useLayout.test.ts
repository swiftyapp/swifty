import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLayout } from '@/hooks/useLayout'
import { useVisualViewport, viewportStyle } from '@/hooks/useVisualViewport'
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

  const install = (height: number, offsetTop: number) =>
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { height, offsetTop, addEventListener: () => {}, removeEventListener: () => {} }
    })
  const uninstall = () =>
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

  it('reports the visible height and how far iOS panned it', () => {
    install(640, 120)
    expect(renderHook(() => useVisualViewport()).result.current).toEqual({
      height: 640,
      offsetTop: 120
    })
    uninstall()
  })

  it('turns that into a height plus a translate, and no translate when unpanned', () => {
    expect(viewportStyle(null)).toBeUndefined()
    expect(viewportStyle({ height: 640, offsetTop: 0 })).toEqual({
      height: 640,
      transform: undefined
    })
    expect(viewportStyle({ height: 640, offsetTop: 120 })).toEqual({
      height: 640,
      transform: 'translateY(120px)'
    })
  })
})
