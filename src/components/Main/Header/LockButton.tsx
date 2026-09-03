import { useTranslation } from 'react-i18next'
import { lockVault } from '@/store'
import IconButton from '@/components/elements/IconButton'
import Tooltip from '@/components/elements/Tooltip'
import { LockGlyph } from '../icons'

// Locks the vault straight from the top chrome. "Lock vault" is the one name
// for this action everywhere it appears — here, the command palette and the
// tray menu.
//
// It takes the app's own Tooltip rather than IconButton's `title`, so it reads
// like the sync chip beside it: the native tooltip is OS-styled, ignores the
// theme and lags by its own delay. `label` carries the accessible name that
// `title` used to supply, since the panel itself is aria-hidden.
export default function LockButton() {
  const { t } = useTranslation()
  const onLock = () => {
    void lockVault()
  }

  return (
    <Tooltip content={t('Lock vault')} align="end">
      <IconButton
        testid="lock-vault-button"
        onClick={onLock}
        label={t('Lock vault')}
      >
        <LockGlyph />
      </IconButton>
    </Tooltip>
  )
}
