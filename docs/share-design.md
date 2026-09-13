# Sharing a secret — by link, over the sender's own Drive

Status: v1. Backend module `src-tauri/src/share`, frontend `src/components/Main/Share`.

Swifty has no server, and sharing does not add one. A share is a sealed copy of
one entry that lives for a day in the sender's own Google Drive. The recipient
opens it with a link, and the link is the only secret.

What this is, precisely: a bearer-link transfer of a snapshot. It does not
authenticate a named recipient, does not propagate later changes, and is not
burn-after-reading. Whoever holds the link can open the share until it expires
or is revoked; revoking stops future downloads but cannot retract a credential
already imported. The UI is written to promise exactly that and no more.

## 1. What the user is trying to do

- Hand a colleague the Wi-Fi password, a shared inbox login or an API key
  without pasting it into a chat where it stays forever.
- Do it from a phone as easily as from a laptop.
- Receive one without signing up for anything.

Two flows follow: **send**, which produces a link, and **receive**, which turns
a link into a new entry in the recipient's vault. There is no live link between
the two copies: once received, the entry is the recipient's, and later edits on
either side stay where they were made.

## 2. Trust model in one paragraph

The sender's app generates a fresh random 256-bit key, seals the entry with
AES-256-GCM under it, uploads the ciphertext to a `Swifty/Shares` folder in the
sender's Drive, and marks that one file readable by anyone who knows its id.
The link carries the file id and the key. Google holds ciphertext and sees that
a share was made, but never the key. The recipient's app downloads the file with
a public API key (no login) and unseals it locally. Whoever gets the link before
it expires gets the credential, so the link must travel over a channel the
sender already trusts, and it stops working after 24 hours or when revoked.

## 3. Formats

Link, one pasteable token:

```
swifty://share#v1.<driveFileId>.<key>
```

`key` is the 32 key bytes, base64url without padding. Nothing fetches this URL;
the scheme exists so the token is unambiguous and could register as a deep link
later.

Envelope (plaintext before sealing):

```json
{ "v": 1, "expiresAt": 1700086400000, "entry": { ...sanitized Entry... } }
```

Sealed with the same AES-256-GCM helper the vault uses for entry payloads
(`crypto::seal_aead`): a random 16-byte nonce is prepended to the ciphertext.
The expiry sits inside the ciphertext, so it is authenticated by the same tag
as the entry: nobody holding the file, Drive included, can extend it.

Sanitizing strips what must not travel: the entry id (the recipient assigns a
fresh one), the timestamps, the favorite flag, and any passkeys — a copied
passkey is a second authenticator nobody registered. Tags and custom fields are
kept. It runs on **both** ends. On send, so nothing leaves that should not. On
receipt, because the plaintext is whatever the link's author sealed: a crafted
envelope naming an existing row's id must not be able to replace that row.
Receipt also refuses an unknown entry kind and anything past its expiry.

A login whose only secret is a passkey is refused at share time with a plain
message, rather than arriving as a username and nothing else.

## 4. Drive layout

```
Swifty/                 the existing sync folder
  vault.swsync          the vault pack, untouched by sharing
  Shares/
    <random>.swshare    one share, appProperties: swiftyShare, entryId, kind, expiresAt
```

`appProperties` is the only metadata written. `swiftyShare=1` is the marker
every share carries, and the only thing listing selects on: shares are found by
it wherever they sit, so two devices racing to create `Shares/` and uploading
into their own copies hide nothing from the sweep or the revoke list. The
folder is only created by an upload, never by a listing, so accounts that never
share never gain one. `entryId` is the sender's local id, an opaque UUID that
lets the sender's own UI show a title without revealing it to Drive. `kind` is
the entry type. `expiresAt` is unix milliseconds, a duplicate of the
authenticated copy inside the envelope, there so the sweep can date a file
without its key. Listings follow `nextPageToken` to the end.

## 5. Lifetime and control

- Fixed 24-hour lifetime in v1, enforced where it can be: the recipient's app
  refuses an envelope whose authenticated `expiresAt` has passed, whether or
  not the file is still there. Deletion is the cleanup, not the enforcement.
- **Revoke** deletes the file. From the send dialog right after creating the
  link, or later from Settings › Sync › Shared links.
- **Sweep** lists every marked share and deletes anything past `expiresAt`. It
  runs at the end of every successful sync and whenever the active shares list
  is opened. Because the truth lives in Drive rather than a local ledger, any
  of the sender's devices can revoke or clean up, and nothing new is stored
  locally. A share with no readable expiry is never treated as expired.
- The recipient's app treats a missing file as "expired or revoked" and says so.
- The recipient downloads at most 2 MiB, checked against the declared length
  and again while streaming, with a 30-second deadline: the id in a pasted link
  can name any public file on Drive.

Burn-after-reading cannot be enforced without a server. Expiry plus revoke is
the honest approximation, and the UI says "expires" and "revoke", not "one
time".

## 6. What each side needs

| | Google account | Network | Env |
|---|---|---|---|
| Send | Drive connected (existing sync OAuth, `drive.file` scope) | yes | `GOOGLE_OAUTH_CLIENT_ID` |
| Receive | none | yes | `GOOGLE_API_KEY` |

The API key is a public identifier restricted to the Drive API, baked in at
compile time like the OAuth client id. A build without it can send but not
receive, and the receive dialog says which key is missing.

## 7. Backend API

`share::create(remote, entry, now_ms) -> Created { link, file_id, expires_at }`
`share::open(fetch, link, now_ms) -> Entry` (sanitized, empty id, unexpired)
`share::revoke(remote, file_id)`
`share::list(remote, now_ms) -> Vec<ActiveShare>` (also sweeps)
`share::sweep(remote, now_ms) -> usize`

Generic over `ShareRemote` and `PublicFetch`, so the whole lifecycle is tested
against an in-memory fake.

Exposed to the frontend as `share_create`, `share_open`, `share_revoke`,
`share_list`. All Drive calls run off the async runtime via `spawn_blocking`,
the way sync does.

## 8. Out of scope for v1

Live one-way and two-way shares (a separately keyed pack with Drive per-user
permissions, syncing through the existing engine), configurable expiry, QR
codes, deep-link opening of the token, and any recipient-side burn-on-read.
