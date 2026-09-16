// Attributes for any input whose value is data, not prose.

// Left to itself the platform edits what was typed: the iOS keyboard
// capitalizes the first letter it sees, and macOS applies "Capitalize words
// automatically" and the other text substitutions to editable web content. On
// a passphrase that is silent corruption — "correct horse" is stored as
// "Correct horse", and the vault it seals is no longer the one the user
// believes they typed. Spread this onto every field that must round-trip
// exactly; prose fields (notes, titles) deliberately keep the help.
export const verbatimInput = {
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
  autoComplete: 'off'
} as const
