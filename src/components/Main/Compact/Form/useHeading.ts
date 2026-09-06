import { useTranslation } from 'react-i18next'
import type { EntryMeta, EntryType } from '@/lib/commands'
import { kindOf } from '@/kinds'

/**
 * What the form's nav row is titled: a new entry by what it will be, an
 * existing one by what it is.
 *
 * Shared between the editor and the frame held in front of it, so the same
 * entry is not named two different things on the way into edit.
 */
export function useHeading(type: EntryType, entry?: EntryMeta) {
  const { t } = useTranslation()
  const kind = kindOf(type)
  return entry ? entry.title || t(kind.untitledLabel) : t(kind.addLabel)
}
