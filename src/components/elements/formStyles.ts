// Shared token-styled form control classes for the redesign.

// Everything a field shares; the per-control classes below only add the sizing.
const controlBase =
  'w-full rounded-sm border border-line2 bg-field px-3 text-base text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line'

// 36px — the ruled tier for inputs, CTAs and rail tiles.
export const inputClass = `${controlBase} h-9`

// Textareas grow with their content, so they swap the fixed height for padding.
export const textareaClass = `${controlBase} py-2.5`

export const selectClass = `${controlBase} h-9 appearance-none pr-9`

export const labelClass =
  'mb-[7px] block font-mono text-xs uppercase tracking-label text-text3'

export const checkboxClass =
  'h-4 w-4 flex-none accent-accent'
