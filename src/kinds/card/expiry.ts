/**
 * One "MM/YY" box instead of a Month field and a Year field: the way it is
 * printed on the card is the way it gets typed, and the vault still stores the
 * two columns it always had.
 */

/** What the box shows for the stored pair. Tolerates a legacy 4-digit year. */
export const formatExpiry = (month: string, year: string): string => {
  const mm = month.replace(/\D/g, '').slice(0, 2)
  const yy = year.replace(/\D/g, '').slice(-2)
  // Pre-redesign cards stored an unpadded month ("3"), which `splitExpiry`
  // would re-read positionally as month "32" on the first keystroke. Padding
  // the complete form makes the round-trip lossless. A month still being typed
  // has no year yet, so this never fights the caret.
  return yy ? `${mm.padStart(2, '0')}/${yy}` : mm
}

/**
 * Whether the stored pair is behind us. A card is good through the last day of
 * its month, and the year is two digits — so the century is the one we are in,
 * which is the only reading that makes sense for a card in a wallet.
 */
export const isExpired = (month: string, year: string, now: number = Date.now()): boolean => {
  const mm = Number(month.replace(/\D/g, ''))
  const yy = year.replace(/\D/g, '').slice(-2)
  if (!mm || mm > 12 || yy.length !== 2) return false

  const century = Math.floor(new Date(now).getFullYear() / 100) * 100
  // Month index `mm` is the month *after* the printed one: the first instant
  // the card is no longer good.
  return now >= new Date(century + Number(yy), mm, 1).getTime()
}

/** Splits whatever is in the box back into the pair, digit by typed digit. */
export const splitExpiry = (typed: string): { month: string; year: string } => {
  const digits = typed.replace(/\D/g, '').slice(0, 4)
  return { month: digits.slice(0, 2), year: digits.slice(2) }
}
