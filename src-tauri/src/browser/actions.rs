//! What the extension may ask for, and what it gets.
//!
//! One [`Connection`] per extension process: it owns the session keys and
//! remembers whether the extension has proved an association on it. The vault
//! is reached through [`Host`], a handful of operations with no notion of
//! sessions, stores or Tauri, so the whole exchange runs against a fake in
//! the tests and against the app (`super::AppHost`) in the binary.

use serde_json::{json, Map, Value};

use super::protocol::{self, str_of, Code, Session};

/// A login the extension may fill: the one secret it needs and the identity
/// it shows in its picker. `totp` is the current code, when the entry has a
/// seed, so the extension can fill the second step without another ask.
#[derive(Clone, Debug)]
pub struct Login {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub totp: Option<String>,
}

/// An extension the user let in: the name they gave it and its identification
/// public key (`settings::BrowserClient`, without the serde).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Client {
    pub name: String,
    pub key: String,
}

/// The vault as the extension host sees it.
pub trait Host {
    /// A stable digest of the open vault, or `None` while locked. The
    /// extension keys its associations by it, so each workspace is its own.
    fn database_hash(&self) -> Option<String>;
    fn clients(&self) -> Vec<Client>;
    /// Ask the user whether the extension holding `key` may connect: the name
    /// they give it, or `None` for a refusal or no answer.
    fn associate(&self, key: &str) -> Option<String>;
    fn remember(&self, client: Client);
    /// Every login for `host` (a bare hostname, lowercase), secrets unsealed.
    fn logins_for(&self, host: &str) -> Vec<Login>;
    /// The current code for the login `id`, if it has a seed.
    fn totp(&self, id: &str) -> Option<String>;
    fn generate_password(&self) -> Option<String>;
    fn lock(&self);
    /// The extension wants the vault open: bring the app forward.
    fn unlock_requested(&self);
}

pub struct Connection<H> {
    host: H,
    session: Session,
    associated: bool,
}

impl<H: Host> Connection<H> {
    pub fn new(host: H) -> Self {
        Self {
            host,
            session: Session::new(),
            associated: false,
        }
    }

    #[cfg(test)]
    pub fn host(&self) -> &H {
        &self.host
    }

    /// One request in, one reply out, both JSON. Never fails: whatever cannot
    /// be answered is refused in the protocol's own words.
    pub fn handle(&mut self, raw: &[u8]) -> Vec<u8> {
        serde_json::to_vec(&self.reply(raw)).unwrap_or_default()
    }

    fn reply(&mut self, raw: &[u8]) -> Value {
        let Ok(Value::Object(request)) = serde_json::from_slice::<Value>(raw) else {
            return protocol::error_reply("", Code::EmptyMessageReceived);
        };
        let action = str_of(&request, "action").to_string();
        if action == "change-public-keys" {
            return self.session.exchange(&request);
        }
        // Everything else needs the vault open, and is refused before it is
        // even unsealed — as KeePassXC does. `triggerUnlock` rides on the
        // outside of the request for exactly this case.
        let Some(hash) = self.host.database_hash() else {
            if action == "get-databasehash" && str_of(&request, "triggerUnlock") == "true" {
                self.host.unlock_requested();
            }
            return protocol::error_reply(&action, Code::DatabaseNotOpened);
        };
        let (message, nonce) = match self.session.open(&request) {
            Ok(opened) => opened,
            Err(code) => return protocol::error_reply(&action, code),
        };
        if str_of(&message, "action") != action {
            return protocol::error_reply(&action, Code::IncorrectAction);
        }
        match self.dispatch(&action, &message, &hash) {
            Ok(params) => self.session.seal(&action, &nonce, params),
            Err(code) => protocol::error_reply(&action, code),
        }
    }

