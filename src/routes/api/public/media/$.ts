import { createFileRoute } from "@tanstack/react-router";

// Serves shop images from private storage. Only uploaded webp images under {uuid}/{uuid}.webp.
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;

export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!PATH_RE.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("shop-media").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": "image/webp",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
