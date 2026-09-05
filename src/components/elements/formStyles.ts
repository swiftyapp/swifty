// Shared token-styled form control classes for the redesign.

// Everything a field shares; the per-control classes below only add the sizing.
const controlBase =
  'w-full rounded-sm border border-line2 bg-field px-3 text-base text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line'

// 36px — the ruled tier for inputs, CTAs and rail tiles.
export const inputClass = `${controlBase} h-9`

export const selectClass = `${controlBase} h-9 appearance-none pr-9`

// A read-only well on the field surface (generated output, key material, an
// inline error row): the input's edge and ground at the tile radius, with no
// control sizing — the caller sets padding and type.
export const wellClass = 'rounded-lg border border-line2 bg-field'
