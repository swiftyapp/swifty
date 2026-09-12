// Set a textarea to its own content height, so a twenty-line note — or a PEM
// block, or a quoted value with a newline in it — is never read through a
// two-line window. A box with a `max-h` grows to it and then scrolls.
export const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return
  el.style.height = 'auto'
  if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`
}
