// Shopify "Order payment" webhook -> stores the access code(s) for each online planner bought.
//
// The customer gets ONE email: Shopify's own order confirmation. Its template works out the same codes
// with Liquid's hmac_sha256, so the code is in that email straight away and this function only has to
// save it so the planner accepts it.
//   code n of an order = "LLP27-" + first 12 hex chars of HMAC_SHA256(key = order confirmation number, "<order id>-<n>"),
//   upper case, in groups of 4. The confirmation number is only known to the buyer and the store.
//   n counts 1, 2, 3... across every planner line item and its quantity, in line item order.
//
// Secrets: SHOPIFY_WEBHOOK_SECRET (Supabase Edge Function secret).
// Optional: SEND_CODE_EMAIL=1 also sends a separate code email through Resend (RESEND_API_KEY). Off by default.
import { createClient } from "jsr:@supabase/supabase-js@2";

const YEAR = 2027;
const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function validShopify(raw: Uint8Array, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, raw))));
  if (b64.length !== header.length) return false;
  let diff = 0; for (let i = 0; i < b64.length; i++) diff |= b64.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export async function orderCode(key: string, orderId: string, n: number) {
  const h = (await hmacHex(key, `${orderId}-${n}`)).toUpperCase();
  return `LLP27-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = new Uint8Array(await req.arrayBuffer());
  if (!(await validShopify(raw, req.headers.get("X-Shopify-Hmac-Sha256"), Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? ""))) {
    return new Response("bad signature", { status: 401 });
  }
  let order: any; try { order = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response("bad body", { status: 400 }); }

  const isPlanner = (li: any) => String(li.title ?? "").toLowerCase().includes("online planner");
  const qty = (order.line_items ?? []).filter(isPlanner).reduce((a: number, li: any) => a + (Number(li.quantity) || 1), 0);
  if (!qty) return new Response("no planner in order");

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const conf = String(order.confirmation_number ?? "");
  if (!conf) return new Response("no confirmation number", { status: 500 });

  const to = order.email || order.contact_email || order.customer?.email || null;
  const orderId = String(order.id);
  const codes: string[] = [];
  for (let n = 1; n <= qty; n++) codes.push(await orderCode(conf, orderId, n));
  // upsert by code: Shopify retries webhooks, so this must be safe to run twice
  const { error } = await sb.from("access_codes").upsert(
    codes.map((code) => ({ code, year: YEAR, shopify_order_id: orderId, email: to })),
    { onConflict: "code", ignoreDuplicates: true },
  );
  if (error) return new Response("db error: " + error.message, { status: 500 });

  const key = Deno.env.get("RESEND_API_KEY");
  if (Deno.env.get("SEND_CODE_EMAIL") === "1" && key && to) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Christina at Live Love Planners <hello@updates.liveloveplanners.com>",
        to: [to], reply_to: "liveloveplanners21@gmail.com",
        subject: "Your 2027 planner is ready",
        text: `Your access code${codes.length > 1 ? "s" : ""}:\n${codes.join("\n")}\n\nOpen https://llp-planner-app.vercel.app and sign in with this email address.\n\nChristina x`,
      }),
    });
  }
  return new Response("ok " + codes.length);
});
