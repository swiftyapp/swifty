import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Panel from '@/components/elements/Panel'
import {
  EmailField,
  FieldRow,
  NoteField,
  OtpField,
  PasskeysField,
  PasswordField,
  TagsField,
  UrlField,
  UsernameField,
  useFields
} from '@/components/elements/fields'
import { PlusGlyph } from '@/components/Main/icons'
import { hasPasskey } from './meta'

export default function Fields() {
  const { t } = useTranslation()
  const { entry, set } = useFields()
  const editing = !!set
  // The dial's column opens for a saved code, or once the editor asks for one.
  // Until then the panel keeps the read view's full width, so entering edit
  // does not reflow the rows. Sticky once open: clearing the box mid-edit must
  // not take the column away from under the caret. (Edit is keyed per entry,
  // so this never carries over to the next session.)
  const [opened, setOpened] = useState(!!entry.otp)
  const otp = editing ? opened : !!entry.otp
  // A passkey is a credential in its own right, so it lifts the password's
  // "Required" — read through `isValid`'s own test, or the row would complain
  // in red about a draft the save then lets through.
  const passkeys = hasPasskey(entry)

  return (
    <>
      <div
        className={
          otp ? 'grid grid-cols-[minmax(0,1fr)_208px] items-start gap-3' : 'grid gap-3'
        }
      >
        <Panel>
          <UrlField />
          <UsernameField required />
          <PasswordField required={!passkeys} />
          <EmailField />
          <NoteField label="Note" />
          {editing && !otp && (
            <FieldRow label="OTP">
              {id => (
                <button
                  id={id}
                  type="button"
                  data-testid="add-otp-button"
                  onClick={() => setOpened(true)}
                  className="flex h-6 cursor-pointer items-center gap-1.5 text-base text-accent hover:brightness-110"
                >
                  <PlusGlyph size={14} />
                  {t('Add one-time code')}
                </button>
              )}
            </FieldRow>
          )}
        </Panel>
        {otp && <OtpField autoFocus={editing && !entry.otp} />}
      </div>
      <PasskeysField />
      <TagsField />
    </>
  )
}
