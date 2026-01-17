//! Cryptography module for backup encryption
//!
//! Provides AES-256-GCM encryption with Argon2id key derivation.
//! All backups are encrypted with a user-provided password.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::SaltString;
use crate::error::{AppError, Result};
use rand::RngCore;

const NONCE_SIZE: usize = 12; // 96 bits for GCM
const SALT_SIZE: usize = 16; // 128 bits

/// Encrypted data container
#[derive(serde::Serialize, serde::Deserialize)]
pub struct EncryptedData {
    pub salt: Vec<u8>,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

/// Encrypt data with AES-256-GCM
pub fn encrypt(plaintext: &[u8], password: &str) -> Result<EncryptedData> {
    // Generate random salt
    let mut salt = vec![0u8; SALT_SIZE];
    OsRng.fill_bytes(&mut salt);

    // Derive key from password using Argon2id
    let key = derive_key(password, &salt)?;

    // Generate random nonce
    let mut nonce_bytes = vec![0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AppError::Generic(format!("Cipher initialization failed: {}", e)))?;

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::Generic(format!("Encryption failed: {}", e)))?;

    Ok(EncryptedData {
        salt,
        nonce: nonce_bytes,
        ciphertext,
    })
}

/// Decrypt data with AES-256-GCM
pub fn decrypt(encrypted: &EncryptedData, password: &str) -> Result<Vec<u8>> {
    // Derive key from password and salt
    let key = derive_key(password, &encrypted.salt)?;

    let nonce = Nonce::from_slice(&encrypted.nonce);

    // Decrypt
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AppError::Generic(format!("Cipher initialization failed: {}", e)))?;

    let plaintext = cipher
        .decrypt(nonce, encrypted.ciphertext.as_ref())
        .map_err(|e| AppError::Generic(format!("Decryption failed: {}", e)))?;

    Ok(plaintext)
}

/// Derive 256-bit key from password using Argon2id
fn derive_key(password: &str, salt: &[u8]) -> Result<Vec<u8>> {
    let argon2 = Argon2::default();

    // Convert salt to SaltString format
    let salt_string = SaltString::encode_b64(salt)
        .map_err(|e| AppError::Generic(format!("Salt encoding failed: {}", e)))?;

    // Hash password
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| AppError::Generic(format!("Key derivation failed: {}", e)))?;

    // Extract the derived key (32 bytes for AES-256)
    let hash = password_hash.hash
        .ok_or_else(|| AppError::Generic("No hash generated".to_string()))?;

    // Argon2 produces a hash, we need exactly 32 bytes for AES-256
    let key_bytes = hash.as_bytes();
    if key_bytes.len() < 32 {
        return Err(AppError::Generic("Derived key too short".to_string()));
    }

    Ok(key_bytes[..32].to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let plaintext = b"Hello, World! This is a secret message.";
        let password = "test_password_123";

        // Encrypt
        let encrypted = encrypt(plaintext, password).unwrap();

        // Decrypt
        let decrypted = decrypt(&encrypted, password).unwrap();

        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_wrong_password() {
        let plaintext = b"Secret data";
        let password = "correct_password";

        let encrypted = encrypt(plaintext, password).unwrap();

        // Try to decrypt with wrong password
        let result = decrypt(&encrypted, "wrong_password");

        assert!(result.is_err());
    }

    #[test]
    fn test_different_salts() {
        let password = "same_password";
        let plaintext = b"Same data";

        let encrypted1 = encrypt(plaintext, password).unwrap();
        let encrypted2 = encrypt(plaintext, password).unwrap();

        // Different salts should produce different ciphertexts
        assert_ne!(encrypted1.salt, encrypted2.salt);
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext);

        // But both should decrypt correctly
        let decrypted1 = decrypt(&encrypted1, password).unwrap();
        let decrypted2 = decrypt(&encrypted2, password).unwrap();

        assert_eq!(decrypted1, plaintext);
        assert_eq!(decrypted2, plaintext);
    }

    #[test]
    fn test_empty_plaintext() {
        let plaintext = b"";
        let password = "password";

        let encrypted = encrypt(plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_large_data() {
        // Test with 1MB of data
        let plaintext = vec![0x42u8; 1024 * 1024];
        let password = "large_data_password";

        let encrypted = encrypt(&plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_corrupted_ciphertext() {
        let plaintext = b"Original message";
        let password = "password123";

        let mut encrypted = encrypt(plaintext, password).unwrap();

        // Corrupt the ciphertext
        if let Some(byte) = encrypted.ciphertext.get_mut(0) {
            *byte ^= 0xFF;
        }

        // Decryption should fail due to authentication tag mismatch
        let result = decrypt(&encrypted, password);
        assert!(result.is_err(), "Decryption of corrupted data should fail");
    }

    #[test]
    fn test_corrupted_nonce() {
        let plaintext = b"Message";
        let password = "pass";

        let mut encrypted = encrypt(plaintext, password).unwrap();

        // Corrupt the nonce
        if let Some(byte) = encrypted.nonce.get_mut(0) {
            *byte ^= 0xFF;
        }

        // Decryption should fail
        let result = decrypt(&encrypted, password);
        assert!(result.is_err(), "Decryption with corrupted nonce should fail");
    }

    #[test]
    fn test_special_characters_in_password() {
        let plaintext = b"Secret data";
        let password = "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?";

        let encrypted = encrypt(plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_unicode_password() {
        let plaintext = b"Data";
        let password = "пароль密码🔐";

        let encrypted = encrypt(plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }
}
