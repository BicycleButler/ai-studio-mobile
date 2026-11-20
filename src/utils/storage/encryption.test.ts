import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from './encryption';

describe('storage encryption', () => {
  it('round-trips ASCII secrets with enc:v3 random-IV envelope', () => {
    const secret = 'AIzaSyDummyTestKey1234567890';
    const encryptedA = encryptSecret(secret);
    const encryptedB = encryptSecret(secret);
    expect(encryptedA.startsWith('enc:v3:')).toBe(true);
    expect(encryptedA).not.toBe(encryptedB);
    expect(decryptSecret(encryptedA)).toBe(secret);
    expect(decryptSecret(encryptedB)).toBe(secret);
  });

  it('round-trips UTF-8 Unicode and emoji secrets safely', () => {
    const secret = 'key-\u{1F510}-日本語-café-Δ';
    const encrypted = encryptSecret(secret);
    expect(encrypted.startsWith('enc:v3:')).toBe(true);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it('decrypts legacy enc:v2: envelopes for backward compatibility', () => {
    const plain = 'v2_key_\u{1F512}';
    const saltBytes = new TextEncoder().encode('ais_mobile_vault_v2_77391');
    const plainBytes = new TextEncoder().encode(plain);
    const out = new Uint8Array(plainBytes.length);
    for (let i = 0; i < plainBytes.length; i++) {
      out[i] = plainBytes[i] ^ saltBytes[i % saltBytes.length];
    }
    let bin = '';
    out.forEach((b) => (bin += String.fromCharCode(b)));
    expect(decryptSecret(`enc:v2:${btoa(bin)}`)).toBe(plain);
  });

  it('decrypts legacy enc: envelopes for backward compatibility', () => {
    const plain = 'legacy_key_123';
    const salt = 'ais_mobile_vault_v2_77391';
    let legacyRaw = '';
    for (let i = 0; i < plain.length; i++) {
      legacyRaw += String.fromCharCode(plain.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    const legacyCipher = `enc:${btoa(legacyRaw)}`;
    expect(decryptSecret(legacyCipher)).toBe(plain);
  });

  it('returns empty string for empty input and passes through unprefixed text', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
    expect(decryptSecret('plain-text')).toBe('plain-text');
  });
});
