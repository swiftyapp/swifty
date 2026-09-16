import { useTranslation } from 'react-i18next'
import { useStore, switchWorkspace } from '@/store'
import { workspaceLabel } from '@/lib/workspace'
import Segmented from '@/components/elements/Segmented'

// Which vault this lock screen is for, on the installs that have more than one.
// A `Segmented` because that is what this app's pick-one-of-a-few control looks
// like, and because only one workspace is ever open — picking is selecting, not
// navigating away.
//
// With a single workspace it draws nothing: the app has always had exactly one
// and must keep looking that way until someone makes a second.
export default function WorkspacePicker() {
  const { t } = useTranslation()
  const { list, active } = useStore(state => state.workspaces)

  if (list.length < 2) return null

  return (
    <div data-testid="workspace-picker" className="mb-6 flex justify-center">
      <Segmented
        name={t('Workspaces')}
        options={list.map(workspace => ({
          value: workspace.id,
          label: workspaceLabel(workspace, t)
        }))}
        value={active}
        testidPrefix="workspace-option"
        // Re-picking the one already shown would lock and re-open the same
        // screen, which reads as the app flinching at a click.
        onChange={id => {
          if (id !== active) void switchWorkspace(id)
        }}
      />
    </div>
  )
}
