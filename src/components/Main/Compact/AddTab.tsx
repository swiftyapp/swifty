import { useTranslation } from 'react-i18next'
import { openAddPicker } from '@/store'
import { PlusRailGlyph } from '../icons'
import { ADD_DISC } from './chrome'

/**
 * The vault's one verb, resting in the tab bar's notch: a filled accent disc
 * that stands half above the glass, where the four destinations are inks on
 * it — so it reads as "do" and not "go", and as a thing placed on the bar
 * rather than a fifth tab. No label; the disc is the label.
 *
 * A sibling of the bar rather than a child: the bar is masked to cut the notch,
 * and a child would be cut with it. Positioned off the same bottom edge, from
 * `chrome.ts`, so the two cannot drift apart.
 *
 * Same handle and same job as the rail's Add (`Sidebar/Add`): it only opens
 * the kind picker. Leaving a filtered view is `startEntry`'s, on commit.
 */
export default function AddTab() {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-label={t('Add a secret')}
      data-testid="add-entry-button"
      onClick={openAddPicker}
      className={`absolute left-1/2 z-20 grid -translate-x-1/2 cursor-pointer place-items-center rounded-full bg-accent text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_24px_-8px_var(--c-accent)] transition-transform duration-300 ease-spring active:scale-90 ${ADD_DISC}`}
    >
      <PlusRailGlyph size={24} />
    </button>
  )
}
