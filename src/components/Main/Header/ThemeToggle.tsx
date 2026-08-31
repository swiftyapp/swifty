import { useStore, toggleTheme } from '@/store'
import { t } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
import { SunGlyph, MoonGlyph } from '../icons'

// Light/dark toggle wired to the theme slice. Shows the icon for the theme it
// switches *to* (sun while dark, moon while light).
export default function ThemeToggle() {
  const theme = useStore(state => state.theme)
  const isDark = theme === 'dark'

  return (
    <IconButton
      onClick={() => toggleTheme()}
      title={isDark ? t('Light mode') : t('Dark mode')}
    >
      {isDark ? <SunGlyph /> : <MoonGlyph />}
    </IconButton>
  )
}
