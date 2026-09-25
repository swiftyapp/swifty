import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pickImportFile } from '@/api/pickers'
import { useWebviewDragDrop } from '@/hooks/useWebviewDragDrop'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import { UploadGlyph } from '../../../../icons'

interface Props {
  onDrop: (path: string) => void
}

// The import section's lead: any export file, dropped or chosen, with the
// backend sniffing its format. The picker button is there on every platform —
// a drop is the shortcut, not the only way in (and on a phone, no way at all).
// Lights up while a file is held over the window, so the drop has somewhere
// visible to land.
export default function HeroDropZone({ onDrop }: Props) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)

  useWebviewDragDrop(payload => {
    if (payload.type === 'leave') setOver(false)
    else if (payload.type === 'drop') {
      setOver(false)
      const [path] = payload.paths
      if (path) onDrop(path)
    } else setOver(true)
  })

  const pick = () =>
    pickImportFile()
      .then(path => {
        if (path) onDrop(path)
      })
      .catch(() => {})

  return (
    <div
      data-testid="import-dropzone"
      data-over={over || undefined}
      className={cx(
        'flex flex-col items-center rounded-xl border-[1.5px] border-dashed px-5 py-6 text-center transition-colors',
        over ? 'border-accent-line bg-accent-soft' : 'border-line2 bg-field hover:border-accent-line'
      )}
    >
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent-soft text-accent">
        <UploadGlyph size={20} />
      </div>
      <div className="mt-3 text-md font-semibold tracking-display text-text">
        {t('Drop an export file')}
      </div>
      <p className="mt-1 max-w-[360px] text-base text-text2">
        {t('We detect the format automatically. Parsed on this device, never uploaded.')}
      </p>
      <Button
        variant="pale"
        size="md"
        className="mt-4"
        onClick={() => void pick()}
        testid="import-choose-file"
      >
        {t('Choose file…')}
      </Button>
    </div>
  )
}
