import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Utilisateur non trouve" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, user_metadata } = user;
    const fullName = user_metadata?.full_name || "Cher utilisateur";
    const deletedAt = new Date().toLocaleString("fr-FR", {
      timeZone: "Africa/Abidjan",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.log(`[send-deletion-email] Would send email to ${email}`);
      return new Response(JSON.stringify({ success: true, note: "Email skipped (no RESEND_API_KEY)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Suppression compte MarketNet</title></head><body style="margin:0;padding:0;background:#f6f6f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:40px 16px;"><tr><td align="center"><table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><tr><td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 32px 28px;text-align:center;"><h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Compte supprime</h1><p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">MarketNet Africa</p></td></tr><tr><td style="padding:32px;"><p style="font-size:16px;color:#1a1a2e;font-weight:600;margin:0 0 8px;">Bonjour ${fullName},</p><p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px;">Nous vous confirmons que votre compte <strong>MarketNet</strong> ainsi que toutes vos donnees ont ete <strong>definitivement supprimes</strong> le :</p><div style="background:#fff5f5;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin:0 0 20px;text-align:center;"><span style="font-size:15px;font-weight:700;color:#dc2626;">${deletedAt}</span></div><p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">Les donnees suivantes ont ete supprimees :</p><ul style="font-size:14px;color:#555;line-height:2;margin:0 0 24px;padding-left:20px;"><li>Votre profil et informations personnelles</li><li>Votre boutique et tous vos produits</li><li>Vos commandes et historiques</li><li>Vos connexions et jetons Meta (Facebook/Instagram)</li><li>Vos promotions et rapports</li></ul><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:0 0 24px;"><p style="font-size:13px;color:#166534;margin:0;line-height:1.6;">Si vous souhaitez revenir, vous pouvez creer un nouveau compte gratuitement.</p></div><p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Si vous n'avez pas demande cette suppression, contactez-nous a <a href="mailto:support@marketnet.africa" style="color:#dc2626;text-decoration:none;">support@marketnet.africa</a>.</p></td></tr><tr><td style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} MarketNet Africa</p></td></tr></table></td></tr></table></body></html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MarketNet Africa <noreply@marketnet.africa>",
        to: [email],
        subject: "Votre compte MarketNet a ete supprime",
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.text();
      console.error("[send-deletion-email] Resend error:", err);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-deletion-email] Error:", error);
    return new Response(JSON.stringify({ success: true, note: "Error but deletion proceeds" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
