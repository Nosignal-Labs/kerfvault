#![cfg(test)]
extern crate std;

use super::*;
use ed25519_dalek::{Signer, SigningKey};
use serde::Deserialize;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{vec, Env};
use std::format;
use std::string::String;
use std::vec::Vec;

#[derive(Deserialize)]
struct TestVectorFile {
    version: u32,
    vectors: Vec<TestVector>,
}

#[derive(Deserialize)]
struct TestVector {
    id: String,
    #[serde(rename = "voucherKeyHex")]
    voucher_key_hex: String,
    #[serde(rename = "contractId")]
    contract_id: String,
    #[serde(rename = "bookId")]
    book_id: u64,
    #[serde(rename = "noteIndex")]
    note_index: u32,
    merchant: String,
    amount: String,
    cap: String,
    #[serde(rename = "acceptUntil")]
    accept_until: u64,
    #[serde(rename = "canonicalMessageHex")]
    canonical_message_hex: String,
    #[serde(rename = "signatureHex")]
    signature_hex: String,
    #[serde(rename = "expectedValid")]
    expected_valid: bool,
}

fn hex_to_bytes(hex_str: &str) -> Vec<u8> {
    (0..hex_str.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex_str[i..i + 2], 16).expect("valid hex"))
        .collect()
}

struct TestFixture<'a> {
    env: Env,
    contract_id: Address,
    client: KerfvaultContractClient<'a>,
    token_address: Address,
    token_client: soroban_sdk::token::Client<'a>,
    signing_key: SigningKey,
    voucher_key_bytes: BytesN<32>,
}

impl<'a> TestFixture<'a> {
    fn new(env: Env) -> Self {
        env.mock_all_auths();
        let contract_id = env.register(KerfvaultContract, ());
        let client = KerfvaultContractClient::new(&env, &contract_id);

        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = soroban_sdk::token::Client::new(&env, &token_contract.address());

        // Throwaway deterministic test signing key
        let seed = [42u8; 32];
        let signing_key = SigningKey::from_bytes(&seed);
        let voucher_key_bytes = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

        TestFixture {
            env,
            contract_id,
            client,
            token_address: token_contract.address(),
            token_client,
            signing_key,
            voucher_key_bytes,
        }
    }

    fn mint(&self, to: &Address, amount: i128) {
        let admin_client =
            soroban_sdk::token::StellarAssetClient::new(&self.env, &self.token_address);
        admin_client.mint(to, &amount);
    }

    fn sign(
        &self,
        book_id: u64,
        note_index: u32,
        merchant: &Address,
        amount: i128,
        cap: i128,
        accept_until: u64,
    ) -> BytesN<64> {
        let msg = voucher_message(
            &self.env,
            &self.contract_id,
            book_id,
            note_index,
            merchant,
            amount,
            cap,
            accept_until,
        );
        let mut msg_buf = [0u8; 181];
        msg.copy_into_slice(&mut msg_buf);
        let sig = self.signing_key.sign(&msg_buf);
        BytesN::from_array(&self.env, &sig.to_bytes())
    }
}

#[test]
fn test_smoke_load_test_vectors_and_missing_book() {
    let env = Env::default();
    let contract_id = env.register(KerfvaultContract, ());
    let client = KerfvaultContractClient::new(&env, &contract_id);

    // Assert get_book returns BookNotFound when book does not exist
    let result = client.try_get_book(&999_u64);
    assert_eq!(result, Err(Ok(Error::BookNotFound)));

    let note_result = client.try_get_note(&999_u64, &0);
    assert_eq!(note_result, Err(Ok(Error::NoteNotFound)));
}

