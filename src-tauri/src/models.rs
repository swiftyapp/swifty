use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// A vault entry. Kept as a single flat struct (rather than an enum) so it
// round-trips the untyped legacy object shape; `kind` discriminates login/note/card.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub otp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub month: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub year: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cvc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(rename = "createdAt", default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(
        rename = "password_updated_at",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub password_updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultData {
    pub entries: Vec<Entry>,
}

// Non-secret entry metadata sent to the frontend for the list. Never carries a
// secret field; secrets stay in the encrypted payload, revealed one at a time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryMetaDto {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub tags: Vec<String>,
    pub url_host: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl EntryMetaDto {
    // Build from the shared metadata columns (timestamps are ms → RFC3339).
    pub fn from_parts(
        id: String,
        kind: String,
        title: String,
        tags: &str,
        url_host: String,
        created_at: i64,
        updated_at: i64,
    ) -> Self {
        Self {
            id,
            kind,
            title,
            tags: serde_json::from_str(tags).unwrap_or_default(),
            url_host,
            created_at: iso(created_at),
            updated_at: iso(updated_at),
        }
    }
}

fn iso(ms: i64) -> Option<String> {
    chrono::DateTime::from_timestamp_millis(ms).map(|d| d.to_rfc3339())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockResult {
    pub entries: Vec<EntryMetaDto>,
    pub sync_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratorOptions {
    pub length: u32,
    #[serde(default)]
    pub numbers: bool,
    #[serde(default)]
    pub symbols: bool,
    #[serde(default)]
    pub uppercase: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lowercase: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exclude: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exclude_similar_characters: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtpResult {
    pub code: String,
    pub time: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditItem {
    pub score: u8,
    pub is_weak: bool,
    pub is_repeating: bool,
    pub breached: bool,
}

// Audit results keyed by entry id.
pub type Audit = HashMap<String, AuditItem>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub configured: bool,
}
