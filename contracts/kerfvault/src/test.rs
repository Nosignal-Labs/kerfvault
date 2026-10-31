#![cfg(test)]

use super::*;
use soroban_sdk::Env;

#[test]
fn test_smoke_load_test_vectors_and_missing_book() {
    let env = Env::default();
    let contract_id = env.register(KerfvaultContract, ());
    let client = KerfvaultContractClient::new(&env, &contract_id);

    // Assert shared test vectors file is loaded and parses basic schema
    let vector_str = include_str!("../../../test-vectors/voucher.v1.json");
    assert!(
        !vector_str.is_empty(),
        "test-vectors/voucher.v1.json must not be empty"
    );
    assert!(
        vector_str.contains("\"version\": 1"),
        "test vectors must declare version 1"
    );

    // Assert get_book returns BookNotFound when book does not exist
    let result = client.try_get_book(&999_u64);
    assert_eq!(result, Err(Ok(Error::BookNotFound)));
}
