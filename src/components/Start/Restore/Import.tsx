import { pickBackup } from '@/lib/commands'
import { t } from '@/i18n'
import Button from '@/components/elements/Button'

interface Props {
  display: boolean
  onImport: (path: string) => void
}

export default function Import({ display, onImport }: Props) {
  const chooseFile = () => {
    pickBackup().then(path => {
      if (path) onImport(path)
    })
  }

  if (!display) return null

  return (
    <div className="mx-auto w-72 max-w-full">
      <Button variant="ghost" onClick={chooseFile}>
        {t('Choose backup File')}
      </Button>
    </div>
  )
}
