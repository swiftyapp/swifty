export type DateFormat = 'MM/DD/YYYY' | 'DD.MM.YYYY' | 'YYYY-MM-DD'

export const DATE_FORMATS: DateFormat[] = ['MM/DD/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD']

const KEY = 'swifty:dateFormat'

export const DEFAULT_DATE_FORMAT: DateFormat = 'MM/DD/YYYY'

const isFormat = (value: string | null): value is DateFormat =>
  !!value && (DATE_FORMATS as string[]).includes(value)

export const getFormat = (): DateFormat => {
  const stored = localStorage.getItem(KEY)
  return isFormat(stored) ? stored : DEFAULT_DATE_FORMAT
}

export const setFormat = (format: DateFormat) => localStorage.setItem(KEY, format)