#[test]
fn test_cross_language_vectors_byte_for_byte_agreement() {
    let env = Env::default();
    let vector_str = include_str!("../../../test-vectors/voucher.v1.json");
    let file: TestVectorFile = serde_json::from_str(vector_str).expect("parse voucher.v1.json");

    assert_eq!(file.version, 1);
    assert!(!file.vectors.is_empty());

    for vec in file.vectors {
        if vec.id.contains("truncated") {
            continue;
        }

        let cid_addr = Address::from_str(&env, &vec.contract_id);
        let merch_addr = Address::from_str(&env, &vec.merchant);
        let amount: i128 = vec.amount.parse().expect("valid amount i128");
        let cap: i128 = vec.cap.parse().expect("valid cap i128");

        let rust_msg = voucher_message(
            &env,
            &cid_addr,
            vec.book_id,
            vec.note_index,
            &merch_addr,
            amount,
            cap,
            vec.accept_until,
        );

        assert_eq!(
            rust_msg.len(),
            181,
            "Vector {} canonical message must be exactly 181 bytes",
            vec.id
        );

        let mut rust_buf = [0u8; 181];
        rust_msg.copy_into_slice(&mut rust_buf);
        let rust_hex: String = rust_buf.iter().map(|b| format!("{:02x}", b)).collect();

        if !vec.id.contains("wrong-version") {
            assert_eq!(
                rust_hex, vec.canonical_message_hex,
                "Vector {} Rust and TypeScript message bytes must match identically",
                vec.id
            );
        }

        let key_raw = hex_to_bytes(&vec.voucher_key_hex);
        assert_eq!(key_raw.len(), 32);
        let mut key_arr = [0u8; 32];
        key_arr.copy_from_slice(&key_raw);
        let key_bytes = BytesN::from_array(&env, &key_arr);

        let sig_raw = hex_to_bytes(&vec.signature_hex);
        assert_eq!(sig_raw.len(), 64);
        let mut sig_arr = [0u8; 64];
        sig_arr.copy_from_slice(&sig_raw);
        let sig_bytes = BytesN::from_array(&env, &sig_arr);

        let verify_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            env.crypto()
                .ed25519_verify(&key_bytes, &rust_msg, &sig_bytes);
        }));

        if vec.expected_valid {
            assert!(
                verify_result.is_ok(),
                "Valid vector {} must pass Soroban ed25519_verify",
                vec.id
            );
        } else if vec.id.contains("tampered")
            || vec.id.contains("wrong-contract")
            || vec.id.contains("wrong-book")
            || vec.id.contains("corrupted")
        {
            assert!(
                verify_result.is_err(),
                "Tampered vector {} must fail Soroban ed25519_verify",
                vec.id
            );
        }
    }
}

#[test]
fn test_open_book_success_and_getters() {
    let env = Env::default();
    let fix = TestFixture::new(env);
    let owner = Address::generate(&fix.env);

    fix.mint(&owner, 60_000_000);
    let denoms = vec![&fix.env, 10_000_000, 20_000_000, 30_000_000];

    let book_id = fix
        .client
        .open_book(&owner, &fix.token_address, &fix.voucher_key_bytes, &denoms, &1793404800);
    assert_eq!(book_id, 1);

    // Assert contract received total 60 XLM
    assert_eq!(fix.token_client.balance(&fix.contract_id), 60_000_000);
    assert_eq!(fix.token_client.balance(&owner), 0);

    // Assert get_book returns matching metadata
    let book = fix.client.get_book(&book_id);
    assert_eq!(book.owner, owner);
    assert_eq!(book.token, fix.token_address);
    assert_eq!(book.voucher_key, fix.voucher_key_bytes);
    assert_eq!(book.redeem_deadline, 1793404800);
    assert_eq!(book.free_balance, 0);
    assert_eq!(book.note_count, 3);

    // Assert all notes are Open with matching denominations
    for (i, expected_denom) in [10_000_000, 20_000_000, 30_000_000].iter().enumerate() {
        let note = fix.client.get_note(&book_id, &(i as u32));
        assert_eq!(note.denomination, *expected_denom);
        assert_eq!(note.state, NoteState::Open);
    }
}

#[test]
fn test_open_book_rejects_invalid_denominations() {
    let env = Env::default();
    let fix = TestFixture::new(env);
    let owner = Address::generate(&fix.env);
    fix.mint(&owner, 100_000_000);

    // 1. Empty denominations
    let empty_denoms = vec![&fix.env];
    let err_empty = fix.client.try_open_book(
        &owner,
        &fix.token_address,
        &fix.voucher_key_bytes,
        &empty_denoms,
        &1793404800,
    );
    assert_eq!(err_empty, Err(Ok(Error::InvalidDenominations)));

    // 2. Zero denomination
    let zero_denom = vec![&fix.env, 0];
    let err_zero = fix.client.try_open_book(
        &owner,
        &fix.token_address,
        &fix.voucher_key_bytes,
        &zero_denom,
        &1793404800,
    );
    assert_eq!(err_zero, Err(Ok(Error::InvalidDenominations)));

    // 3. Negative denomination
    let neg_denom = vec![&fix.env, -10_000_000];
    let err_neg = fix.client.try_open_book(
        &owner,
        &fix.token_address,
        &fix.voucher_key_bytes,
        &neg_denom,
        &1793404800,
    );
    assert_eq!(err_neg, Err(Ok(Error::InvalidDenominations)));
}

