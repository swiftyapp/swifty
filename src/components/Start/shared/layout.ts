// The first run's content column. AuthShell gives 560px; every screen here
// keeps its cards and buttons narrower than that so a heading still wraps into
// two comfortable lines, and drops to the full width of a phone below it.
export const COLUMN = 'mx-auto w-full max-w-[420px]'

// One or two full-width buttons, always the same rhythm.
export const STACK = 'flex flex-col gap-2.5'

// The call-to-action stack at the foot of a screen, close under the card it
// answers. A screen with no card between its header and its buttons gives them
// more room (`mt-8`) so the choice does not crowd the sentence that poses it.
export const ACTIONS = `${COLUMN} mt-4 ${STACK}`

// A footnote under the actions: the thing worth knowing, not worth a sentence
// in the body.
export const FOOTNOTE = 'mx-auto mt-4 max-w-md text-center'
