import { useTranslation } from 'react-i18next'
import CopyButton from '@/components/elements/CopyButton'
import Panel from '@/components/elements/Panel'
import { Field, FieldRow, NoteField, useFields } from '@/components/elements/fields'
import { filled } from '@/components/elements/fields/formats'
import { HOVER_ONLY, VALUE } from '@/components/elements/tokens'
import { cx } from '@/utils/cx'
import Face from '../Face'
import { parsePublicKey } from '../keyInfo'
import PrivateBlock from './PrivateBlock'

/**
 * An SSH key read as an object: the fingerprint plate (see `Face`) beside the
 * public half — the line, the comment it ends in, the passphrase kept with it —
 * and the private key sealed under them. On a pane too narrow for both columns
 * the plate goes on top. The note, when there is one, takes a panel of its own
 * under the lot.
 */
export default function Read() {
  const { t } = useTranslation()
  const { entry } = useFields()
  const publicKey = filled(entry.publicKey) ? entry.publicKey : ''
  const { comment } = parsePublicKey(publicKey)
  const plate = filled(entry.fingerprint)
  const rows = publicKey !== '' || filled(entry.passphrase)

  return (
    <div className="grid gap-3">
      <div
        className={cx(
          'grid items-start gap-3',
          plate && '@min-[640px]:grid-cols-[250px_minmax(0,1fr)]'
        )}
      >
        {plate && <Face />}
        <div className="grid gap-3">
          {rows && (
            <Panel>
              <Field name="publicKey" label="Public key" />
              {comment && (
                <FieldRow
                  label="Comment"
                  actions={
                    <span className={HOVER_ONLY}>
                      <CopyButton value={comment} title={t('Copy')} />
                    </span>
                  }
                >
                  {() => (
                    <span className={`${VALUE} text-text`} data-testid="entry-value-comment">
                      {comment}
                    </span>
                  )}
                </FieldRow>
              )}
              <Field name="passphrase" label="Passphrase" secure />
            </Panel>
          )}
          <PrivateBlock />
        </div>
      </div>
      {filled(entry.note) && (
        <Panel>
          <NoteField label="Note" />
        </Panel>
      )}
    </div>
  )
}
