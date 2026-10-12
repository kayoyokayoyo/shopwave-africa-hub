import crypto from "node:crypto";

function getEncryptionKey(): Buffer {
  const secret = process.env.META_ENCRYPTION_KEY || process.env.META_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Clé de chiffrement serveur non configurée");
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Chiffre une chaîne sensible (ex: access_token) avec AES-256-GCM.
 * Format de sortie : "enc:v1:<iv_hex>:<tag_hex>:<data_hex>"
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return plainText;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `enc:v1:${iv.toString("hex")}:${tag}:${encrypted}`;
}

/**
 * Déchiffre une chaîne chiffrée avec AES-256-GCM.
 * Si la chaîne n'est pas chiffrée (ancien format clair), la retourne telle quelle pour compatibilité.
 */
export function decryptSecret(cipherText: string | null | undefined): string | null {
  if (!cipherText) return null;
  if (!cipherText.startsWith("enc:v1:")) {
    // Ancien token non chiffré stocké en base
    return cipherText;
  }
  try {
    const [, , ivHex, tagHex, dataHex] = cipherText.split(":");
    if (!ivHex || !tagHex || !dataHex) return null;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Échec du déchiffrement du token");
    return null;
  }
}
