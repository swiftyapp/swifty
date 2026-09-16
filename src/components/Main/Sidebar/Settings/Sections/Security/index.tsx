import { useTranslation } from 'react-i18next'
import { useIsPrimaryWorkspace } from '@/store'
import SettingsGroup from '@/components/elements/SettingsGroup'
import MasterPasswordRow from './MasterPasswordRow'
import BiometricRow from './BiometricRow'
import SessionGroup from './SessionGroup'
import GeneratorGroup from './GeneratorGroup'

export default function Security() {
  const { t } = useTranslation()
  // There is one enrolled key and it opens the primary vault, so a second
  // workspace has no biometric question to ask. The row asks it unconditionally
  // (it reads `available`, not `canEnroll`), so the gate is here.
  const primary = useIsPrimaryWorkspace()

  return (
    <>
      <SettingsGroup label={t('Master password')}>
        <MasterPasswordRow />
      </SettingsGroup>
      {primary && <BiometricRow />}
      <SessionGroup />
      <GeneratorGroup />
    </>
  )
}
