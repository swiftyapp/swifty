// ⌘F comes off the window, not off the list column's subtree, so the search
// field publishes its input here and the app's shortcut table (useShortcuts)
// reads it — nothing threads a ref down through the shell. There is only ever
// one search field mounted.
let field: HTMLInputElement | null = null

export const registerSearch = (el: HTMLInputElement | null) => {
  field = el
  return () => {
    field = null
  }
}

export const focusSearch = () => field?.focus()
