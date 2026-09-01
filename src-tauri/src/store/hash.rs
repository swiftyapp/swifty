//! Content hashing for sync: a canonical fingerprint per record, and a digest
//! over the whole entry table.
//!
//! Both are consumed by the sync engine as *comparison* primitives, so the only
//! property that matters is that two stores agree bit-for-bit on the same
//! content — never that the bytes are secret. The encoding is therefore fixed
//! and injective, not merely "hash the fields": every variable-length field is
//! length-prefixed and every `Option` carries a presence tag, so no two
//! different records can share a preimage. Naive concatenation would let
//! ("ab", "c") and ("a", "bc") collide, which in the merge tie-break would mean
//! two genuinely different records comparing equal and one silently winning.

use sha2::{Digest, Sha256};

use super::Record;

/// `u64` LE length, then the bytes. The prefix is what makes the concatenation
/// of fields unambiguous.
fn field(h: &mut Sha256, bytes: &[u8]) {
    h.update((bytes.len() as u64).to_le_bytes());
    h.update(bytes);
}

/// Presence tag (0/1) then, when present, the 8-byte LE value. `None` and
/// `Some(0)` must not encode alike.
fn opt_i64(h: &mut Sha256, v: Option<i64>) {
    match v {
        None => h.update([0u8]),
        Some(n) => {
            h.update([1u8]);
            h.update(n.to_le_bytes());
        }
    }
}

fn opt_field(h: &mut Sha256, v: Option<&str>) {
    match v {
        None => h.update([0u8]),
        Some(s) => {
            h.update([1u8]);
            field(h, s.as_bytes());
        }
    }
}

/// SHA-256 over a record's content: everything that makes two rows the same
/// row, in a fixed field order.
///
/// `id` is deliberately excluded — it is the key the comparison is made *under*
/// (records are only ever hashed against another record of the same id), so
/// including it would add nothing. [`state_digest`] adds it back, because there
/// the identity of each row is part of what is being fingerprinted.
///
/// Timestamps are included: a record whose only change is `updated_at` is a
/// different record for merge purposes.
pub fn record_hash(r: &Record) -> [u8; 32] {
    let mut h = Sha256::new();
    field(&mut h, r.kind.as_bytes());
    field(&mut h, r.title.as_bytes());
    field(&mut h, r.tags.as_bytes());
    field(&mut h, r.url_host.as_bytes());
    h.update(r.created_at.to_le_bytes());
    h.update(r.updated_at.to_le_bytes());
    opt_i64(&mut h, r.deleted_at);
    field(&mut h, &r.payload);
    opt_field(&mut h, r.card_brand.as_deref());
    h.finalize().into()
}

/// SHA-256 over an entire entry set — tombstones included — as
/// (length-prefixed id, [`record_hash`]) pairs in ascending id byte order.
///
/// Equal digests mean identical entry state, which is what lets the sync engine
/// decide a push by digest inequality alone. Sorting happens here rather than
/// being inherited from a caller's `ORDER BY` so the ordering contract stays
/// with the definition of the digest.
pub fn state_digest(recs: &[Record]) -> [u8; 32] {
    let mut order: Vec<&Record> = recs.iter().collect();
    order.sort_unstable_by(|a, b| a.id.as_bytes().cmp(b.id.as_bytes()));

    let mut h = Sha256::new();
    for r in order {
        field(&mut h, r.id.as_bytes());
        h.update(record_hash(r));
    }
    h.finalize().into()
}
