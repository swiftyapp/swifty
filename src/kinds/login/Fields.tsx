import Panel from '@/components/elements/Panel'
import {
  EmailField,
  NoteField,
  OtpField,
  PasswordField,
  TagsField,
  UrlField,
  UsernameField,
  useFields
} from '@/components/elements/fields'

export default function Fields() {
  const { entry, set } = useFields()
  // The dial keeps its own column whenever there is a code to show — and
  // always while editing, since that is where an OTP gets added.
  const otp = !!set || !!entry.otp

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
          <PasswordField required />
          <EmailField />
          <NoteField label="Note" />
        </Panel>
        {otp && <OtpField />}
      </div>
      <TagsField />
    </>
  )
}
