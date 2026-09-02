import { useCallback, useEffect } from 'react'
import { t } from '@/i18n'
import { copy } from '@/services/copy'
import Button from '@/components/elements/Button'
import IconButton from '@/components/elements/IconButton'
import type { GeneratorApply } from '@/store/generatorSlice'
import { RefreshGlyph } from '../icons'
import { useGenerator } from './useGenerator'
import Tabs from './Tabs'
import Output from './Output'
import Amount from './Amount'
import Toggles from './Toggles'

interface Props {
  apply: GeneratorApply | null
  onClose: () => void
}

// 470px overlay card: header with the mode tabs, the generated secret and its
// entropy, the shaping controls, then the action row. ⏎ confirms, Esc closes.
export default function Dialog({ apply, onClose }: Props) {
  const { settings, value, update, regenerate, bits, level } = useGenerator()

  const confirm = useCallback(() => {
    if (!value) return
    apply?.(value)
    copy(value)
    onClose()
  }, [apply, value, onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        confirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid animate-fade place-items-center bg-[var(--scrim)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Announces itself as modal like `elements/Modal` does. Beyond the
          a11y, this is what tells the window-level accelerators to stand down:
          `utils/dialogOpen` asks the DOM, so without the role the editor's Esc
          would close the edit session underneath this dialog. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generator-title"
        data-testid="generator-dialog"
        className="w-[470px] animate-pop overflow-hidden rounded-xl border border-line2 bg-detail text-text shadow-[var(--shadow)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-[18px] py-[15px] shadow-[inset_0_-1px_0_var(--c-line)]">
          <div id="generator-title" className="flex-1 text-lg font-semibold tracking-display">
            {t('Generate')}
          </div>
          <Tabs mode={settings.mode} onChange={mode => update({ mode })} />
        </div>
        <div className="p-[18px]">
          <Output value={value} bits={bits} level={level} />
          <Amount settings={settings} onChange={update} />
          <Toggles settings={settings} onChange={update} />
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
            <Button testid="generator-use-button" kbd="⏎" onClick={confirm}>
              {t('Use & copy')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
