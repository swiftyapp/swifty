import { useTranslation } from 'react-i18next'
import { closeSend } from '@/store'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import { CheckGlyph, CopyGlyph } from '../../icons'
import type { Send } from './useSend'

// The link, once there is one — and the two states on the way to it.
export default function LinkPanel({ send }: { send: Send }) {
  const { t } = useTranslation()

  // Nothing was published, so there is nothing to show but the reason and the
  // two ways out of it. Retrying here is retrying the seal, which is the only
  // thing that failed.
  if (send.failed?.op === 'create')
    return (
      <div className="mt-5">
        <p data-testid="share-send-error" className="text-base text-bad">
          {send.failed.message}
        </p>
        <div className="mt-5 flex items-center gap-2">
          <Button size="md" loading={send.busy} onClick={send.create} testid="share-retry-button">
            {t('Try again')}
          </Button>
          <Button variant="pale" size="md" onClick={closeSend} testid="share-close-button">
            {t('Close')}
          </Button>
        </div>
      </div>
    )

  if (!send.share)
    return (
      <p data-testid="share-send-loading" className="mt-5 text-base text-text2">
        {t('Sealing this entry…')}
      </p>
    )

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        {/* Read-only rather than disabled: the point of the field is that the
            link can be selected out of it by hand when the button is not how
            someone wants to take it. `select-text` because the shell as a
            whole is `select-none`. */}
        <input
          readOnly
          value={send.share.link}
          data-testid="share-link"
          aria-label={t('Share link')}
          onFocus={event => event.target.select()}
          className={`${inputClass} font-mono select-text`}
        />
        <Button size="md" className="flex-none" onClick={send.copy} testid="share-copy-button">
          {send.copied ? (
            <>
              <CheckGlyph />
              {t('Copied')}
            </>
          ) : (
            <>
              <CopyGlyph />
              {t('Copy')}
            </>
          )}
        </Button>
      </div>

      <p className="mt-3 text-base text-text2">{t('Expires in 24 hours')}</p>
      <p className="mt-1 text-base text-text3">
        {t('Anyone with this link can open it until then. Send it over a channel you trust.')}
      </p>

      <div className="mt-6 flex items-center gap-2 border-t border-line pt-4">
        <Button
          variant="pale"
          size="md"
          className="text-bad hover:text-bad"
          loading={send.busy}
          onClick={send.revoke}
          testid="share-revoke-button"
        >
          {t('Revoke link')}
        </Button>
        <Button variant="pale" size="md" onClick={closeSend} testid="share-close-button">
          {t('Close')}
        </Button>
      </div>

      {/* A revoke that failed leaves the link live, so the link stays on screen
          and the button that failed is the button that tries again. */}
      {send.failed?.op === 'revoke' && (
        <p data-testid="share-send-error" className="mt-2 text-base text-bad">
          {send.failed.message}
        </p>
      )}
    </div>
  )
}
