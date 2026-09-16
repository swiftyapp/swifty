import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Mascot from '@/components/elements/Mascot'
import Button from '@/components/elements/Button'
import GoogleDriveMark from '@/components/elements/GoogleDriveMark'
import { LABEL } from '@/components/elements/tokens'
import { DiskGlyph } from '@/components/Main/icons'
import { isMobile } from '@/lib/platform'
import StepHeader from '../shared/StepHeader'
import RestoreAction from '../shared/RestoreAction'
import { COLUMN } from '../shared/layout'

interface Props {
  onFresh: () => void
  onDrive: () => void
  onFile: () => void
}

// The first screen of the first run. One thing to press if this is a new
// device and nothing else exists yet; below the rule, the two places the app's
// own data can already be. Three ways in and nothing else: what restoring
// asks for is said on the screen that asks for it. A phone has no file system
// to hand a backup from, so there it is Drive or nothing.
export default function Welcome({ onFresh, onDrive, onFile }: Props) {
  const { t } = useTranslation()

  return (
    <AuthShell>
      <div className="mb-6 flex justify-center">
        <Mascot />
      </div>

      <StepHeader
        eyebrow={t('Welcome')}
        title={t('Keep your secrets to yourself.')}
        body={t('Start fresh, or pick up where you left off on another device.')}
      />

      <div className={`${COLUMN} mt-8`}>
        <Button block testid="start-setup-button" onClick={onFresh}>
          {t('Start fresh')}
        </Button>
      </div>

      <div className={`${COLUMN} mt-6 flex items-center gap-3`}>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className={LABEL}>{t('Already using Rowel?')}</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>

      <div className={`${COLUMN} mt-3 flex flex-col gap-2`}>
        <RestoreAction
          mark={<GoogleDriveMark size={18} />}
          title={t('Continue with Google Drive')}
          body={t('Sync your data to this device.')}
          onClick={onDrive}
          testid="start-drive-button"
        />
        {!isMobile && (
          <RestoreAction
            mark={<DiskGlyph size={15} />}
            title={t('Restore from a backup file')}
            body={t('A .rowel backup saved on another device.')}
            muted
            onClick={onFile}
            testid="start-restore-button"
          />
        )}
      </div>
    </AuthShell>
  )
}
