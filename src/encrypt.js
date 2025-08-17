export function encrypt(message, sessionStorage, localStorage) {}

export async function setEncryptionPassword(
  password,
  localStorage,
  sessionStorage,
) {
  const tempPassword = generateSafeRandomString(64);

  const persist = password === '';

  let encryptionKey = await encryptText(tempPassword, password);
  localStorage.setItem("tempPasswordEncrypted", JSON.stringify(encryptionKey));

  sessionStorage.setItem("tempPassword", tempPassword);
  if (persist) {
    localStorage.setItem("tempPassword", tempPassword);
  } else {
    localStorage.removeItem("tempPassword");
  }
}

export async function encryptLocalStorageItem(
  itemKey,
  data,
  localStorage,
  sessionStorage,
) {
  let tempPassword =
    sessionStorage.getItem("tempPassword") ||
    localStorage.getItem("tempPassword");
  if (!tempPassword) {
    throw new Error("tempPassword is missing, set with setEncryptionPassword");
  }
  // todo: check tempPasswordEncrypted
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
  let tempPassword =
    sessionStorage.getItem("tempPassword") ||
    localStorage.getItem("tempPassword");
  if (!tempPassword) {
    tempPassword = '';
  }

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
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues); // Populate the array with random values

  for (let i = 0; i < length; i++) {
    // Map the random byte to an index within the characters string
    result += characters.charAt(randomValues[i] % charactersLength);
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

async function deriveKey(password, salt) {
  const keyMaterial = await getCryptoKey(password);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function validateTempPassword(password, localStorage) {
  let data = localStorage.getItem("tempPasswordEncrypted");
  if (!data) {
    return null;
  }
  try {
    data = JSON.parse(data);
  } catch (e) {
    return null;
  }
  return !!(await decryptText(data, password));
}

export async function encryptText(text, password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(text),
  );

  return {
    cipherText: arrayBufferToHex(encrypted),
    iv: arrayBufferToHex(iv),
    salt: arrayBufferToHex(salt),
  };
}

export async function decryptText(encryptedData, password) {
  if (!password) {
    return null;
  }
  const { cipherText, iv, salt } = encryptedData;

  try {
    const key = await deriveKey(password, hexToArrayBuffer(salt));
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