#[test]
fn test_redeem_happy_path_and_unused_remainder_refund() {
    let env = Env::default();
    let fix = TestFixture::new(env);
    let owner = Address::generate(&fix.env);
    let merchant = Address::generate(&fix.env);

    fix.mint(&owner, 50_000_000);
    let denoms = vec![&fix.env, 10_000_000, 40_000_000];
    let book_id = fix
        .client
        .open_book(&owner, &fix.token_address, &fix.voucher_key_bytes, &denoms, &1793404800);

    // Sign voucher spending 7 XLM out of 10 XLM note 0 with cap 10 XLM
    let amount = 7_000_000;
    let cap = 10_000_000;
    let accept_until = 1793404800;
    let sig = fix.sign(book_id, 0, &merchant, amount, cap, accept_until);

    // Call redeem
    fix.client
        .redeem(&book_id, &0, &merchant, &amount, &cap, &accept_until, &sig);

    // Assert merchant received 7 XLM
    assert_eq!(fix.token_client.balance(&merchant), 7_000_000);

    // Assert note 0 is marked Redeemed
    let note0 = fix.client.get_note(&book_id, &0);
    assert_eq!(note0.state, NoteState::Redeemed);

    // Assert unused note difference (3 XLM) refunded to book's free_balance
    let book = fix.client.get_book(&book_id);
    assert_eq!(book.free_balance, 3_000_000);

    // Assert contract balance equals remaining escrow (40 XLM in note 1 + 3 XLM in free_balance)
    assert_eq!(fix.token_client.balance(&fix.contract_id), 43_000_000);
}

#[test]
fn test_redeem_blocks_double_redeem() {
    let env = Env::default();
    let fix = TestFixture::new(env);
    let owner = Address::generate(&fix.env);
    let merchant = Address::generate(&fix.env);

    fix.mint(&owner, 20_000_000);
    let denoms = vec![&fix.env, 20_000_000];
    let book_id = fix
        .client
        .open_book(&owner, &fix.token_address, &fix.voucher_key_bytes, &denoms, &1793404800);

    let amount = 20_000_000;
    let cap = 20_000_000;
    let accept_until = 1793404800;
    let sig = fix.sign(book_id, 0, &merchant, amount, cap, accept_until);

    // First redemption succeeds
    fix.client
        .redeem(&book_id, &0, &merchant, &amount, &cap, &accept_until, &sig);

    // Second redemption must fail with NoteAlreadyRedeemed
    let result = fix
        .client
        .try_redeem(&book_id, &0, &merchant, &amount, &cap, &accept_until, &sig);
    assert_eq!(result, Err(Ok(Error::NoteAlreadyRedeemed)));
}

