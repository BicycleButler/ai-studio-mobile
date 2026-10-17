// Device-scoped salt for local credential encryption
const DEVICE_VAULT_SALT = "ais_mobile_vault_v2_77391";

/**
 * Encrypts a sensitive string into an encoded vault envelope
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  try {
    let encrypted = "";
    for (let i = 0; i < plainText.length; i++) {
      const charCode = plainText.charCodeAt(i) ^ DEVICE_VAULT_SALT.charCodeAt(i % DEVICE_VAULT_SALT.length);
      encrypted += String.fromCharCode(charCode);
    }
    return `enc:${btoa(encrypted)}`;
  } catch {
    return plainText;
  }
}

/**
 * Decrypts an encoded vault envelope back to plain string
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc:")) return cipherText;
  try {
    const raw = atob(cipherText.slice(4));
    let decrypted = "";
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ DEVICE_VAULT_SALT.charCodeAt(i % DEVICE_VAULT_SALT.length);
      decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
  } catch {
    return cipherText;
  }
}
