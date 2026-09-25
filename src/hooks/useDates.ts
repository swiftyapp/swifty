import { useMemo } from 'react'
import { usePrefs } from '@/store'
import { dates, type Dates } from '@/utils/time'

/**
 * The date helpers for the pattern picked in Settings › General,
 * subscribed: a component that renders a date through these is re-rendered when
 * the pattern changes, so nothing on screen keeps the pattern it was first drawn
 * in. The one way a component should format a date.
 */
export const useDates = (): Dates => {
  const format = usePrefs(state => state.dateFormat)
  return useMemo(() => dates(format), [format])
}
