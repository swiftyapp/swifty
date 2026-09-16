// Attributes for any input or textarea whose value is data, not prose.

// Left to itself the platform edits what was typed: the iOS keyboard
// capitalizes the first letter it sees, and macOS applies "Capitalize words
// automatically" and the other text substitutions to editable web content. On
// a passphrase that is silent corruption — "correct horse" is stored as
// "Correct horse", and the vault it seals is no longer the one the user
// believes they typed. A lowercase API token, a base32 OTP secret and a PEM
// block all fail the same way, just less loudly.
//
// The rule: if the value is stored or derived from, spread this. Only the
// genuinely prose fields — notes, entry titles, the search box — keep the
// platform's help.
export const verbatimInput = {
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
  autoComplete: 'off'
} as const
