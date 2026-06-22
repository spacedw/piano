import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { hmac } from "https://esm.sh/@noble/hashes@1.3.1/hmac";
import { sha256 } from "https://esm.sh/@noble/hashes@1.3.1/sha256";

// Verify LemonSqueezy webhook signature
function verifySignature(payload, signature, secret) {
    const encoder = new TextEncoder();
    const h = hmac(sha256, encoder.encode(secret), encoder.encode(payload));
    const digest = Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('');
    return digest === signature;
}

serve(async (req) => {
    try {
        const signature = req.headers.get("x-signature") || "";
        const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
        const payload = await req.text();

        if (!verifySignature(payload, signature, secret)) {
            return new Response("Invalid signature", { status: 401 });
        }

        const data = JSON.parse(payload);
        const eventName = data.meta.event_name;
        
        // Custom data usually holds the user's Supabase UUID passed during checkout
        const supabaseUserId = data.meta.custom_data?.user_id;

        if (!supabaseUserId) {
            return new Response("Missing user_id in custom_data", { status: 400 });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        if (eventName === "subscription_created" || eventName === "subscription_updated") {
            const status = data.data.attributes.status;
            if (status === "active" || status === "past_due") {
                await supabase.from("profiles").update({ tier: "supporter" }).eq("user_id", supabaseUserId);
            } else if (status === "expired" || status === "cancelled" || status === "unpaid") {
                await supabase.from("profiles").update({ tier: "free" }).eq("user_id", supabaseUserId);
            }
        } else if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
            await supabase.from("profiles").update({ tier: "free" }).eq("user_id", supabaseUserId);
        }

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
        return new Response(`Webhook Error: ${err.message}`, { status: 500 });
    }
});
