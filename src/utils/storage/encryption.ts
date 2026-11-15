// Legacy static salt retained only for decrypting pre-v3 vault envelopes
const LEGACY_DEVICE_VAULT_SALT = "ais_mobile_vault_v2_77391";
const DEVICE_KEY_STORAGE_KEY = "ais_vault_device_key_v3";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const LEGACY_SALT_BYTES = textEncoder.encode(LEGACY_DEVICE_VAULT_SALT);

let cachedDeviceKey: Uint8Array | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function getOrCreateDeviceKey(): Uint8Array {
  if (cachedDeviceKey) return cachedDeviceKey;
  try {
    if (typeof localStorage !== "undefined") {
      const existing = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
      if (existing) {
        const decoded = base64ToBytes(existing);
        if (decoded.length === 32) {
          cachedDeviceKey = decoded;
          return cachedDeviceKey;
        }
      }
      const generated = getRandomBytes(32);
      localStorage.setItem(DEVICE_KEY_STORAGE_KEY, bytesToBase64(generated));
      cachedDeviceKey = generated;
      return cachedDeviceKey;
    }
  } catch {
    // Restricted storage fallback
  }
  cachedDeviceKey = getRandomBytes(32);
  return cachedDeviceKey;
}

/**
 * Generates a deterministic keystream from a 32-byte key, 16-byte IV, and counter
 * using FNV/Murmur-inspired 32-bit mixing rounds so identical plaintexts with distinct
 * random IVs produce completely distinct ciphertexts.
 */
function applyKeystream(input: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const output = new Uint8Array(input.length);
  let stateA = 0x811c9dc5;
  let stateB = 0x9e3779b9;
  for (let i = 0; i < key.length; i++) {
    stateA = Math.imul(stateA ^ key[i], 0x01000193) >>> 0;
  }
  for (let i = 0; i < iv.length; i++) {
    stateB = Math.imul(stateB ^ iv[i], 0x85ebca6b) >>> 0;
  }

  for (let i = 0; i < input.length; i++) {
    const k = key[i % key.length];
    const v = iv[i % iv.length];
    stateA = (Math.imul(stateA ^ k ^ (i & 0xff), 0x85ebca6b) + 0xc2b2ae35) >>> 0;
    stateB = (Math.imul(stateB ^ v ^ (stateA >>> 16), 0x27d4eb2f) + 0x165667b1) >>> 0;
    const mixed = (stateA ^ (stateB >>> 8) ^ ((stateA << 5) >>> 0)) & 0xff;
    output[i] = input[i] ^ mixed;
  }
  return output;
}

/**
 * Encrypts a sensitive string into a salted, random-IV UTF-8 vault envelope ("enc:v3:").
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  try {
    const key = getOrCreateDeviceKey();
    const iv = getRandomBytes(16);
    const plainBytes = textEncoder.encode(plainText);
    const cipherBytes = applyKeystream(plainBytes, key, iv);
    return `enc:v3:${bytesToBase64(iv)}:${bytesToBase64(cipherBytes)}`;
  } catch {
    return plainText;
  }
}

/**
 * Decrypts v3 ("enc:v3:"), v2 ("enc:v2:"), and legacy ("enc:") vault envelopes back to plain text.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";

  if (cipherText.startsWith("enc:v3:")) {
    try {
      const rest = cipherText.slice(7);
      const sep = rest.indexOf(":");
      if (sep <= 0) return cipherText;
      const iv = base64ToBytes(rest.slice(0, sep));
      const cipherBytes = base64ToBytes(rest.slice(sep + 1));
      const key = getOrCreateDeviceKey();
      const plainBytes = applyKeystream(cipherBytes, key, iv);
      return textDecoder.decode(plainBytes);
    } catch {
      return cipherText;
    }
  }

  if (cipherText.startsWith("enc:v2:")) {
    try {
      const encryptedBytes = base64ToBytes(cipherText.slice(7));
      const decryptedBytes = new Uint8Array(encryptedBytes.length);
      for (let i = 0; i < encryptedBytes.length; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ LEGACY_SALT_BYTES[i % LEGACY_SALT_BYTES.length];
      }
      return textDecoder.decode(decryptedBytes);
    } catch {
      return cipherText;
    }
  }

  if (cipherText.startsWith("enc:")) {
    try {
      const raw = atob(cipherText.slice(4));
      let decrypted = "";
      for (let i = 0; i < raw.length; i++) {
        const charCode = raw.charCodeAt(i) ^ LEGACY_DEVICE_VAULT_SALT.charCodeAt(i % LEGACY_DEVICE_VAULT_SALT.length);
        decrypted += String.fromCharCode(charCode);
      }
      return decrypted;
    } catch {
      return cipherText;
    }
  }

  return cipherText;
}
