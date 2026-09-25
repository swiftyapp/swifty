/**
 * The colours a workspace tile can be given. Keys, not hex values: the registry
 * stores the key, and theme.css says what each looks like (`--c-ws-<key>`), so
 * a theme can retune the palette without touching anyone's saved choice.
 */
export const WORKSPACE_COLORS = ['indigo', 'violet', 'green', 'amber', 'rose', 'teal'] as const

export type WorkspaceColor = (typeof WORKSPACE_COLORS)[number]

export const isWorkspaceColor = (value: unknown): value is WorkspaceColor =>
  typeof value === 'string' && (WORKSPACE_COLORS as readonly string[]).includes(value)

/** The first colour none of `used` has taken, so a new tile stands apart; the
    palette's first once every one is in use. */
export const firstUnusedColor = (used: readonly (string | null | undefined)[]): WorkspaceColor =>
  WORKSPACE_COLORS.find(key => !used.includes(key)) ?? WORKSPACE_COLORS[0]

// Literal class names, so Tailwind sees every one it has to generate: a tile's
// fill, and the ring a picked swatch wears in its own colour.
export const WORKSPACE_COLOR_CLASSES: Record<WorkspaceColor, { bg: string; ring: string }> = {
  indigo: { bg: 'bg-ws-indigo', ring: 'ring-ws-indigo' },
  violet: { bg: 'bg-ws-violet', ring: 'ring-ws-violet' },
  green: { bg: 'bg-ws-green', ring: 'ring-ws-green' },
  amber: { bg: 'bg-ws-amber', ring: 'ring-ws-amber' },
  rose: { bg: 'bg-ws-rose', ring: 'ring-ws-rose' },
  teal: { bg: 'bg-ws-teal', ring: 'ring-ws-teal' }
}
