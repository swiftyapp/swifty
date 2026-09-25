import { useTranslation } from 'react-i18next'
import Checkbox from '@/components/elements/Checkbox'
import { AlertGlyph } from '../../../../../icons'

interface Props {
  acknowledged: boolean
  onAcknowledge: (next: boolean) => void
}

// Every format here is plaintext, CXF included, so one warning covers the lot
// — and the export waits on it being read.
export default function Warning({ acknowledged, onAcknowledge }: Props) {
  const { t } = useTranslation()
  return (
    <div className="mt-3.5 flex gap-3 rounded-lg border border-warn/30 bg-warn/10 p-4">
      <AlertGlyph size={17} className="mt-px flex-none text-warn" />
      <div className="min-w-0">
        <div className="text-base font-semibold text-text">
          {t("This file won't be encrypted")}
        </div>
        <p className="mt-1 text-base text-text2">
          {t(
            "Anyone who opens it can read every password, note and card. Delete it once it's imported elsewhere."
          )}
        </p>
        <div className="mt-3">
          <Checkbox
            checked={acknowledged}
            onChange={onAcknowledge}
            testid="settings-export-ack"
          >
            {t('I understand the risk')}
          </Checkbox>
        </div>
      </div>
    </div>
  )
}
