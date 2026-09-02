/**
 * Whether a dialog currently owns the keyboard.
 *
 * Window/document-level accelerators (the detail pane's bare ⏎, the editor's
 * Esc and ⌘⏎) have to stand down while something modal is up, or they fire
 * *behind* it — dismissing a dialog would also discard the draft underneath.
 *
 * Asked of the DOM rather than the store so it covers every modal surface
 * without each accelerator having to know the list. The one requirement is
 * that a modal announces itself as one: `elements/Modal` and `Palette/Panel`
 * both set `role="dialog"`.
 */
export const dialogOpen = (): boolean =>
  !!document.querySelector('[role="dialog"], dialog[open]')
