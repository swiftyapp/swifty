const BASE32 = /^[A-Z2-7]{8,}$/

/** The `secret` parameter of an otpauth:// URI, whatever case it was spelled in. */
const secretParam = (query: string): string => {
  for (const [key, value] of new URLSearchParams(query)) {
    if (key.toLowerCase() === 'secret') return value
  }
  return ''
}

/**
 * The TOTP secret carried by whatever was pasted: a bare base32 string, or the
 * `otpauth://totp/...?secret=...` URI behind every enrolment QR code. Returns
 * '' when there is no usable secret in there — the field's validity test.
 */
export const otpSecret = (value: string): string => {
  const raw = value.trim().replace(/\s+/g, '')
  if (!raw) return ''
  if (/^otpauth:\/\//i.test(raw)) {
    return otpSecret(secretParam(raw.slice(raw.indexOf('?') + 1)))
  }
  // The backend decodes with base32 RFC4648 padding *off* (totp-rs
  // `Secret::Encoded`), which rejects '=' outright — so padding is dropped
  // here rather than stored and refused later.
  const upper = raw.toUpperCase().replace(/=+$/, '')
  return BASE32.test(upper) ? upper : ''
}
