import { UserGlyph } from '../../Main/icons'
import Field from './Field'

export default function UsernameField({
  name = 'username',
  label = 'Username',
  required
}: {
  name?: string
  label?: string
  required?: boolean
}) {
  return (
    <Field
      name={name}
      label={label}
      required={required}
      maxLength={40}
      placeholder="octocat"
      prefix={<UserGlyph size={14} />}
    />
  )
}
