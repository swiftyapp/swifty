import { useTranslation } from 'react-i18next'
import { KeyGlyph, LoginGlyph } from '@/components/Main/icons'
import { useFavicon } from '@/hooks/useFavicon'
import Row, { type ContentProps } from '@/components/Main/Body/List/Item/Row'
import { listSubtitle } from './meta'

// A login row leads with the site's own favicon when one exists — real
// identity beats a generic globe. The glyph stands in while it loads or when
// the host has none, and only then is the tile kind-tinted.
//
// A login holding a passkey is marked beside its title, alongside the audit
// flag — read off the `hasPasskey` column, so the row never has to be decrypted
// to know.
export default function ListRow({ entry, flag }: ContentProps) {
  const { t } = useTranslation()
  const icon = useFavicon(entry.urlHost)

  return (
    <Row
      glyph={
        icon ? (
          <img src={icon} alt="" className="h-full w-full object-cover" />
        ) : (
          <LoginGlyph size={16} />
        )
      }
      tint={icon ? undefined : 'login'}
      title={entry.title}
      sub={listSubtitle(entry)}
      flag={
        <>
          {flag}
          {entry.hasPasskey && (
            <span
              title={t('Passkey')}
              data-testid="entry-item-passkey"
              className="flex-none text-text3"
            >
              <KeyGlyph size={12} />
            </span>
          )}
        </>
      }
    />
  )
}
