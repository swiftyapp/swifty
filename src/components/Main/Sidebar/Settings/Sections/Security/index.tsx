import { useTranslation } from 'react-i18next'
import SettingsGroup from '@/components/elements/SettingsGroup'
import MasterPasswordRow from './MasterPasswordRow'
import BiometricRow from './BiometricRow'
import SessionGroup from './SessionGroup'
import GeneratorGroup from './GeneratorGroup'

export default function Security() {
  const { t } = useTranslation()
  return (
    <>
      <SettingsGroup label={t('Master password')}>
        <MasterPasswordRow />
      </SettingsGroup>
      <BiometricRow />
      <SessionGroup />
      <GeneratorGroup />
    </>
  )
}
