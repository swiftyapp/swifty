import { useTranslation } from 'react-i18next'
import { pickBackup } from '@/lib/commands'
import Button from '@/components/elements/Button'

interface Props {
  display: boolean
  onImport: (path: string) => void
}

export default function Import({ display, onImport }: Props) {
  const { t } = useTranslation()
  const chooseFile = () => {
    pickBackup().then(path => {
      if (path) onImport(path)
    })
  }

  if (!display) return null

  return (
    <div className="mx-auto w-72 max-w-full">
      <Button block variant="ghost" onClick={chooseFile}>
        {t('Choose backup File')}
      </Button>
    </div>
  )
}
