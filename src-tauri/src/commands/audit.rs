use crate::error::Result;
use crate::models::Audit;
use crate::state::AppState;
use tauri::State;

// Audit every password in the unlocked vault (weak / short / old / repeating).
#[tauri::command]
#[allow(unused_variables)]
pub fn get_audit(state: State<'_, AppState>) -> Result<Audit> {
    todo!("PR-7: run the auditor over decrypted entries")
}
