import { t } from '@/i18n'
import { openLink } from '@/services/openLink'
import { useFavicon } from '@/hooks/useFavicon'
import { ExternalGlyph, GlobeGlyph } from '../../Main/icons'
import IconButton from '../IconButton'
import Field from './Field'
import { useField } from './context'
import { normalizeUrl } from './formats'

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export default function UrlField({ name = 'website', label = 'Website' }) {
  const { value } = useField(name)
  const icon = useFavicon(hostOf(value) || undefined)

  return (
    <Field
      name={name}
      label={label}
      placeholder="example.com"
      normalize={normalizeUrl}
      prefix={
        icon ? (
          <img src={icon} alt="" className="h-4 w-4 rounded-sm object-cover" />
        ) : (
          <GlobeGlyph size={14} />
        )
      }
      actions={
        value ? (
          <IconButton title={t('Open')} onClick={() => openLink(value)}>
            <ExternalGlyph />
          </IconButton>
        ) : undefined
      }
    />
  )
}
