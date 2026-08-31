import { useStore } from '@/store'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import Button from '@/components/elements/Button'
import { H1, Section as Row, LABEL, DESC } from './ui'

interface Props {
  section: Section
}

export default function Updates({ section }: Props) {
  const checking = useStore(state => state.update.status === 'checking')
  const runUpdateCheck = useStore(state => state.runUpdateCheck)

  if (section !== 'updates') return null

  return (
    <>
      <h1 className={H1}>{t('Updates')}</h1>
      <Row>
        <strong className={LABEL}>{t('Automatic Updates')}</strong>
        <p className={DESC}>
          {t('Updates download in the background and apply when you restart.')}
        </p>
        <div>
          <Button loading={checking} onClick={() => runUpdateCheck()}>
            {checking ? t('Checking…') : t('Check for Updates')}
          </Button>
        </div>
      </Row>
    </>
  )
}
