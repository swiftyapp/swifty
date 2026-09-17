import { useTranslation } from 'react-i18next'
import SettingsGroup from '@/components/elements/SettingsGroup'
import WorkspaceList from './WorkspaceList'
import RenameRow from './RenameRow'
import RemoteVaults from './RemoteVaults'
import NewWorkspace from './NewWorkspace'
import RestoreFromDrive from './RestoreFromDrive'

export default function Workspaces() {
  const { t } = useTranslation()

  return (
    <>
      <SettingsGroup label={t('Workspaces')}>
        <WorkspaceList />
        <RenameRow />
      </SettingsGroup>
      <RemoteVaults />
      <SettingsGroup label={t('New workspace')}>
        <NewWorkspace />
        <RestoreFromDrive />
      </SettingsGroup>
    </>
  )
}
