import { useTranslation } from 'react-i18next'
import SettingsGroup from '@/components/elements/SettingsGroup'
import WorkspaceList from './WorkspaceList'
import RenameRow from './RenameRow'
import NewWorkspace from './NewWorkspace'

// The only place workspaces are managed. Everything else about them — the lock
// screen's picker, the header's label — appears only once a second one exists;
// this section is where that second one is made.
export default function Workspaces() {
  const { t } = useTranslation()

  return (
    <>
      <SettingsGroup label={t('Workspaces')}>
        <WorkspaceList />
        <RenameRow />
      </SettingsGroup>
      <SettingsGroup label={t('New workspace')}>
        <NewWorkspace />
      </SettingsGroup>
    </>
  )
}