#[test]
fn test_redeem_rejects_adversarial_vouchers() {
    let env = Env::default();
    let fix = TestFixture::new(env);
    let owner = Address::generate(&fix.env);
    let merchant = Address::generate(&fix.env);
    let other_merchant = Address::generate(&fix.env);

    fix.mint(&owner, 20_000_000);
    let denoms = vec![&fix.env, 10_000_000, 10_000_000];
    let book_id = fix
        .client
        .open_book(&owner, &fix.token_address, &fix.voucher_key_bytes, &denoms, &1793404800);

    // 1. Amount exceeds cap
    let res_cap = fix.client.try_redeem(
        &book_id,
        &0,
        &merchant,
        &12_000_000, // amount > cap
        &10_000_000, // cap
        &1793404800,
        &BytesN::from_array(&fix.env, &[0u8; 64]),
    );
    assert_eq!(res_cap, Err(Ok(Error::AmountExceedsCap)));

    // 2. Amount exceeds note denomination
    let res_note = fix.client.try_redeem(
        &book_id,
        &0,
        &merchant,
        &15_000_000, // amount > note (10 XLM)
        &20_000_000, // cap
        &1793404800,
        &BytesN::from_array(&fix.env, &[0u8; 64]),
    );
    assert_eq!(res_note, Err(Ok(Error::AmountExceedsNote)));

    // 3. Invalid amount <= 0
    let res_zero = fix.client.try_redeem(
        &book_id,
        &0,
        &merchant,
        &0,
        &10_000_000,
        &1793404800,
        &BytesN::from_array(&fix.env, &[0u8; 64]),
    );
    assert_eq!(res_zero, Err(Ok(Error::InvalidAmount)));

    // 4. Nonexistent book
    let res_no_book = fix.client.try_redeem(
        &999,
        &0,
        &merchant,
        &5_000_000,
        &10_000_000,
        &1793404800,
        &BytesN::from_array(&fix.env, &[0u8; 64]),
    );
    assert_eq!(res_no_book, Err(Ok(Error::BookNotFound)));

    // 5. Nonexistent note
    let res_no_note = fix.client.try_redeem(
        &book_id,
        &99,
        &merchant,
        &5_000_000,
        &10_000_000,
        &1793404800,
        &BytesN::from_array(&fix.env, &[0u8; 64]),
    );
    assert_eq!(res_no_note, Err(Ok(Error::NoteNotFound)));

    // 6. Signature signed for note 0 but submitted for note 1 (cross-note attack)
    let sig0 = fix.sign(book_id, 0, &merchant, 5_000_000, 10_000_000, 1793404800);
    let cross_note_res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fix.client
            .redeem(&book_id, &1, &merchant, &5_000_000, &10_000_000, &1793404800, &sig0);
    }));
    assert!(cross_note_res.is_err(), "Cross-note signature must fail");

    // 7. Signature signed for merchant A but submitted for other_merchant (redirect attack)
    let redirect_res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fix.client
            .redeem(&book_id, &0, &other_merchant, &5_000_000, &10_000_000, &1793404800, &sig0);
    }));
    assert!(redirect_res.is_err(), "Redirect attack signature must fail");
}

#[test]
fn test_balance_invariant_after_every_operation() {
    let env = Env::default();
    let fix = TestFixture::new(env);
    let owner = Address::generate(&fix.env);
    let merchant = Address::generate(&fix.env);

    let denoms_arr = [10_000_000, 20_000_000, 30_000_000];
    let total_deposit: i128 = denoms_arr.iter().sum();
    fix.mint(&owner, total_deposit);

    let denoms = vec![&fix.env, 10_000_000, 20_000_000, 30_000_000];
    let book_id = fix
        .client
        .open_book(&owner, &fix.token_address, &fix.voucher_key_bytes, &denoms, &1793404800);

    let check_invariant = || {
        let contract_bal = fix.token_client.balance(&fix.contract_id);
        let book = fix.client.get_book(&book_id);

        let mut open_notes_sum: i128 = 0;
        for i in 0..book.note_count {
            let note = fix.client.get_note(&book_id, &i);
            if note.state == NoteState::Open {
                open_notes_sum += note.denomination;
            }
        }

        assert_eq!(
            contract_bal,
            book.free_balance + open_notes_sum,
            "INVARIANT VIOLATION: Contract balance ({}) != free_balance ({}) + open_notes_sum ({})",
            contract_bal,
            book.free_balance,
            open_notes_sum
        );
    };

    // 1. Invariant holds immediately after open_book
    check_invariant();

    // 2. Invariant holds after partial redemption of note 0 (spending 6 of 10 XLM)
    let sig0 = fix.sign(book_id, 0, &merchant, 6_000_000, 10_000_000, 1793404800);
    fix.client
        .redeem(&book_id, &0, &merchant, &6_000_000, &10_000_000, &1793404800, &sig0);
    check_invariant();

    // 3. Invariant holds after full redemption of note 1 (spending 20 of 20 XLM)
    let sig1 = fix.sign(book_id, 1, &merchant, 20_000_000, 20_000_000, 1793404800);
    fix.client
        .redeem(&book_id, &1, &merchant, &20_000_000, &20_000_000, &1793404800, &sig1);
    check_invariant();

    // 4. Invariant holds after partial redemption of note 2 (spending 1 of 30 XLM)
    let sig2 = fix.sign(book_id, 2, &merchant, 1_000_000, 30_000_000, 1793404800);
    fix.client
        .redeem(&book_id, &2, &merchant, &1_000_000, &30_000_000, &1793404800, &sig2);
    check_invariant();

    // Final checks: all notes redeemed, free balance is 4 + 0 + 29 = 33 XLM, contract balance is 33 XLM
    let book = fix.client.get_book(&book_id);
    assert_eq!(book.free_balance, 33_000_000);
    assert_eq!(fix.token_client.balance(&fix.contract_id), 33_000_000);
    assert_eq!(fix.token_client.balance(&merchant), 27_000_000);
}

