import { useCopied } from '@/hooks/useCopied'
import { t } from '@/i18n'
import IconButton from './IconButton'
import { CheckGlyph, CopyGlyph } from '../Main/icons'

export default function CopyButton({ value, title }: { value: string; title?: string }) {
  const { copied, copy } = useCopied()
  return (
    <IconButton title={copied ? t('Copied') : title} onClick={() => copy(value)}>
      {copied ? <CheckGlyph className="text-good" /> : <CopyGlyph />}
    </IconButton>
  )
}
