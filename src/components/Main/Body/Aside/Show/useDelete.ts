import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteEntry } from '@/store'

// Archiving the entry on screen, with the one thing that can go wrong. Both
// shells put the trigger in a different place (a menu item on the desktop, the
// same menu in the phone's nav row) and the complaint in a different place too,
// so the pair travels together rather than living in either header.
export function useDelete(id: string) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)

  const remove = () => {
    setError(null)
    deleteEntry(id).catch(() => setError(t('Could not delete. Please try again.')))
  }

  return { error, remove }
}
