import { useTranslation } from 'react-i18next'
import { useStore, closeReceive } from '@/store'
import Frame from '@/components/elements/Frame'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import Preview from './Preview'
import { useReceive } from './useReceive'

const TITLE_ID = 'share-receive-title'

/**
 * Opening someone else's link. No Google account is needed on this side — the
 * file is fetched by id and unsealed with the key the link carries.
 *
 * Two steps rather than one: what arrives is added to the vault only after it
 * has been looked at, because a link from a messenger is not yet a thing you
 * asked for.
 */
export default function Receive() {
  const { t } = useTranslation()
  const open = useStore(state => state.share.receiveOpen)
  const receive = useReceive()

  if (!open) return null

  return (
    <Frame
      onClose={closeReceive}
      labelledBy={TITLE_ID}
      testid="share-receive-modal"
      fit="content"
      className="flex max-h-[80vh] w-dialog"
    >
      <div className="@container w-full">
        <div className="p-7 @max-[500px]:p-5">
          <h2 id={TITLE_ID} className="text-lg font-semibold tracking-display">
            {t('Receive a shared secret')}
          </h2>
          <p className="mt-1.5 text-base text-text2">
            {t('What you add becomes your own entry — it does not stay in step with the sender.')}
          </p>

          {receive.entry ? (
            <Preview entry={receive.entry} />
          ) : (
            <textarea
              rows={3}
              value={receive.link}
              placeholder={t('Paste a share link')}
              aria-label={t('Paste a share link')}
              data-testid="share-link-input"
              onChange={event => receive.setLink(event.target.value)}
              className={`${inputClass} mt-5 h-auto resize-none py-2 font-mono select-text`}
            />
          )}

          {receive.error && (
            <p data-testid="share-receive-error" className="mt-2 text-base text-bad">
              {receive.error}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2">
            {receive.entry ? (
              <Button
                size="md"
                loading={receive.busy}
                onClick={receive.add}
                testid="share-add-button"
              >
                {t('Add to vault')}
              </Button>
            ) : (
              <Button
                size="md"
                disabled={!receive.link.trim()}
                loading={receive.busy}
                onClick={receive.open}
                testid="share-open-button"
              >
                {t('Open')}
              </Button>
            )}
            <Button
              variant="pale"
              size="md"
              onClick={closeReceive}
              testid="share-cancel-button"
            >
              {t('Cancel')}
            </Button>
          </div>
        </div>
      </div>
    </Frame>
  )
}
