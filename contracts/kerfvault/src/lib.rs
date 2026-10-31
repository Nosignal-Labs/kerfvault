#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env,
    Symbol, Vec,
};

/// Event topics for Kerfvault contract
pub const EVENT_BOOK_OPENED: Symbol = symbol_short!("opened");
pub const EVENT_NOTE_REDEEMED: Symbol = symbol_short!("redeemed");
pub const EVENT_BOOK_RECLAIMED: Symbol = symbol_short!("reclaimed");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    BookNotFound = 1,
    NoteNotFound = 2,
    NoteAlreadyRedeemed = 3,
    InvalidSignature = 4,
    VoucherExpired = 5,
    AmountExceedsCap = 6,
    AmountExceedsNote = 7,
    DeadlineNotReached = 8,
    NotOwner = 9,
    InvalidDenominations = 10,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Book(u64),
    Note(u64, u32),
    BookCount,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum NoteState {
    Open = 0,
    Redeemed = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Book {
    pub owner: Address,
    pub token: Address,
    pub voucher_key: BytesN<32>,
    pub redeem_deadline: u64,
    pub free_balance: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Note {
    pub denomination: i128,
    pub state: NoteState,
}

/// Constructs canonical byte payload for offline voucher signing.
/// Reference: docs/VOUCHER_SPEC.md
pub fn voucher_message(
    env: &Env,
    contract_id: &Address,
    book_id: u64,
    note_index: u32,
    merchant: &Address,
    amount: i128,
    cap: i128,
    accept_until: u64,
) -> Bytes {
    let mut msg = Bytes::new(env);

    // 1. Domain tag: "KERFVAULT_V1\0\0\0\0" (16 bytes)
    let domain: [u8; 16] = *b"KERFVAULT_V1\0\0\0\0";
    msg.append(&Bytes::from_array(env, &domain));

    // 2. Version: 1 (1 byte)
    msg.append(&Bytes::from_array(env, &[1u8]));

    // 3. Contract ID: 56 ASCII bytes (StrKey)
    let mut cid_buf = [0u8; 56];
    contract_id.to_string().copy_into_slice(&mut cid_buf);
    msg.append(&Bytes::from_array(env, &cid_buf));

    // 4. Book ID: 8 bytes big-endian
    msg.append(&Bytes::from_array(env, &book_id.to_be_bytes()));

    // 5. Note Index: 4 bytes big-endian
    msg.append(&Bytes::from_array(env, &note_index.to_be_bytes()));

    // 6. Merchant Address: 56 ASCII bytes (StrKey)
    let mut merch_buf = [0u8; 56];
    merchant.to_string().copy_into_slice(&mut merch_buf);
    msg.append(&Bytes::from_array(env, &merch_buf));

    // 7. Amount: 16 bytes big-endian
    msg.append(&Bytes::from_array(env, &amount.to_be_bytes()));

    // 8. Cap: 16 bytes big-endian
    msg.append(&Bytes::from_array(env, &cap.to_be_bytes()));

    // 9. Accept Until: 8 bytes big-endian
    msg.append(&Bytes::from_array(env, &accept_until.to_be_bytes()));

    msg
}

#[contract]
pub struct KerfvaultContract;

#[contractimpl]
impl KerfvaultContract {
    /// Owner locks funds into a book of fixed denomination notes.
    pub fn open_book(
        _env: Env,
        _owner: Address,
        _token: Address,
        _voucher_key: BytesN<32>,
        _denoms: Vec<i128>,
        _redeem_deadline: u64,
    ) -> Result<u64, Error> {
        // TODO: Require owner authorization, transfer tokens to contract via SEP-41, store book and notes, emit book_opened event
        todo!("open_book: lock tokens, populate notes, persist state, and emit book_opened event")
    }

    /// Redeems an offline voucher. Callable by anyone (merchant or relay); merchant address is bound in signature.
    pub fn redeem(
        _env: Env,
        _book_id: u64,
        _note_index: u32,
        _merchant: Address,
        _amount: i128,
        _cap: i128,
        _accept_until: u64,
        _signature: BytesN<64>,
    ) -> Result<(), Error> {
        // TODO: Validate note state, verify ed25519 signature, transfer payment to merchant via SEP-41, credit remaining note diff to free_balance, emit note_redeemed event
        todo!("redeem: verify voucher signature, transfer SEP-41 tokens, update note state, emit note_redeemed")
    }

    /// Owner withdraws unredeemed notes and free balance after redeem_deadline + grace period.
    pub fn reclaim(_env: Env, _book_id: u64) -> Result<(), Error> {
        // TODO: Require owner auth, ensure deadline + grace period has passed, refund unredeemed note amounts and free balance, emit book_reclaimed event
        todo!("reclaim: verify grace period expiry, refund remaining balance to owner, emit book_reclaimed")
    }

    /// Extends storage TTL for a book and its notes in persistent storage.
    pub fn extend_ttl(_env: Env, _book_id: u64) -> Result<(), Error> {
        // TODO: Extend persistent storage TTL for book entry and note entries using env.storage().persistent().extend_ttl(...)
        todo!("extend_ttl: extend persistent storage lifetime for book and associated notes")
    }

    /// Returns book metadata by ID.
    pub fn get_book(env: Env, book_id: u64) -> Result<Book, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Book(book_id))
            .ok_or(Error::BookNotFound)
    }

    /// Returns note metadata for a given book and note index.
    pub fn get_note(env: Env, book_id: u64, note_index: u32) -> Result<Note, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Note(book_id, note_index))
            .ok_or(Error::NoteNotFound)
    }
}

#[cfg(test)]
mod test;
