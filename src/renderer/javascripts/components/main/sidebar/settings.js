import { ipcRenderer, remote } from 'electron'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { Dropdown, DropdownItem } from 'components/elements/dropdown'
import SettingsIcon from 'settings.svg'
import DownloadIcon from 'download.svg'
import GDriveIcon from 'google-drive.svg'

const Settings = () => {
  const sync = useSelector(state => state.flow.sync)
  const [dropdown, setDropdown] = useState(false)

  const handleSaveBackup = () => {
    setDropdown(false)
    remote.dialog.showSaveDialog().then(({ canceled, filePath }) => {
      if (!canceled) ipcRenderer.send('backup:save', filePath)
    })
  }

  const handleSync = () => {
    setDropdown(false)
    ipcRenderer.send('backup:sync:setup')
  }

  const setupGdriveItem = () => {
    if (sync) return null
    return (
      <DropdownItem onClick={handleSync}>
        <GDriveIcon width="16" height="16" />
        Sync via GDrive
      </DropdownItem>
    )
  }

  return (
    <div className="settings">
      <SettingsIcon
        width="28"
        height="28"
        onClick={() => setDropdown(!dropdown)}
      />
      {dropdown && (
        <Dropdown onBlur={() => setDropdown(false)}>
          {setupGdriveItem()}
          <DropdownItem onClick={handleSaveBackup}>
            <DownloadIcon width="16" height="16" />
            Save Backup File
          </DropdownItem>
        </Dropdown>
      )}
    </div>
  )
}

export default Settings
