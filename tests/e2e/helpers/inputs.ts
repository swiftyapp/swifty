/**
 * Set a `<input type="range">` to `value` the way a user drag would.
 *
 * WebKitGTK does not move a range input on synthesized arrow keys, and a click
 * jumps to wherever the pointer lands, so neither drives a single step. Going
 * through the prototype's value setter (not `input.value =`, which React's
 * tracker would swallow as "no change") and then firing `input` reaches the
 * React `onChange` exactly like a real drag.
 */
export async function setRange(testid: string, value: number): Promise<void> {
  await browser.execute(
    (id: string, next: number) => {
      const input = document.querySelector<HTMLInputElement>(`[data-testid="${id}"]`);
      if (!input) throw new Error(`no range input with data-testid="${id}"`);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, String(next));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    testid,
    value,
  );
}
