import type { CSSProperties } from 'react'
import type { ThemePreference } from '@/theme'

// The one place outside theme.css that names literal colours: these cards are
// pictures *of* the two palettes, so they have to show both whichever one the
// app is wearing. Values copied from the light and dark palettes.
interface Palette {
  ground: string
  bar: string
  barFirst: string
  pane: string
  paneLine: string
  title: string
  line: string
  button: string
}

const LIGHT: Palette = {
  ground: '#f3f4f6',
  bar: 'rgba(20,22,26,.13)',
  barFirst: '#15161a',
  pane: '#ffffff',
  paneLine: 'rgba(20,22,26,.1)',
  title: 'rgba(20,22,26,.78)',
  line: 'rgba(20,22,26,.12)',
  button: '#15161a'
}

const DARK: Palette = {
  ground: '#161718',
  bar: 'rgba(255,255,255,.13)',
  barFirst: 'rgba(255,255,255,.8)',
  pane: '#222326',
  paneLine: 'rgba(255,255,255,.08)',
  title: 'rgba(255,255,255,.8)',
  line: 'rgba(255,255,255,.13)',
  button: '#f2f3f4'
}

const SIDEBAR_BARS = ['80%', '64%', '72%', '52%']

// A miniature window: a sidebar of list bars and a pane with a title, two
// lines of body and a button.
function Scene({ palette, style }: { palette: Palette; style?: CSSProperties }) {
  const fill = (background: string) => ({ background })
  return (
    <div className="absolute inset-0 flex gap-2 p-2" style={{ ...fill(palette.ground), ...style }}>
      <div className="flex w-[24%] flex-none flex-col gap-1.5 pt-1">
        {SIDEBAR_BARS.map((width, index) => (
          <span
            key={width}
            className="h-1 rounded-full"
            style={{ width, ...fill(index === 0 ? palette.barFirst : palette.bar) }}
          />
        ))}
      </div>
      <div
        className="flex min-w-0 flex-1 flex-col gap-1.5 p-2"
        style={{
          ...fill(palette.pane),
          border: `1px solid ${palette.paneLine}`,
          borderRadius: 6
        }}
      >
        <span className="h-1.5 w-1/2 rounded-full" style={fill(palette.title)} />
        <span className="h-1 w-full rounded-full" style={fill(palette.line)} />
        <span className="h-1 w-3/4 rounded-full" style={fill(palette.line)} />
        <span className="mt-auto h-2.5 w-2/5 rounded-xs" style={fill(palette.button)} />
      </div>
    </div>
  )
}

// System draws the same window twice, the dark copy clipped to the right half,
// so the seam runs straight through the pane.
export default function ThemeMockup({ theme }: { theme: ThemePreference }) {
  return (
    <div aria-hidden className="relative h-16 overflow-hidden rounded-sm border border-line md:h-[92px]">
      <Scene palette={theme === 'dark' ? DARK : LIGHT} />
      {theme === 'system' && <Scene palette={DARK} style={{ clipPath: 'inset(0 0 0 50%)' }} />}
    </div>
  )
}