    fn dispatch(
        &mut self,
        action: &str,
        message: &Map<String, Value>,
        hash: &str,
    ) -> Result<Map<String, Value>, Code> {
        match action {
            "get-databasehash" => Ok(params(json!({ "hash": hash }))),
            "associate" => {
                // `key` is the session key the message is sealed under, sent
                // again inside it; `idKey` is the one the extension keeps.
                let key = str_of(message, "key");
                let id_key = str_of(message, "idKey");
                if key.is_empty() || Some(key) != self.session.client_key() || id_key.is_empty() {
                    return Err(Code::AssociationFailed);
                }
                let name = self
                    .host
                    .associate(id_key)
                    .ok_or(Code::ActionCancelledOrDenied)?;
                self.host.remember(Client {
                    name: name.clone(),
                    key: id_key.to_string(),
                });
                self.associated = true;
                Ok(params(json!({ "hash": hash, "id": name })))
            }
            "test-associate" => {
                let id = str_of(message, "id");
                let key = str_of(message, "key");
                let known = self
                    .host
                    .clients()
                    .iter()
                    .any(|c| c.key == key && c.name == id);
                if !known {
                    return Err(Code::AssociationFailed);
                }
                self.associated = true;
                Ok(params(json!({ "hash": hash, "id": id })))
            }
            "get-logins" => {
                self.require_association(message)?;
                let url = str_of(message, "url");
                if url.is_empty() {
                    return Err(Code::NoUrlProvided);
                }
                let host = site_host(url).ok_or(Code::NoUrlProvided)?;
                let logins = self.host.logins_for(&host);
                if logins.is_empty() {
                    return Err(Code::NoLoginsFound);
                }
                let entries: Vec<Value> = logins
                    .iter()
                    .map(|login| {
                        let mut entry = json!({
                            "login": login.username,
                            "password": login.password,
                            "name": login.title,
                            "uuid": login.id,
                        });
                        if let Some(code) = &login.totp {
                            entry["totp"] = code.as_str().into();
                        }
                        entry
                    })
                    .collect();
                Ok(params(
                    json!({ "count": entries.len(), "entries": entries, "hash": hash }),
                ))
            }
            "get-totp" => {
                self.require_association(message)?;
                let id = str_of(message, "uuid");
                if id.is_empty() {
                    return Err(Code::NoValidUuidProvided);
                }
                let code = self.host.totp(id).ok_or(Code::NoValidUuidProvided)?;
                Ok(params(json!({ "totp": code })))
            }
            "generate-password" => {
                let password = self
                    .host
                    .generate_password()
                    .ok_or(Code::ActionCancelledOrDenied)?;
                Ok(params(json!({ "password": password })))
            }
            "lock-database" => {
                self.host.lock();
                Ok(Map::new())
            }
            // The extension asks for groups before saving a new login; a vault
            // has none, and this is the code it takes for "put it at the root".
            "get-database-groups" => Err(Code::NoGroupsFound),
            _ => Err(Code::IncorrectAction),
        }
    }

    // An association proved on this connection, or one the request carries:
    // the extension sends every identification key it holds with each ask,
    // and one the user let in before is as good as a fresh `test-associate`.
    fn require_association(&mut self, message: &Map<String, Value>) -> Result<(), Code> {
        if self.associated {
            return Ok(());
        }
        let known = self.host.clients();
        let offered = message
            .get("keys")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_object)
            .any(|offer| known.iter().any(|c| c.key == str_of(offer, "key")));
        if !offered {
            return Err(Code::AssociationFailed);
        }
        self.associated = true;
        Ok(())
    }
}

fn params(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

/// The host a page URL names, lowercase, or `None` for anything that is not a
/// URL with one.
pub fn site_host(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()?
        .host_str()
        .map(str::to_ascii_lowercase)
}

/// Whether a login stored for `entry` (its `url_host` column) belongs to the
/// page at `site`: the same host, or a subdomain of it, with a leading `www.`
/// on either side not counting. `accounts.example.com` gets the login saved
/// for `example.com`; `example.com` does not get one saved for
/// `accounts.example.com`, and `notexample.com` gets neither.
pub fn host_matches(site: &str, entry: &str) -> bool {
    let site = site.trim_start_matches("www.");
    let entry = entry.trim().to_ascii_lowercase();
    let entry = entry.trim_start_matches("www.");
    !entry.is_empty() && (site == entry || site.ends_with(&format!(".{entry}")))
}
