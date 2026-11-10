/*
 * Unlock remembered S3 credentials with a passkey.
 *
 * Uses the WebAuthn PRF extension: the authenticator derives a secret from
 * the passkey and a random salt, which is only released after user
 * verification (biometrics / device PIN). That secret is run through HKDF to
 * get an AES-GCM key, which wraps the random master key that encrypts the
 * credentials in localStorage (see encrypt.js). There is no server involved,
 * so the challenge is not verified; security relies solely on the PRF output
 * staying inside the authenticator until the user unlocks it.
 */

const STORAGE_KEY = "passkeyEncrypted";
const HKDF_INFO = "bucketnotes passkey key wrap v1";

export async function isPasskeySupported() {
  if (
    !window.isSecureContext ||
    !window.PublicKeyCredential ||
    !navigator.credentials?.create
  ) {
    return false;
  }
  if (typeof PublicKeyCredential.getClientCapabilities === "function") {
    try {
      const capabilities = await PublicKeyCredential.getClientCapabilities();
      if ("extension:prf" in capabilities) {
        return !!capabilities["extension:prf"];
      }
    } catch (e) {
      // fall through
    }
  }
  // Capabilities can't be queried: assume support, registerPasskey() reports
  // a clear error if the authenticator doesn't support PRF.
  return true;
}

export function hasPasskey(localStorage) {
  return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * Creates a new passkey and stores `masterKey` wrapped with a key derived
 * from it.
 */
export async function registerPasskey(masterKey, localStorage, label = "") {
  const prfSalt = randomBytes(32);
  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: "Bucketnotes" },
      user: {
        id: randomBytes(16),
        name: label ? `bucketnotes (${label})` : "bucketnotes",
        displayName: label ? `Bucketnotes (${label})` : "Bucketnotes",
      },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -8 }, // Ed25519
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  if (!credential) {
    throw new Error("Passkey creation was cancelled");
  }

  const credentialId = new Uint8Array(credential.rawId);
  const prf = credential.getClientExtensionResults()?.prf;
  if (prf?.enabled === false) {
    throw new PasskeyNotSupportedError();
  }
  // Some authenticators only evaluate the PRF on assertion, not on creation
  let prfOutput = prf?.results?.first;
  if (!prfOutput) {
    prfOutput = await evaluatePrf(credentialId, prfSalt);
  }

  const iv = randomBytes(12);
  const key = await deriveWrappingKey(prfOutput);
  const cipherText = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: credentialId },
    key,
    new TextEncoder().encode(masterKey),
  );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      v: 1,
      credentialId: toHex(credentialId),
      prfSalt: toHex(prfSalt),
      iv: toHex(iv),
      cipherText: toHex(cipherText),
    }),
  );
}

/**
 * Asks the user for the passkey and returns the unwrapped master key.
 */
export async function unlockWithPasskey(localStorage) {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (!data) {
    throw new Error("No passkey is set up");
  }
  const credentialId = fromHex(data.credentialId);
  const prfOutput = await evaluatePrf(credentialId, fromHex(data.prfSalt));
  const key = await deriveWrappingKey(prfOutput);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromHex(data.iv), additionalData: credentialId },
    key,
    fromHex(data.cipherText),
  );
  return new TextDecoder().decode(decrypted);
}

export function removePasskey(localStorage) {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  localStorage.removeItem(STORAGE_KEY);
  if (
    data &&
    typeof PublicKeyCredential?.signalUnknownCredential === "function"
  ) {
    // Hint the password manager that the passkey is useless now (best effort)
    PublicKeyCredential.signalUnknownCredential({
      rpId: window.location.hostname,
      credentialId: toBase64Url(fromHex(data.credentialId)),
    }).catch(() => {});
  }
}

export class PasskeyNotSupportedError extends Error {
  constructor() {
    super(
      "This passkey / browser does not support the PRF extension, which is needed to encrypt the credentials",
    );
    this.name = "PasskeyNotSupportedError";
  }
}

export function passkeyErrorMessage(err, fallback) {
  if (err?.name === "NotAllowedError") {
    return `${fallback}: cancelled or timed out`;
  }
  if (err?.name === "PasskeyNotSupportedError") {
    return err.message;
  }
  return `${fallback} (${err?.name || err})`;
}

async function evaluatePrf(credentialId, prfSalt) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: "public-key", id: credentialId }],
      userVerification: "required",
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  const prfOutput = assertion?.getClientExtensionResults()?.prf?.results?.first;
  if (!prfOutput) {
    throw new PasskeyNotSupportedError();
  }
  return prfOutput;
}

async function deriveWrappingKey(prfOutput) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: new TextEncoder().encode(HKDF_INFO),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
