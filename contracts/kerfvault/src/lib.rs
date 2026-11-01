#![no_std]
#![allow(clippy::too_many_arguments)]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env,
    Symbol, Vec,
};

/// Event topics for Kerfvault contract
pub const EVENT_BOOK_OPENED: Symbol = symbol_short!("opened");
pub const EVENT_NOTE_REDEEMED: Symbol = symbol_short!("redeemed");
pub const EVENT_BOOK_RECLAIMED: Symbol = symbol_short!("reclaimed");

/// Storage lifetime constants for persistent entries
pub const PERSISTENT_BUMP_AMOUNT: u32 = 518_400; // ~30 days @ 5s/ledger
pub const PERSISTENT_LIFETIME_THRESHOLD: u32 = 120_960; // ~7 days

/// Comprehensive failure error codes raised by Kerfvault contract
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
    InvalidAmount = 11,
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
    pub note_count: u32,
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
        env: Env,
        owner: Address,
        token: Address,
        voucher_key: BytesN<32>,
        denoms: Vec<i128>,
        redeem_deadline: u64,
    ) -> Result<u64, Error> {
        owner.require_auth();

        // Reject empty or malformed denominations before any escrow funds move
        if denoms.is_empty() {
            return Err(Error::InvalidDenominations);
        }

        let mut total: i128 = 0;
        for denom in denoms.iter() {
            if denom <= 0 {
                return Err(Error::InvalidDenominations);
            }
            total = total
                .checked_add(denom)
                .ok_or(Error::InvalidDenominations)?;
        }

        // Pull total escrow amount from owner into contract via SEP-41 token interface
        let contract_address = env.current_contract_address();
        let token_client = soroban_sdk::token::Client::new(&env, &token);
        token_client.transfer(&owner, &contract_address, &total);

        // Increment BookCount to assign unique book_id
        let book_id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::BookCount)
            .unwrap_or(0u64)
            .checked_add(1)
            .expect("overflow book_id");
        env.storage()
            .persistent()
            .set(&DataKey::BookCount, &book_id);

        let book = Book {
            owner: owner.clone(),
            token: token.clone(),
            voucher_key,
            redeem_deadline,
            free_balance: 0,
            note_count: denoms.len(),
        };

        // Extend persistent storage TTL for book on creation
        let book_key = DataKey::Book(book_id);
        env.storage().persistent().set(&book_key, &book);
        env.storage().persistent().extend_ttl(
            &book_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        for (idx, denom) in denoms.iter().enumerate() {
            let note = Note {
                denomination: denom,
                state: NoteState::Open,
            };
            let note_key = DataKey::Note(book_id, idx as u32);
            env.storage().persistent().set(&note_key, &note);
            env.storage().persistent().extend_ttl(
                &note_key,
                PERSISTENT_LIFETIME_THRESHOLD,
                PERSISTENT_BUMP_AMOUNT,
            );
        }

        // Emit EVENT_BOOK_OPENED event with book_id topic and metadata payload for indexer
        env.events().publish(
            (EVENT_BOOK_OPENED, book_id),
            (owner, token, total, denoms.len()),
        );

        Ok(book_id)
    }

    /// Redeems an offline voucher. Callable by anyone (merchant or relay); merchant address is bound in signature.
    pub fn redeem(
        env: Env,
        book_id: u64,
        note_index: u32,
        merchant: Address,
        amount: i128,
        cap: i128,
        accept_until: u64,
        signature: BytesN<64>,
    ) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if amount > cap {
            return Err(Error::AmountExceedsCap);
        }

        let book_key = DataKey::Book(book_id);
        let mut book: Book = env
            .storage()
            .persistent()
            .get(&book_key)
            .ok_or(Error::BookNotFound)?;

        let note_key = DataKey::Note(book_id, note_index);
        let mut note: Note = env
            .storage()
            .persistent()
            .get(&note_key)
            .ok_or(Error::NoteNotFound)?;

        if note.state != NoteState::Open {
            return Err(Error::NoteAlreadyRedeemed);
        }

        if amount > note.denomination {
            return Err(Error::AmountExceedsNote);
        }

        // Rebuild canonical voucher message
        let contract_address = env.current_contract_address();
        let msg = voucher_message(
            &env,
            &contract_address,
            book_id,
            note_index,
            &merchant,
            amount,
            cap,
            accept_until,
        );

        // Verify Ed25519 signature over canonical voucher message against book's voucher_key
        env.crypto()
            .ed25519_verify(&book.voucher_key, &msg, &signature);

        // Transfer payout to merchant via SEP-41 token interface
        let token_client = soroban_sdk::token::Client::new(&env, &book.token);
        token_client.transfer(&contract_address, &merchant, &amount);

        // Update note state to Redeemed
        note.state = NoteState::Redeemed;
        env.storage().persistent().set(&note_key, &note);
        env.storage().persistent().extend_ttl(
            &note_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // Credit unused note remainder (denomination - amount) to book's free balance
        let refund = note.denomination - amount;
        book.free_balance = book
            .free_balance
            .checked_add(refund)
            .expect("overflow free_balance");
        env.storage().persistent().set(&book_key, &book);
        env.storage().persistent().extend_ttl(
            &book_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        env.events().publish(
            (EVENT_NOTE_REDEEMED, book_id),
            (note_index, merchant, amount),
        );

        Ok(())
    }

    /// Owner withdraws unredeemed notes and free balance after redeem_deadline + grace period.
    /// Deferred to production hardening phase (see docs/ROADMAP.md).
    pub fn reclaim(_env: Env, _book_id: u64) -> Result<(), Error> {
        todo!("reclaim is deferred to the second half (see docs/ROADMAP.md)")
    }

    /// Extends storage TTL for a book and its notes in persistent storage.
    /// Standalone manual TTL extension is deferred to roadmap.
    pub fn extend_ttl(_env: Env, _book_id: u64) -> Result<(), Error> {
        todo!("standalone extend_ttl is deferred to the second half (see docs/ROADMAP.md)")
    }

    /// Returns book metadata by ID (read-only getter with TTL refresh).
    pub fn get_book(env: Env, book_id: u64) -> Result<Book, Error> {
        let key = DataKey::Book(book_id);
        let book = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::BookNotFound)?;
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
        Ok(book)
    }

    /// Returns note metadata for a given book and note index (read-only getter with TTL refresh).
    pub fn get_note(env: Env, book_id: u64, note_index: u32) -> Result<Note, Error> {
        let key = DataKey::Note(book_id, note_index);
        let note = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NoteNotFound)?;
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
        Ok(note)
    }
}

#[cfg(test)]
mod test;
