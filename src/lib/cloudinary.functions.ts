import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uploadSchema = z.object({ kind: z.enum(["product", "storefront"]) });

export type CloudinaryUploadKind = z.infer<typeof uploadSchema>["kind"];
export type CloudinaryUploadSignature = {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  asset_folder: string;
  public_id: string;
  timestamp: number;
  signature: string;
};

/**
 * Signs one direct-to-Cloudinary upload. The tenant folder is derived exclusively
 * from the authenticated owner ID; the client cannot choose another shop/folder.
 * shops.owner_id is unique, so this stable ID maps one-to-one to a boutique,
 * including while the initial onboarding form is still a draft.
 */
export const cloudinaryUploadSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: shop, error } = await context.supabase
      .from("shops")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data.kind === "product" && !shop) throw new Error("Créez d’abord votre boutique");

    const { getCloudinary, getCloudinaryConfig } = await import("@/lib/cloudinary.server");
    const cloud = getCloudinary();
    const config = getCloudinaryConfig();
    const folder = `marketnet/shops/${context.userId}/${data.kind === "product" ? "products" : "storefront"}`;
    const publicId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParams = { asset_folder: folder, public_id: publicId, timestamp };
    const signature = cloud.utils.api_sign_request(signedParams, config.api_secret);

    return {
      cloudName: config.cloud_name,
      apiKey: config.api_key,
      uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloud_name}/image/upload`,
      ...signedParams,
      signature,
    };
  });
