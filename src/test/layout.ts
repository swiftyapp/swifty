import { COMPACT_QUERY, type Layout } from '@/hooks/useLayout'

/**
 * jsdom ships no matchMedia at all, so `useLayout` would otherwise fall back to
 * `wide` by accident rather than by measurement. `setup.ts` installs the wide
 * stub before every test; a compact test opts in by calling this again.
 */
export const setLayout = (layout: Layout) => {
  const compact = layout === 'compact'
  window.matchMedia = ((query: string) =>
    ({
      matches: compact && query === COMPACT_QUERY,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}
