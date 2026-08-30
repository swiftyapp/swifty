use serde::{Serialize, Serializer};

// Some variants are constructed only by later PRs that fill in the command bodies.
#[allow(dead_code)]
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid master password")]
    InvalidPassword,

    #[error("vault is locked")]
    Locked,

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
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
