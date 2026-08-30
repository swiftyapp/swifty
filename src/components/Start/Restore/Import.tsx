import { pickBackup } from '@/lib/commands'
import { t } from '@/i18n'
import Back from '@/assets/images/back.svg?react'

interface Props {
  display: boolean
  onImport: (path: string) => void
  goBack: () => void
}

export default function Import({ display, onImport, goBack }: Props) {
  const chooseFile = () => {
    pickBackup().then(path => {
      if (path) onImport(path)
    })
  }

  if (!display) return null

  return (
    <>
      <div className="button choose-file" onClick={chooseFile}>
        {t('Choose backup File')}
      </div>
      <br />
      <span className="navigate-back" onClick={goBack}>
        <Back width="15" /> {t('Go Back')}
      </span>
    </>
  )
}
