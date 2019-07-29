import { ipcRenderer, remote } from 'electron'
import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Dropdown, DropdownItem } from 'components/elements/dropdown'
import Settings from 'settings.svg'
import Download from 'download.svg'

const Sidebar = () => {
  const dispatch = useDispatch()
  const [dropdown, setDropdown] = useState(false)

  const onAddEntry = () => dispatch({ type: 'NEW_ENTRY' })

  const handleSaveBackup = () => {
    setDropdown(false)
    remote.dialog.showSaveDialog({}, filepath => {
      ipcRenderer.send('backup:save', filepath)
    })
  }

  return (
    <div className="sidebar">
      <div className="add-button" onClick={onAddEntry}>
        +
      </div>
      <div className="settings">
        <Settings
          width="28"
          height="28"
          onClick={() => setDropdown(!dropdown)}
        />
        {dropdown && (
          <Dropdown onBlur={() => setDropdown(false)}>
            <DropdownItem onClick={handleSaveBackup}>
              <Download width="16" height="16" />
              Save Backup File
            </DropdownItem>
          </Dropdown>
        )}
      </div>
    </div>
  )
}
export default Sidebar
