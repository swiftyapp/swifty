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
 * A pushed screen's bottom action, on the same footing: a 54px button, 12px off
 * the safe-area bottom, inset 20px a side — the tab bar's own gutters, so the
 * two never look like they were measured by different people.
 */
export const PRIMARY_ACTION =
  'inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+12px)] h-[54px]'

/** What that screen's scroller reserves under its content for the button. */
export const PRIMARY_CLEARANCE = 'pb-[calc(env(safe-area-inset-bottom)+94px)]'
