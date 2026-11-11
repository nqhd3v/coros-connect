import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getSecretKey(key: string): Buffer {
  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes encoded as base64. Generate one with: openssl rand -base64 32",
    );
  }
  return decoded;
}

export function encrypt(plaintext: string, secret: string): string {
  const secretKey = getSecretKey(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, secretKey, iv);
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, body, tag].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(payload: string, secret: string): string {
  const secretKey = getSecretKey(secret);
  const [iv, body, tag] = payload
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (!iv || !body || !tag) throw new Error("Stored ciphertext is malformed");

  const decipher = createDecipheriv(ALGORITHM, secretKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time compare, so a shared secret cannot be guessed byte by byte. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
