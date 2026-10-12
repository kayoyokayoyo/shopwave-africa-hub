import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { getDeletionEmailHtml } from "./template.ts";

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
    if (!email) {
      return new Response(JSON.stringify({ success: true, note: "No email address found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName = user_metadata?.full_name || "Cher commerçant";
    const deletedAt = new Date().toLocaleString("fr-FR", {
      timeZone: "Africa/Kinshasa",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASSWORD") || Deno.env.get("SMTP_PASS");
    const senderName = Deno.env.get("SMTP_FROM_NAME") || "MarketNet Africa";

    if (!smtpUser || !smtpPass) {
      console.warn("[send-deletion-email] Missing SMTP credentials (SMTP_USER / SMTP_PASSWORD). Email skipped.");
      return new Response(JSON.stringify({ success: true, note: "Email skipped (SMTP not configured)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = Deno.env.get("MARKETNET_SITE_URL") || "";
    const supportEmail = Deno.env.get("MARKETNET_ADMIN_EMAIL") || smtpUser;

    const emailHtml = getDeletionEmailHtml({
      fullName,
      email,
      deletedAt,
      supportEmail,
      siteUrl,
    });

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    await client.send({
      from: `"${senderName}" <${smtpUser}>`,
      to: email,
      subject: "Confirmation de suppression de votre compte MarketNet",
      html: emailHtml,
    });

    await client.close();

    console.log(`[send-deletion-email] Email successfully sent to ${email} via Gmail SMTP.`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-deletion-email] Error:", error);
    // On ne bloque jamais le flux de suppression même en cas d'erreur de mail
    return new Response(JSON.stringify({ success: true, note: "Error while sending email, but account deletion proceeds" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
