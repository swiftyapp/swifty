import { useTranslation } from 'react-i18next'
import { MONO_LABEL } from '@/components/elements/tokens'
import { useImport } from './useImport'
import Tiles from './Tiles'
import DropZone from './DropZone'
import Result from './Result'

export default function Import() {
  const { t } = useTranslation()
  const flow = useImport()
  const active =
    flow.picked === null
      ? null
      : flow.picked.kind === 'swftx'
        ? 'swftx'
        : flow.picked.format

  return (
    <div className="flex flex-col gap-4">
      <div className={MONO_LABEL}>{t('Bring secrets from')}</div>
      <Tiles
        active={active}
        disabled={flow.running}
        onFormat={flow.chooseFile}
        onBackup={flow.chooseBackup}
      />
      <Result flow={flow} />
      <DropZone onDrop={flow.dropped} />
      <p className="text-base text-text2">
        {t('Imports are merged. Existing items are never overwritten.')}
      </p>
    </div>
  )
}
