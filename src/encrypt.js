// PBKDF2 iterations for wrapping the master key with the user's password
// (OWASP recommendation for PBKDF2-HMAC-SHA256). Data encrypted before this
// was introduced carries no `iterations` field and used LEGACY_ITERATIONS.
const PASSWORD_ITERATIONS = 600000;
// The credential items are encrypted with the random 64 char master key, so
// key stretching adds nothing there; kept at the legacy value for
// compatibility.
const LEGACY_ITERATIONS = 100000;

export function generateMasterKey() {
  return generateSafeRandomString(64);
}

/**
 * Stores a new master key ("tempPassword") which is used to encrypt the
 * credentials in localStorage.
 *
 * - With a password, the master key is stored wrapped with the password.
 * - With `persist`, the master key is stored in plain text in localStorage
 *   (no real protection, just convenience).
 * - Otherwise (e.g. passkey only), the caller is responsible for storing the
 *   master key somewhere (see passkey.js).
 */
export async function setEncryptionPassword(
  password,
  localStorage,
  sessionStorage,
  { masterKey = generateMasterKey(), persist = password === "" } = {},
) {
  if (password) {
    const encryptionKey = await encryptText(
      masterKey,
      password,
      PASSWORD_ITERATIONS,
    );
    localStorage.setItem("tempPasswordEncrypted", JSON.stringify(encryptionKey));
  } else {
    localStorage.removeItem("tempPasswordEncrypted");
  }

  sessionStorage.setItem("tempPassword", masterKey);
  if (persist) {
    localStorage.setItem("tempPassword", masterKey);
  } else {
    localStorage.removeItem("tempPassword");
  }
  return masterKey;
}

export function getMasterKey(localStorage, sessionStorage) {
  return (
    sessionStorage.getItem("tempPassword") ||
    localStorage.getItem("tempPassword") ||
    null
  );
}

export function hasPasswordProtection(localStorage) {
  return !!localStorage.getItem("tempPasswordEncrypted");
}

/**
 * Unwraps the master key with the password and stores it in the session.
 * Returns false if the password is wrong.
 */
export async function unlockWithPassword(
  password,
  localStorage,
  sessionStorage,
) {
  let data;
  try {
    data = JSON.parse(localStorage.getItem("tempPasswordEncrypted"));
  } catch (e) {
    return false;
  }
  if (!data) {
    return false;
  }
  const masterKey = await decryptText(data, password);
  if (!masterKey) {
    return false;
  }
  if ((data.iterations || LEGACY_ITERATIONS) < PASSWORD_ITERATIONS) {
    // upgrade data wrapped with the legacy iteration count
    localStorage.setItem(
      "tempPasswordEncrypted",
      JSON.stringify(
        await encryptText(masterKey, password, PASSWORD_ITERATIONS),
      ),
    );
  }
  sessionStorage.setItem("tempPassword", masterKey);
  return true;
}

export async function encryptLocalStorageItem(
  itemKey,
  data,
  localStorage,
  sessionStorage,
) {
  const tempPassword = getMasterKey(localStorage, sessionStorage);
  if (!tempPassword) {
    throw new Error("tempPassword is missing, set with setEncryptionPassword");
  }
  if (typeof data === "object" && data !== null) {
    data = JSON.stringify(data);
  } else {
    data = String(data);
  }
  localStorage.setItem(
    itemKey,
    JSON.stringify(await encryptText(data, tempPassword)),
  );
}

export async function decryptLocalStorageItem(
  itemKey,
  localStorage,
  sessionStorage,
) {
  const tempPassword = getMasterKey(localStorage, sessionStorage) || "";

  let data = localStorage.getItem(itemKey);
  if (!data) {
    return null;
  }

  if (typeof data === "object" && data !== null) {
    data = JSON.stringify(data);
  } else {
    data = String(data);
  }

  data = JSON.parse(data);
  return await decryptText(data, tempPassword);
}

function generateSafeRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let result = "";
  // Rejection sampling: only accept bytes below the largest multiple of the
  // alphabet size, otherwise `byte % charactersLength` is biased
  const limit = 256 - (256 % charactersLength);
  const randomValues = new Uint8Array(length * 2);
  while (result.length < length) {
    crypto.getRandomValues(randomValues);
    for (const byte of randomValues) {
      if (byte < limit && result.length < length) {
        result += characters.charAt(byte % charactersLength);
      }
    }
  }
  return result;
}

// source: https://dev.to/eddiegulay/secure-text-encryption-and-decryption-with-vanilla-javascript-1c23
async function getCryptoKey(password) {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(password);
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
}

async function deriveKey(password, salt, iterations) {
  const keyMaterial = await getCryptoKey(password);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(
  text,
  password,
  iterations = LEGACY_ITERATIONS,
) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(text),
  );

  return {
    cipherText: arrayBufferToHex(encrypted),
    iv: arrayBufferToHex(iv),
    salt: arrayBufferToHex(salt),
    iterations,
  };
}

export async function decryptText(encryptedData, password) {
  if (!password) {
    return null;
  }
  const { cipherText, iv, salt } = encryptedData;
  const iterations = encryptedData.iterations || LEGACY_ITERATIONS;

  try {
    const key = await deriveKey(password, hexToArrayBuffer(salt), iterations);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToArrayBuffer(iv) },
      key,
      hexToArrayBuffer(cipherText),
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    return null;
  }
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}
