// The two grids both faces are printed on.

// The holder's details, beside the portrait: three across on the desktop, two
// once the pane is phone-narrow so no caption has to be cut.
export const HOLDER =
  'grid min-w-0 flex-1 grid-cols-3 content-start gap-x-3 gap-y-1.5 @max-[420px]:grid-cols-2'

// The row along the bottom edge — issued, expires, authority, personal number,
// whichever the document has. Each cell hugs its value and the row spreads them
// to the edges, the way a card prints its dates; phone-narrow, two per row.
export const FOOT =
  'grid grid-flow-col auto-cols-[minmax(0,auto)] justify-between gap-x-4 gap-y-1.5 @max-[420px]:grid-flow-row @max-[420px]:grid-cols-2 @max-[420px]:justify-normal'
