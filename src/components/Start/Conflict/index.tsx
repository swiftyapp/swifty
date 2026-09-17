import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import { META_TYPE } from '@/components/elements/tokens'
import FoundFileCard from '@/components/elements/FoundFileCard'
import { selectedDriveFile, useApp } from '@/store'
import StepHeader from '../shared/StepHeader'
import { COLUMN, ACTIONS, FOOTNOTE } from '../shared/layout'
import { describeDriveFile } from '@/utils/drivePack'
import { useDates } from '@/hooks/useDates'
import { describeError } from '@/api/errors'

interface Props {
  /** Open the data that is already there, rather than the one just chosen. */
  onUnlockExisting: () => void
  /** Keep the new password; the vault already up there is left untouched. */
  onStartFresh: () => Promise<void>
}

// The one place the flow has to stop and ask. Two sealed packs cannot be
// merged — they are sealed with different keys — so the user picks which vault
// this device is. Neither answer costs them the other: a new vault takes an id
// of its own and syncs to its own pack, so the one already in the account stays
// there, restorable on any device that knows its password.
export default function Conflict({ onUnlockExisting, onStartFresh }: Props) {
  const { t } = useTranslation()
  const dates = useDates()
  // The vault this question is about: the one the flow has selected, which on
  // the ordinary single-vault account is simply the only one. Archiving takes
  // the same file, so what is described and what is set aside cannot differ.
  const file = useApp(selectedDriveFile)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const startFresh = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    onStartFresh().catch((err: unknown) => {
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
          "It's sealed with its own master password, so the two can't be merged. Restore that vault here, or start a new one beside it."
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
          testid="setup-start-fresh-button"
          loading={busy}
          onClick={startFresh}
        >
          {t('Start a new vault')}
        </Button>
      </div>

      <p className={`${FOOTNOTE} ${META_TYPE} ${error ? 'text-bad' : 'text-text2'}`}>
        {error ?? t('The vault already there is left untouched; the new one syncs beside it.')}
      </p>
    </>
  )
}
