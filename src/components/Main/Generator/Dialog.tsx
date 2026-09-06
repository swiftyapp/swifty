import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import IconButton from '@/components/elements/IconButton'
import Frame from '@/components/elements/Frame'
import type { GeneratorApply, SshApply } from '@/store/generatorSlice'
import { RefreshGlyph } from '../icons'
import { useGeneratorDialog } from './useGeneratorDialog'
import { useDialogKeys } from './useDialogKeys'
import Tabs from './Tabs'
import Panel from './Panel'

interface Props {
  apply: GeneratorApply | null
  ssh: SshApply | null
  onClose: () => void
}

// 470px overlay card: header with the mode tabs, the generated secret and its
// entropy, the shaping controls, then the action row. ⏎ confirms, Esc closes.
export default function Dialog({ apply, ssh, onClose }: Props) {
  const { t } = useTranslation()
  const generator = useGeneratorDialog(apply, ssh, onClose)
  const { mode, setMode, keys, key, regenerate, confirm, confirmLabel } = generator
  const cardRef = useRef<HTMLDivElement>(null)
  useDialogKeys(cardRef, confirm, onClose)

  // The card carries its own title row and its own Cancel, so the frame adds no
  // chrome of its own. It takes `cardRef` too, so the topmost-dialog check
  // still finds itself.
  return (
    <Frame
      ref={cardRef}
      onClose={onClose}
      labelledBy="generator-title"
      testid="generator-dialog"
      className="w-dialog-sm"
      align="center"
      hideClose
    >
      <div className="flex items-center gap-2.5 px-[18px] py-[15px] inset-shadow-hairline">
        <div id="generator-title" className="flex-1 text-lg font-semibold tracking-display">
          {t('Generate')}
        </div>
        {/* Opened for a key, there is nothing to switch to. */}
        {!ssh && <Tabs mode={mode} ssh={!apply} onChange={setMode} />}
      </div>
      <div className="p-[18px]">
        <Panel generator={generator} />
        <div className="mt-[18px] flex items-center gap-1.5">
          <IconButton
            title={t('Regenerate')}
            testid="generator-regenerate"
            onClick={regenerate}
            className="h-9 w-9 border border-line2 hover:border-accent-line"
          >
            <RefreshGlyph />
          </IconButton>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            testid="generator-use-button"
            kbd="⏎"
            onClick={confirm}
            disabled={keys && !key.ready}
          >
            {t(confirmLabel)}
          </Button>
        </div>
      </div>
    </Frame>
  )
}
