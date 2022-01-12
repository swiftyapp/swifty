import { onItemAdd, onItemUpdate, onItemRemove } from './main'
import { onWindowMessage } from './window'
import { onSetupDone, onBackupSelect } from './setup'
import { onAuthStart, onAuthTouchId } from './auth'
import { onMasterPasswordChange, onBackupSave } from './vault'
import {
  onVaultSyncImport,
  onVaultSyncConnect,
  onVaultSyncDisconnect,
  onVaultSyncStart
} from './sync'

export const EVENTS = {
  'auth:start': onAuthStart,
  'auth:touchid': onAuthTouchId,
  'item:add': onItemAdd,
  'item:update': onItemUpdate,
  'item:remove': onItemRemove,
  'backup:save': onBackupSave,
  'window:message': onWindowMessage,
  'vault:sync:import': onVaultSyncImport,
  'vault:sync:connect': onVaultSyncConnect,
  'vault:sync:disconnect': onVaultSyncDisconnect,
  'vault:sync:start': onVaultSyncStart,
  'backup:select': onBackupSelect,
  'setup:done': onSetupDone,
  'masterpassword:update': onMasterPasswordChange
}
