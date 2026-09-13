import type { Entry, EntryType } from '@/lib/commands'

/**
 * Which of each kind's fields hold a secret — the same set the vault seals
 * separately from the rest of the payload.
 *
 * It lives with the kind registry rather than at the one call site so the fact
 * stays where every other per-kind fact is. It is deliberately *not* a `Kind`
 * member yet: the only reader so far counts them, and a count is not worth six
 * kind objects growing a field.
 */
const SECRET_FIELDS: Record<EntryType, string[]> = {
  login: ['password', 'otp'],
  note: ['note'],
  card: ['number', 'cvc', 'pin'],
  identity: ['number', 'personal_number'],
  ssh: ['privateKey', 'passphrase'],
  env: ['body']
}

/**
 * How many secrets an entry actually carries — for a surface that must say
 * there is something inside without showing any of it (the share preview).
 * Empty fields do not count: an entry with no OTP is not hiding one.
 */
export const secretFieldCount = (entry: Entry): number => {
  const values = entry as unknown as Record<string, unknown>
  return SECRET_FIELDS[entry.type].filter(field => !!values[field]).length
}
