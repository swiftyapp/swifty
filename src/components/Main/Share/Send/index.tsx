import { useTranslation } from 'react-i18next'
import { useStore, closeSend } from '@/store'
import Frame from '@/components/elements/Frame'
import Button from '@/components/elements/Button'
import LinkPanel from './LinkPanel'
import { useSend } from './useSend'

const TITLE_ID = 'share-send-title'

/**
 * Sending one entry: the app seals it, puts it in the sender's own Drive, and
 * gives back a link that carries the key. Google holds ciphertext it has no way
 * to read, and the recipient needs no account of their own.
 *
 * `fit="content"` for the same reason the kind picker asks for it: a link, two
 * lines of copy and three buttons are short enough to answer from the bottom
 * edge of a phone rather than taking the whole screen.
 */
export default function Send() {
  const { t } = useTranslation()
  const entryId = useStore(state => state.share.sendFor)
  const send = useSend(entryId)

  if (!entryId) return null

  return (
    <Frame
      onClose={closeSend}
      labelledBy={TITLE_ID}
      testid="share-send-modal"
      fit="content"
      className="flex max-h-[80vh] w-dialog"
    >
      <div className="@container w-full">
        <div className="p-7 @max-[500px]:p-5">
          <h2 id={TITLE_ID} className="text-lg font-semibold tracking-display">
            {t('Share this entry')}
          </h2>

          {send.connected ? (
            <>
              <p className="mt-1.5 text-base text-text2">
                {t('Sealed with a key that travels in the link, not on Google Drive.')}
              </p>
              <LinkPanel send={send} />
            </>
          ) : (
            // No fallback way out: the share *is* a file in the sender's Drive,
            // so there is nothing to offer someone who has not connected one.
            <>
              <p className="mt-1.5 text-base text-text2" data-testid="share-needs-drive">
                {t('Connect Google Drive to share')}
              </p>
              <p className="mt-1 text-base text-text3">
                {t('A shared entry is a sealed file in your own Drive.')}
              </p>
              <div className="mt-5">
                <Button variant="pale" size="md" onClick={closeSend} testid="share-close-button">
                  {t('Close')}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Frame>
  )
}
