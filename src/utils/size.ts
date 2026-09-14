const UNITS = ['B', 'KB', 'MB', 'GB']

/**
 * A byte count as a person reads it: '812 KB', '1.2 MB'. One decimal only once
 * past a kilobyte, since the tenth of a byte is noise and the tenth of a
 * megabyte is not. The units are not translated — KB/MB are the same three
 * letters in every locale the app ships.
 */
export const humanSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${UNITS[0]}`

  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  const rounded = unit === 0 || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${UNITS[unit]}`
}
