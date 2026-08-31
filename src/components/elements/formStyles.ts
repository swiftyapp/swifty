// Shared token-styled form control classes for the redesign. Inputs/textentries
// use `!` important utilities because the legacy global `input.sass` (kept for the
// lock/setup screens until the final cleanup PR) is unlayered and would otherwise
// win over Tailwind's utilities layer.

export const inputClass =
  'w-full !rounded-[9px] !border !border-line2 !bg-field !px-3 !py-2.5 !text-[13px] !leading-[1.4] !text-text !outline-none !transition-colors placeholder:!text-text3 focus:!border-accent-line'

export const labelClass =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-text3'

export const selectClass =
  'w-full appearance-none rounded-[9px] border border-line2 bg-field px-3 py-2.5 pr-9 text-[13px] text-text outline-none transition-colors focus:border-accent-line'

export const checkboxClass =
  'h-4 w-4 flex-none accent-accent'
