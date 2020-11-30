import {
  onDataSave,
  onBackupSave,
  onVaultSyncImport,
  onVaultSyncConnect,
  onVaultSyncDisconnect,
  onVaultSyncStart
} from './main'
import { onWindowMessage } from './window'
import { onSetupDone, onBackupSelect } from './setup'
import { onAuthStart, onAuthTouchId } from './auth'
import { onMasterPasswordChange } from './vault'

export const EVENTS = {
  'auth:start': onAuthStart,
  'auth:touchid': onAuthTouchId,
  'data:save': onDataSave,
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
