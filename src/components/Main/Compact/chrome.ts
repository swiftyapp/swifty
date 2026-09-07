/**
 * iOS's minimum touch target, for the controls the desktop draws at 28-36px.
 * Passed to them as classes rather than asked for by a flag: it is the same
 * control, dressed for a finger.
 */
export const TOUCH = 'h-11 w-11'

/**
 * Where floating bottom chrome sits: the same 20px off every edge. Deliberately
 * not `env(safe-area-inset-bottom)` — that is UIKit's docked-content margin
 * (34pt on a home-indicator phone), and a pill lifted by it plus a gap floats
 * visibly higher than its side gutters. iOS's own floating tab bar sits a few
 * points above the home indicator (13pt from the edge), which 20px clears.
 */
const EDGE = 'inset-x-5 bottom-5'

/**
 * The floating tab bar's geometry, in the one place both it and the screens it
 * hovers over can read it: a 64px pill on [`EDGE`].
 */
export const TAB_BAR = `${EDGE} h-16`

/**
 * What a root screen's scroller reserves under its content so the last row can
 * be scrolled clear of the bar it slides under (bar + its offset + a breath).
 */
export const TAB_BAR_CLEARANCE = 'pb-32'

/**
 * The face of a screen's bottom action: an accent slab a thumb can land on
 * without aiming. Shared so the detail screen's Copy and the generator's Use
 * are visibly the same control, put on different footings below.
 */
export const ACTION_BUTTON =
  'absolute flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-md font-medium text-accent-fg shadow-float transition-opacity disabled:cursor-default'

/**
 * A pushed screen's bottom action, on the same footing: a 54px button on
 * [`EDGE`] — the tab bar's own gutters, so the two never look like they were
 * measured by different people.
 */
export const PRIMARY_ACTION = `${EDGE} h-[54px]`

/** What that screen's scroller reserves under its content for the button. */
export const PRIMARY_CLEARANCE = 'pb-[102px]'

/**
 * The same action on a *root* screen, which keeps its tab bar: the button is
 * lifted clear of the pill (64px + its 20px offset + a 12px gap) rather than
 * sharing the bottom edge with it.
 */
export const ROOT_ACTION = 'z-10 inset-x-5 bottom-24 h-[54px]'

/** What that root's scroller reserves: the button, and the bar under it. */
export const ROOT_CLEARANCE = 'pb-[178px]'
