const BASE32 = /^[A-Z2-7]{8,}=*$/

/**
 * The TOTP secret carried by whatever was pasted: a bare base32 string, or the
 * `otpauth://totp/...?secret=...` URI behind every enrolment QR code. Returns
 * '' when there is no usable secret in there — the field's validity test.
 */
export const otpSecret = (value: string): string => {
  const raw = value.trim().replace(/\s+/g, '')
  if (!raw) return ''
  if (/^otpauth:\/\//i.test(raw)) {
    const query = raw.slice(raw.indexOf('?') + 1)
    return otpSecret(new URLSearchParams(query).get('secret') ?? '')
  }
  const upper = raw.toUpperCase()
  return BASE32.test(upper) ? upper : ''
}
