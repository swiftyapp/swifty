import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Button from '@/components/elements/Button'
import { META_TYPE } from '@/components/elements/tokens'
import { useApp, setupDriveReset } from '@/store'
import StepHeader from '../shared/StepHeader'
import BenefitsCard from '../shared/BenefitsCard'
import SpinnerCard from '../shared/SpinnerCard'
import { COLUMN, ACTIONS, FOOTNOTE } from '../shared/layout'
import { describeError } from '@/api/errors'
import { connectDrive } from '../shared/driveSession'

interface Props {
  onBack: () => void
  /** Create the data here and now, with sync on if consent already landed. */
  onCreate: () => Promise<void>
  /** The probe found data in this Drive: that is a decision, not a step. */
  onConflict: () => void
}

// Step two of a fresh start: where the backup lives. Connecting is also how we
// find out whether this Google account already holds data — so the answer to
// the probe, not the press, is what decides where this goes next.
export default function Sync({ onBack, onCreate, onConflict }: Props) {
  const { t } = useTranslation()
  const drive = useApp(state => state.setupDrive)
  const [error, setError] = useState<string | null>(null)
  // Creating is in flight. Both buttons go inert on it: a second press would
  // ask the backend to create again, and while the backend now refuses the
  // overlap, the refusal would land here as an error over a create that is
  // about to succeed.
  const [busy, setBusy] = useState(false)
  // The probe answers once. Without this the effect would re-fire on every
  // render the status outlives — and create the data twice.
  const settled = useRef(false)

  const fail = (message: string) => {
    setError(message)
    setupDriveReset()
  }

  // One entry point for both ways a create starts (a press, or the probe
  // coming back empty), so neither can start one while the other is running.
  const create = useCallback(
    (onError: (message: string) => void) => {
      if (busy) return
      setBusy(true)
      setError(null)
      onCreate().catch((err: unknown) => {
        setBusy(false)
        onError(describeError(err) || t('Something went wrong'))
      })
    },
    [busy, onCreate, t]
  )

  useEffect(() => {
    if (settled.current) return

    if (drive.status === 'empty') {
      // A bare account: nothing to weigh up, so this is the last step.
      settled.current = true
      create(message => {
        settled.current = false
        fail(message)
      })
    } else if (drive.status === 'found') {
      settled.current = true
      onConflict()
    } else if (drive.status === 'error') {
      fail(drive.error || t('Something went wrong'))
    }
  }, [drive.status, drive.error, create, onConflict, t])

  const connect = () => {
    if (busy) return
    setError(null)
    connectDrive()
  }

  if (drive.status === 'pending')
    return (
      <AuthShell onBack={onBack}>
        <StepHeader
          eyebrow={t('Get started · 2 of 2')}
          busy
          title={t('Connecting to Google Drive…')}
        />
        <div className={`${COLUMN} mt-9`}>
          <SpinnerCard
            testid="setup-drive-spinner"
            caption={t('Checking for existing data first')}
          />
        </div>
      </AuthShell>
    )

  return (
    <AuthShell onBack={onBack}>
      <StepHeader
        eyebrow={t('Get started · 2 of 2')}
        title={t('Back up to Google Drive')}
        body={t(
          "Your encrypted data syncs to Google Drive, so a lost device isn't lost secrets. Only you can read it: your master password never leaves this device."
        )}
      />

      <div className={`${COLUMN} mt-9`}>
        <BenefitsCard
          items={[
            t('Encrypted before it leaves this device'),
            t('Other devices unlock with the same master password'),
            t('Switch off any time in Settings')
          ]}
        />
      </div>

      <div className={ACTIONS}>
        <Button block testid="setup-connect-drive-button" disabled={busy} onClick={connect}>
          {t('Connect Google Drive')}
        </Button>
        <Button
          block
          variant="pale"
          testid="setup-skip-drive-button"
          loading={busy}
          onClick={() => create(setError)}
        >
          {t('Keep it on this device')}
        </Button>
      </div>

      {error && (
        <p data-testid="setup-drive-error" className={`${FOOTNOTE} ${META_TYPE} text-bad`}>
          {error}
        </p>
      )}
    </AuthShell>
  )
}
