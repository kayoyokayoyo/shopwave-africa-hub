import type { CloudinaryUploadKind, CloudinaryUploadSignature } from "@/lib/cloudinary.functions";

type SignUpload = (input: { data: { kind: CloudinaryUploadKind } }) => Promise<CloudinaryUploadSignature>;

/** Resize + compress in the browser, then upload directly to a server-signed Cloudinary tenant folder. */
export async function compressAndUpload(
  file: File,
  kind: CloudinaryUploadKind,
  signUpload: SignUpload,
  maxSize = 1200,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Fichier non supporté");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image trop lourde (15 Mo max)");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Compression impossible"))), "image/webp", 0.8),
  );
  const signed = await signUpload({ data: { kind } });
  const form = new FormData();
  form.set("file", blob, `${signed.public_id}.webp`);
  form.set("api_key", signed.apiKey);
  form.set("timestamp", String(signed.timestamp));
  form.set("asset_folder", signed.asset_folder);
  form.set("public_id", signed.public_id);
  form.set("signature", signed.signature);

  const response = await fetch(signed.uploadUrl, { method: "POST", body: form });
  const result = await response.json().catch(() => ({})) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.secure_url?.startsWith("https://")) {
    throw new Error(result.error?.message ?? "Échec de l’envoi de l’image vers Cloudinary");
  }
  return result.secure_url;
}
