
/**
 * End-to-End Encryption Utilities using Web Crypto API (AES-GCM)
 */

const ALGORITHM = "AES-GCM";

async function getKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password.padEnd(32, "0").substring(0, 32)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("go-meet-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(text: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(secret);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(text)
  );

  const buffer = new Uint8Array(iv.length + encrypted.byteLength);
  buffer.set(iv);
  buffer.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...buffer));
}

export async function decryptData(cipherText: string, secret: string): Promise<string> {
  const dec = new TextDecoder();
  const buffer = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
  const iv = buffer.slice(0, 12);
  const data = buffer.slice(12);
  const key = await getKey(secret);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
    return dec.decode(decrypted);
  } catch (e) {
    return "[Decryption Error: Key Mismatch]";
  }
}

export function generateSafetyNumber(secret: string): string {
  // Generate a reproducible 12-digit safety number for verification
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    hash = ((hash << 5) - hash) + secret.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash).toString().padEnd(12, '7');
  return absHash.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
}
