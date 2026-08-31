import { useStore, toggleTheme } from '@/store'
import { t } from '@/i18n'
import { SunGlyph, MoonGlyph } from '../icons'

// Light/dark toggle wired to the theme slice. Shows the icon for the theme it
// switches *to* (sun while dark, moon while light).
export default function ThemeToggle() {
  const theme = useStore(state => state.theme)
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      title={isDark ? t('Light mode') : t('Dark mode')}
      className="grid h-7 w-7 place-items-center rounded-[7px] text-text2 transition-colors hover:bg-hover hover:text-text [-webkit-app-region:no-drag]"
    >
      {isDark ? <SunGlyph /> : <MoonGlyph />}
    </button>
  )
}
