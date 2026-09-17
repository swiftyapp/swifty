import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import { META_TYPE } from '@/components/elements/tokens'
import { selectedDriveFile, useApp } from '@/store'
import StepHeader from '../shared/StepHeader'
import FoundFileCard from '../shared/FoundFileCard'
import { COLUMN, ACTIONS, FOOTNOTE } from '../shared/layout'
import { describeDriveFile } from '../shared/describe'
import { useDates } from '@/hooks/useDates'
import { describeError } from '@/api/errors'

interface Props {
  /** Open the data that is already there, rather than the one just chosen. */
  onUnlockExisting: () => void
  /** Keep the new password; the old pack is renamed, never overwritten. */
  onArchive: () => Promise<void>
}

// The one place the flow has to stop and ask. Two sealed packs cannot be
// merged — they are sealed with different keys — so this is the last moment
// the choice is still free, and both ways out of it are spelled out plainly.
export default function Conflict({ onUnlockExisting, onArchive }: Props) {
  const { t } = useTranslation()
  const dates = useDates()
  // The vault this question is about: the one the flow has selected, which on
  // the ordinary single-vault account is simply the only one. Archiving takes
  // the same file, so what is described and what is set aside cannot differ.
  const file = useApp(selectedDriveFile)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const archive = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    onArchive().catch((err: unknown) => {
      setBusy(false)
      setError(describeError(err) || t('Something went wrong'))
    })
  }

  return (
    <>
      <StepHeader
        eyebrow={t('Hold on')}
        tone="warn"
        title={t('This Drive already has Rowel data')}
        body={t(
          "It's sealed with its own master password. If you continue with the new one, the two can't be merged later."
        )}
      />

      {file && (
        <div className={`${COLUMN} mt-9`}>
          <FoundFileCard
            where="drive"
            testid="setup-conflict-file"
            name={t('Rowel vault')}
            meta={describeDriveFile(file, dates)}
            encrypted
          />
        </div>
      )}

      <div className={ACTIONS}>
        <Button block testid="setup-unlock-existing-button" onClick={onUnlockExisting}>
          {t('Unlock it instead')}
        </Button>
        <Button
          block
          variant="pale"
          testid="setup-archive-button"
          loading={busy}
          onClick={archive}
        >
          {t('Start fresh, archive the old one')}
        </Button>
      </div>

      <p className={`${FOOTNOTE} ${META_TYPE} ${error ? 'text-bad' : 'text-text2'}`}>
        {error ?? t('Archiving renames it in the same Drive folder. Nothing is deleted.')}
      </p>
    </>
  )
}