#[test]
fn test_forged_and_cross_note_signatures_rejected() {
    let env = Env::default();
    let fix = TestFixture::new(env);
    let owner = Address::generate(&fix.env);
    let merchant = Address::generate(&fix.env);
    let attacker_merchant = Address::generate(&fix.env);

    fix.mint(&owner, 50_000_000);
    let denoms = vec![&fix.env, 10_000_000, 20_000_000];
    let book_id = fix
        .client
        .open_book(&owner, &fix.token_address, &fix.voucher_key_bytes, &denoms, &1793404800);

    // 1. Completely forged signature (invalid Ed25519 signature)
    let forged_arr = [0x5au8; 64];
    let forged_sig = BytesN::from_array(&fix.env, &forged_arr);
    let res_forged = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fix.client
            .redeem(&book_id, &0, &merchant, &5_000_000, &10_000_000, &1793404800, &forged_sig);
    }));
    assert!(res_forged.is_err(), "Forged random signature must be rejected");

    // 2. Signature from an attacker's key (not the book's voucher key)
    let attacker_seed = [99u8; 32];
    let attacker_key = SigningKey::from_bytes(&attacker_seed);
    let msg = voucher_message(
        &fix.env,
        &fix.contract_id,
        book_id,
        0,
        &merchant,
        5_000_000,
        10_000_000,
        1793404800,
    );
    let mut msg_buf = [0u8; 181];
    msg.copy_into_slice(&mut msg_buf);
    let attacker_sig = attacker_key.sign(&msg_buf);
    let attacker_sig_bytes = BytesN::from_array(&fix.env, &attacker_sig.to_bytes());
    let res_attacker = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fix.client.redeem(
            &book_id,
            &0,
            &merchant,
            &5_000_000,
            &10_000_000,
            &1793404800,
            &attacker_sig_bytes,
        );
    }));
    assert!(res_attacker.is_err(), "Signature from unauthorized key must be rejected");

    // 3. Valid signature for note 0 replayed against note 1
    let valid_sig_note0 = fix.sign(book_id, 0, &merchant, 5_000_000, 10_000_000, 1793404800);
    let res_cross_note = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fix.client.redeem(
            &book_id,
            &1,
            &merchant,
            &5_000_000,
            &10_000_000,
            &1793404800,
            &valid_sig_note0,
        );
    }));
    assert!(res_cross_note.is_err(), "Cross-note signature replay must be rejected");

    // 4. Valid signature for book 1 replayed against book 2
    let denoms2 = vec![&fix.env, 10_000_000];
    fix.mint(&owner, 10_000_000);
    let book_id_2 = fix
        .client
        .open_book(&owner, &fix.token_address, &fix.voucher_key_bytes, &denoms2, &1793404800);
    let res_cross_book = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fix.client.redeem(
            &book_id_2,
            &0,
            &merchant,
            &5_000_000,
            &10_000_000,
            &1793404800,
            &valid_sig_note0,
        );
    }));
    assert!(res_cross_book.is_err(), "Cross-book signature replay must be rejected");

    // 5. Valid signature redirected to attacker merchant
    let res_redirect = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fix.client.redeem(
            &book_id,
            &0,
            &attacker_merchant,
            &5_000_000,
            &10_000_000,
            &1793404800,
            &valid_sig_note0,
        );
    }));
    assert!(res_redirect.is_err(), "Payee redirect signature replay must be rejected");
}
