import { AtGlyph } from '../../Main/icons'
import Field from './Field'
import { emailError } from './formats'

export default function EmailField({ name = 'email', label = 'Email' }) {
  return (
    <Field
      name={name}
      label={label}
      type="email"
      placeholder="name@example.com"
      prefix={<AtGlyph size={14} />}
      check={emailError}
    />
  )
}
