import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSOCIATE_TIMEOUT_MS, browserPasskeyRespond, type PasskeyAsk } from '@/api/browser'
import { closePasskeyAsk } from '@/store'
import Frame from '@/components/elements/Frame'
import Button from '@/components/elements/Button'

const TITLE_ID = 'browser-passkey-title'

/**
 * A page wants a passkey made, or used. The site named is the rpId — what the
 * passkey belongs to — and the page that asked is shown under it, so a
 * subdomain asking for its parent's passkey is in plain sight. As with the
 * associate dialog, the answer goes straight back to Rust, Escape and the
 * backdrop count as a refusal, and nothing is awaited; the dialog leaves on
 * Rust's own clock, and its answer names the ask it was drawn for, so one
 * that outlives its ask cannot hand a yes to the next ceremony's.
 */
export default function PasskeyDialog({ ask }: { ask: PasskeyAsk }) {
  const { t } = useTranslation()

  useEffect(() => {
    const expiry = setTimeout(closePasskeyAsk, ASSOCIATE_TIMEOUT_MS)
    return () => clearTimeout(expiry)
  }, [ask.id])

  const answer = (allow: boolean) => {
    closePasskeyAsk()
    browserPasskeyRespond(ask.id, allow).catch(() => {})
  }
  const allow = () => answer(true)
  const deny = () => answer(false)

  const site = ask.rpId
  const account = ask.userName || ask.userDisplayName
  const title =
    ask.kind === 'get'
      ? t('{{site}} wants to sign in with your passkey', { site })
      : account
        ? t('{{site}} wants to create a passkey for {{account}}', { site, account })
        : t('{{site}} wants to create a passkey', { site })

  return (
    <Frame
      onClose={deny}
      labelledBy={TITLE_ID}
      testid="browser-passkey-modal"
      fit="content"
      className="w-dialog"
    >
      <div className="p-7">
        <h2
          id={TITLE_ID}
          data-testid="browser-passkey-title"
          className="text-lg font-semibold tracking-display"
        >
          {title}
        </h2>
        <p className="mt-1.5 text-base text-text2">
          {t('Asked by {{origin}} through the browser extension.', { origin: ask.origin })}
        </p>

        <div className="mt-5 flex items-center gap-2">
          <Button size="md" onClick={allow} testid="browser-passkey-allow">
            {t('Allow')}
          </Button>
          <Button variant="pale" size="md" onClick={deny} testid="browser-passkey-deny">
            {t('Deny')}
          </Button>
        </div>
      </div>
    </Frame>
  )
}
