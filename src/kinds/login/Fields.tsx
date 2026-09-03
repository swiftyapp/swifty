import Panel from '@/components/elements/Panel'
import {
  EmailField,
  NoteField,
  OtpField,
  PasskeysField,
  PasswordField,
  TagsField,
  UrlField,
  UsernameField,
  useFields
} from '@/components/elements/fields'
import { hasPasskey } from './meta'

export default function Fields() {
  const { entry, set } = useFields()
  // The dial keeps its own column whenever there is a code to show — and
  // always while editing, since that is where an OTP gets added.
  const otp = !!set || !!entry.otp
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
        </Panel>
        {otp && <OtpField />}
      </div>
      <PasskeysField />
      <TagsField />
    </>
  )
}
