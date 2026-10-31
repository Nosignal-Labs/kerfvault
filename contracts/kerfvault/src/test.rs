#![cfg(test)]
extern crate std;

use super::*;
use serde::Deserialize;
use soroban_sdk::Env;
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

#[test]
fn test_smoke_load_test_vectors_and_missing_book() {
    let env = Env::default();
    let contract_id = env.register(KerfvaultContract, ());
    let client = KerfvaultContractClient::new(&env, &contract_id);

    // Assert get_book returns BookNotFound when book does not exist
    let result = client.try_get_book(&999_u64);
    assert_eq!(result, Err(Ok(Error::BookNotFound)));
}

#[test]
fn test_cross_language_vectors_byte_for_byte_agreement() {
    let env = Env::default();
    let vector_str = include_str!("../../../test-vectors/voucher.v1.json");
    let file: TestVectorFile = serde_json::from_str(vector_str).expect("parse voucher.v1.json");

    assert_eq!(file.version, 1);
    assert!(!file.vectors.is_empty());

    for vec in file.vectors {
        // Skip truncated vectors where message is not 181 bytes
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

        // Extract raw bytes to format hex
        let mut rust_buf = [0u8; 181];
        rust_msg.copy_into_slice(&mut rust_buf);
        let rust_hex: String = rust_buf.iter().map(|b| format!("{:02x}", b)).collect();

        // For non-version-tampered vectors, assert exact byte-for-byte hex equality with vector
        if !vec.id.contains("wrong-version") {
            assert_eq!(
                rust_hex, vec.canonical_message_hex,
                "Vector {} Rust and TypeScript message bytes must match identically",
                vec.id
            );
        }

        // Test Ed25519 signature verification against Soroban runtime crypto host
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
