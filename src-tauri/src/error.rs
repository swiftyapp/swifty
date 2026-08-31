use serde::{Serialize, Serializer};

// Some variants are constructed only by later PRs that fill in the command bodies.
#[allow(dead_code)]
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid master password")]
    InvalidPassword,

    // Failed-unlock backoff (T-AUTH-3): too many wrong attempts, wait it out.
    // `retry_after_secs` rides along in the serialized payload (see `Serialize`
    // below) so the frontend can render a countdown without parsing the message.
    #[error("too many failed attempts, try again in {retry_after_secs}s")]
    TooManyAttempts { retry_after_secs: u64 },

    #[error("vault is locked")]
    Locked,

    #[error("entry not found")]
    NotFound,

    #[error("operation was cancelled")]
    Cancelled,

    #[error("sync is not configured")]
    SyncNotConfigured,

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Serde(#[from] serde_json::Error),

    #[error("crypto error: {0}")]
    Crypto(String),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;

// Serialize errors as their message so the frontend receives a plain string.
// `TooManyAttempts` is the one exception: it carries data the UI needs (a
// countdown), so it serializes as a small object instead. `camelCase` matches
// every other DTO sent to the frontend (see `models.rs`).
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct TooManyAttemptsPayload {
            message: String,
            retry_after_secs: u64,
        }

        match self {
            Error::TooManyAttempts { retry_after_secs } => TooManyAttemptsPayload {
                message: self.to_string(),
                retry_after_secs: *retry_after_secs,
            }
            .serialize(serializer),
            other => serializer.serialize_str(&other.to_string()),
        }
    }
}
