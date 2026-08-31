import { useStore } from '@/store'
import { t } from '@/i18n'
import type { Section } from './Navigation'

interface Props {
  section: Section
}

export default function Updates({ section }: Props) {
  const checking = useStore(state => state.update.status === 'checking')
  const runUpdateCheck = useStore(state => state.runUpdateCheck)

  if (section !== 'updates') return null

  return (
    <>
      <h1>{t('Updates')}</h1>
      <div className="section">
        <strong>{t('Automatic Updates')}</strong>
        <div>{t('Updates download in the background and apply when you restart.')}</div>
        <div className="button" onClick={checking ? undefined : () => runUpdateCheck()}>
          {checking ? t('Checking…') : t('Check for Updates')}
        </div>
      </div>
    </>
  )
}
