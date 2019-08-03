import { ipcRenderer, remote } from 'electron'
import React, { useState } from 'react'
import { Dropdown, DropdownItem } from 'components/elements/dropdown'
import SettingsIcon from 'settings.svg'
import DownloadIcon from 'download.svg'

const Settings = () => {
  const [dropdown, setDropdown] = useState(false)

  const handleSaveBackup = () => {
    setDropdown(false)
    remote.dialog.showSaveDialog().then(({ canceled, filePath }) => {
      if (!canceled) ipcRenderer.send('backup:save', filePath)
    })
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
