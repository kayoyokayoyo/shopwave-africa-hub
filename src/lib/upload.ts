import { supabase } from "@/integrations/supabase/client";

/** Resize + compress an image in the browser, then upload it. Returns storage path. */
export async function compressAndUpload(file: File, userId: string, maxSize = 1200): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Fichier non supporté");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image trop lourde (15 Mo max)");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Compression impossible"))), "image/webp", 0.8),
  );
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("shop-media").upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}
