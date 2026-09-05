import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copy } from '@/services/copy'
import Button from '@/components/elements/Button'
import IconButton from '@/components/elements/IconButton'
import { startEntry } from '@/store'
import type { GeneratorApply, SshApply } from '@/store/generatorSlice'
import { RefreshGlyph } from '../icons'
import { useGenerator } from './useGenerator'
import Tabs, { type DialogMode } from './Tabs'
import Output from './Output'
import Amount from './Amount'
import Toggles from './Toggles'
import Ssh from './Ssh'
import { useSshKey } from './Ssh/useSshKey'

interface Props {
  apply: GeneratorApply | null
  ssh: SshApply | null
  onClose: () => void
}

// 470px overlay card: header with the mode tabs, the generated secret and its
// entropy, the shaping controls, then the action row. ⏎ confirms, Esc closes.
export default function Dialog({ apply, ssh, onClose }: Props) {
  const { t } = useTranslation()
  const { settings, value, update, regenerate, bits, level } = useGenerator()
  // Opened off the ssh private-key row, the dialog is that one job — otherwise
  // it starts on whatever password mode the settings remember.
  const [mode, setMode] = useState<DialogMode>(ssh ? 'ssh' : settings.mode)
  const key = useSshKey(mode === 'ssh')
  const cardRef = useRef<HTMLDivElement>(null)
  const keys = mode === 'ssh'

  // A keypair fills a whole draft, so standalone it opens a new entry rather
  // than landing on the clipboard the way a password does. While a draw is in
  // flight (or has failed) ⏎ does nothing: the pair on screen is the one the
  // user asked to replace, not the one they'd be saving.
  const confirm = useCallback(() => {
    if (keys) {
      if (!key.ready || !key.pair) return
      if (ssh) ssh(key.pair)
      else startEntry('ssh', key.pair)
      onClose()
      return
    }
    if (!value) return
    apply?.(value)
    copy(value)
    onClose()
  }, [keys, key.ready, key.pair, ssh, apply, value, onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Something nearer the key already handled it (a field's own Esc, the
      // palette's ⏎) — acting again would fire two things off one press.
      if (event.defaultPrevented) return
      // Only the topmost dialog answers: the generator can sit under a palette
      // opened over it, and ⏎ there belongs to the palette's command.
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs[dialogs.length - 1] !== cardRef.current) return

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
      className="fixed inset-0 z-50 grid animate-fade place-items-center bg-scrim p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Announces itself as modal like `elements/Modal` does. Beyond the
          a11y, this is what tells the window-level accelerators to stand down:
          `utils/dialogOpen` asks the DOM, so without the role the editor's Esc
          would close the edit session underneath this dialog. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="generator-title"
        data-testid="generator-dialog"
        className="w-[470px] animate-pop overflow-hidden rounded-xl border border-line2 bg-detail text-text shadow-float"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-[18px] py-[15px] inset-shadow-hairline">
          <div id="generator-title" className="flex-1 text-lg font-semibold tracking-display">
            {t('Generate')}
          </div>
          {/* Opened for a key, there is nothing to switch to. */}
          {!ssh && (
            <Tabs
              mode={mode}
              ssh={!apply}
              onChange={next => {
                setMode(next)
                if (next !== 'ssh') update({ mode: next })
              }}
            />
          )}
        </div>
        <div className="p-[18px]">
          {keys ? (
            <Ssh
              pair={key.pair}
              pending={key.pending}
              error={key.error}
              onRetry={key.regenerate}
              comment={key.comment}
              onComment={key.setComment}
            />
          ) : (
            <>
              <Output value={value} bits={bits} level={level} />
              <Amount settings={settings} onChange={update} />
              <Toggles settings={settings} onChange={update} />
            </>
          )}
          <div className="mt-[18px] flex items-center gap-1.5">
            <IconButton
              title={t('Regenerate')}
              testid="generator-regenerate"
              onClick={keys ? key.regenerate : regenerate}
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
              {keys ? (ssh ? t('Use') : t('Save as SSH key')) : t('Use & copy')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
