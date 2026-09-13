/*
 * What a key says about itself, read off the text the user stored: the public
 * line's algorithm, size and comment, and the private block's format and
 * weight. Decoration for the read view only — nothing here is written back.
 */

export interface PublicKeyInfo {
  /** ssh-keygen's name for the algorithm: "ED25519", "RSA", "ECDSA". */
  type: string
  /** The key size in bits, when the line carries enough to know it. */
  bits?: number
  /** The trailing label — "alice@laptop" — or ''. */
  comment: string
}

// Key types whose size is fixed by the name, as ssh-keygen prints them.
const NAMED: Record<string, PublicKeyInfo> = {
  'ssh-ed25519': { type: 'ED25519', bits: 256, comment: '' },
  'sk-ssh-ed25519@openssh.com': { type: 'ED25519-SK', bits: 256, comment: '' },
  'ecdsa-sha2-nistp256': { type: 'ECDSA', bits: 256, comment: '' },
  'ecdsa-sha2-nistp384': { type: 'ECDSA', bits: 384, comment: '' },
  'ecdsa-sha2-nistp521': { type: 'ECDSA', bits: 521, comment: '' },
  'sk-ecdsa-sha2-nistp256@openssh.com': {
    type: 'ECDSA-SK',
    bits: 256,
    comment: ''
  }
}

const decode = (base64: string): Uint8Array | null => {
  try {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  } catch {
    return null
  }
}

// The wire blob is a run of length-prefixed strings; the modulus is the one
// whose bit length names an RSA key (the second), the prime p a DSA key (the
// first). Bit length as BN_num_bits has it: leading zero bytes do not count.
const mpintBits = (blob: Uint8Array, index: number): number | undefined => {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let at = 0
  for (let field = 0; ; field++) {
    if (at + 4 > blob.length) return undefined
    const length = view.getUint32(at)
    at += 4
    if (at + length > blob.length) return undefined
    if (field === index) {
      let start = at
      while (start < at + length && blob[start] === 0) start++
      if (start === at + length) return 0
      return (at + length - start - 1) * 8 + (32 - Math.clz32(blob[start]))
    }
    at += length
  }
}

/** The public line taken apart; an empty or unrecognised line yields no type. */
export const parsePublicKey = (line: string): PublicKeyInfo => {
  const [name = '', blob = '', ...rest] = line.trim().split(/\s+/)
  const comment = rest.join(' ')
  if (!name || !blob) return { type: '', comment }

  const named = NAMED[name]
  if (named) return { ...named, comment }

  const bytes = decode(blob)
  // Field 0 is the algorithm name itself; RSA is (e, n), DSA is (p, q, g, y).
  const sized = (type: string, field: number): PublicKeyInfo => ({
    type,
    bits: bytes ? mpintBits(bytes, field) : undefined,
    comment
  })
  if (name === 'ssh-rsa') return sized('RSA', 2)
  if (name === 'ssh-dss') return sized('DSA', 1)

  return { type: name.replace(/^ssh-/, '').toUpperCase(), comment }
}

/**
 * "ED25519 256" as ssh-keygen titles the randomart, or with a separator of the
 * caller's ("ED25519 · 256" on the chip) — as much of it as the line gave away.
 */
export const keyLabel = ({ type, bits }: PublicKeyInfo, separator = ' '): string =>
  [type, bits].filter(Boolean).join(separator)

/**
 * What sits between BEGIN and PRIVATE KEY — "OPENSSH", "RSA", "EC" — or ''.
 * Anchored to the first line, the same test the sealed block applies before it
 * treats the value as armored, so the two never disagree about one key.
 */
export const privateKeyFormat = (block: string): string =>
  /^-----BEGIN (.+?) PRIVATE KEY-----/.exec(block.trim())?.[1] ?? ''
