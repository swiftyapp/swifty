import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { copy } from '@/services/copy'
import CopyButton from '@/components/elements/CopyButton'
import IconButton from '@/components/elements/IconButton'
import { HOVER_ONLY, ROW_HAIRLINE, VALUE } from '@/components/elements/tokens'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'
import type { EnvVar } from '../parse'
import { DOTS, KEY_COL, RAIL, STACK, STACK_KEY, STACK_RAIL, STACK_VALUE } from './styles'

interface Props {
  v: EnvVar
  revealed: boolean
  onReveal: () => void
}

// One variable, read. The detail row's geometry with the label column swapped
// for the key — shown as the user wrote it, since it is their identifier, not
// a label of ours — and the value masked until asked for. Every value is
// masked: a `PORT` in plain would be convenient, but guessing which names are
// secrets shows `DB_HOST=user:pass@…` on a shared screen when it guesses wrong.
export default function Row({ v, revealed, onReveal }: Props) {
  const { t } = useTranslation()
  const masked = !revealed

  return (
    <div className={cx('group flex items-center gap-3 px-3.5 py-3', ROW_HAIRLINE, STACK)}>
      <span
        data-testid={`env-key-${v.index}`}
        className={cx(KEY_COL, 'truncate text-text2', STACK_KEY)}
      >
        {v.key}
      </span>
      <div className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {/* The value IS the copy affordance, as in Field: a finger cannot
              hover a row to find the button. Masked, it hands over the real
              value, exactly as the button beside it does. */}
          <button
            type="button"
            aria-label={`${v.key} · ${t('Copy')}`}
            onClick={() => copy(v.value)}
            data-testid={`env-value-${v.index}`}
            className={cx(
              VALUE,
              'cursor-pointer text-left font-mono',
              masked ? 'text-text2' : 'text-text',
              STACK_VALUE
            )}
          >
            {masked ? DOTS : v.value}
          </button>
          {/* The trailing `# …` on the line. Unlike Field's gloss it is not
              derived from the value — it is the file's own annotation and says
              nothing about the secret — so it stays while the value is masked. */}
          {v.comment && (
            <span className="min-w-0 flex-none truncate text-base leading-6 text-text3">
              · {v.comment}
            </span>
          )}
        </span>
      </div>
      <div className={cx(RAIL, STACK_RAIL)}>
        <IconButton
          title={revealed ? t('Hide') : t('Reveal')}
          active={revealed}
          testid={`reveal-env-${v.index}`}
          onClick={onReveal}
        >
          {revealed ? <EyeOffGlyph /> : <EyeGlyph />}
        </IconButton>
        <span className={HOVER_ONLY}>
          <CopyButton value={v.value} title={t('Copy')} />
        </span>
      </div>
    </div>
  )
}
