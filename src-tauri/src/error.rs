use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid master password")]
    InvalidPassword,

    // The vault was written by a newer build (schema ahead of this binary).
    // Distinct from InvalidPassword so the UI never blames the user's memory
    // for a version mismatch.
    #[error("vault requires a newer version of the app")]
    VaultTooNew,

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

    // This platform cannot do the thing at all (no OCR recognizer, no save
    // dialog that can set file permissions). Not a failure to retry.
    #[error("{0}")]
    Unsupported(String),

    // A scan read text but it was neither a card nor an identity document.
    #[error("nothing recognized")]
    Unrecognized,

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

impl Error {
    // The discriminant the frontend switches on.
    fn kind(&self) -> &'static str {
        match self {
            Error::InvalidPassword => "invalidPassword",
            Error::VaultTooNew => "vaultTooNew",
            Error::TooManyAttempts { .. } => "tooManyAttempts",
            Error::Locked => "locked",
            Error::NotFound => "notFound",
            Error::Cancelled => "cancelled",
            Error::SyncNotConfigured => "syncNotConfigured",
            Error::Unsupported(_) => "unsupported",
            Error::Unrecognized => "unrecognized",
            Error::Io(_) => "io",
            Error::Serde(_) => "serde",
            Error::Crypto(_) => "crypto",
            Error::Other(_) => "other",
        }
    }
}

// Every rejection reaches the frontend as `{ kind, message }` — the kind is what
// it branches on, the message is what it may show. `camelCase` matches every
// other DTO sent to the frontend (see `models.rs`).
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct ErrorDto {
            kind: &'static str,
            message: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            retry_after_secs: Option<u64>,
        }

        ErrorDto {
            kind: self.kind(),
            message: self.to_string(),
            retry_after_secs: match self {
                Error::TooManyAttempts { retry_after_secs } => Some(*retry_after_secs),
                _ => None,
            },
        }
        .serialize(serializer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_variant_serializes_as_kind_and_message() {
        let json = serde_json::to_value(Error::Locked).unwrap();
        assert_eq!(json["kind"], "locked");
        assert_eq!(json["message"], "vault is locked");
        assert!(json.get("retryAfterSecs").is_none());
    }

    #[test]
    fn too_many_attempts_carries_the_countdown() {
        let json = serde_json::to_value(Error::TooManyAttempts {
            retry_after_secs: 8,
        })
        .unwrap();
        assert_eq!(json["kind"], "tooManyAttempts");
        assert_eq!(json["message"], "too many failed attempts, try again in 8s");
        assert_eq!(json["retryAfterSecs"], 8);
    }
}
