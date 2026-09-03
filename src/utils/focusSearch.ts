// ⌘F comes off the window, so the app's shortcut table has to reach a field it
// holds no ref to. Asked of the DOM rather than kept in a module-level
// singleton: there is only ever one search field mounted, and the query is as
// cheap as the registration bookkeeping it replaces.
export const focusSearch = () =>
  document.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
