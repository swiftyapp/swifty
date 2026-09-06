/**
 * The floating tab bar's geometry, in the one place both it and the screens it
 * hovers over can read it: a 64px pill, 12px off the safe-area bottom, inset
 * 20px a side.
 */
export const TAB_BAR = 'inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+12px)] h-16'

/**
 * What a root screen's scroller reserves under its content so the last row can
 * be scrolled clear of the bar it slides under (bar + its offset + a breath).
 */
export const TAB_BAR_CLEARANCE = 'pb-[calc(env(safe-area-inset-bottom)+120px)]'

/**
 * The face of a screen's bottom action: an accent slab a thumb can land on
 * without aiming. Shared so the detail screen's Copy and the generator's Use
 * are visibly the same control, put on different footings below.
 */
export const ACTION_BUTTON =
  'absolute flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-md font-medium text-accent-fg shadow-float transition-opacity disabled:cursor-default'

/**
 * A pushed screen's bottom action, on the same footing: a 54px button, 12px off
 * the safe-area bottom, inset 20px a side — the tab bar's own gutters, so the
 * two never look like they were measured by different people.
 */
export const PRIMARY_ACTION =
  'inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+12px)] h-[54px]'

/** What that screen's scroller reserves under its content for the button. */
export const PRIMARY_CLEARANCE = 'pb-[calc(env(safe-area-inset-bottom)+94px)]'

/**
 * The same action on a *root* screen, which keeps its tab bar: the button is
 * lifted clear of the pill (64px + its 12px offset + a 12px gap) rather than
 * sharing the bottom edge with it.
 */
export const ROOT_ACTION =
  'z-10 inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+88px)] h-[54px]'

/** What that root's scroller reserves: the button, and the bar under it. */
export const ROOT_CLEARANCE = 'pb-[calc(env(safe-area-inset-bottom)+170px)]'
