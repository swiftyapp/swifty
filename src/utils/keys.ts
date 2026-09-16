/**
 * Which physical key a keyboard event landed on, as a `KeyboardEvent.code`
 * (`KeyL`, `Enter`, …).
 *
 * Chords have to read this rather than `key`: `key` is what the active layout
 * prints, so ⌘L on a Cyrillic layout arrives as `д` and never matches an `l`
 * binding — and ru-RU and uk-UA are both shipped locales. `code` names the key
 * cap position regardless of layout.
 *
 * Falls back to deriving a code from `key` for the synthetic events that carry
 * none (some test drivers, older webviews).
 */
export const keyCode = (event: KeyboardEvent): string =>
  event.code || (/^[a-z]$/i.test(event.key) ? `Key${event.key.toUpperCase()}` : event.key)
