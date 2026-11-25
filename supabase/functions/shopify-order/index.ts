// Shopify "Order payment" webhook -> one access code per online planner bought -> emailed to the buyer.
// Secrets (Supabase > Edge Functions > Secrets):
//   SHOPIFY_WEBHOOK_SECRET  the signing key shown under Shopify Settings > Notifications > Webhooks
//   RESEND_API_KEY          from resend.com (sending domain liveloveplanners.com verified)
//   MAIL_FROM               optional, default "Christina at Live Love Planners <hello@liveloveplanners.com>"
//   PLANNER_PRODUCT_IDS     optional, comma separated Shopify product ids; if empty, any item with "online planner" in its title counts
//   APP_URL                 optional, default https://llp-planner-app.vercel.app
import { createClient } from "jsr:@supabase/supabase-js@2";

const YEAR = 2027;
const enc = new TextEncoder();

async function validHmac(raw: Uint8Array, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, raw));
  const b64 = btoa(String.fromCharCode(...sig));
  if (b64.length !== header.length) return false;
  let diff = 0; for (let i = 0; i < b64.length; i++) diff |= b64.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
  const r = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(r, (b) => A[b % A.length]).join("");
  return `LLP27-${s.slice(0, 4)}-${s.slice(4)}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function email(name: string, codes: string[], app: string) {
  const hi = name ? `${esc(name)}, your` : "Your";
  const codeLines = codes.map((c) => `<p style="font-size:22px;letter-spacing:2px;margin:6px 0"><b>${c}</b></p>`).join("");
  const html = `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#26302a;max-width:560px;text-align:left">
<p><b>${hi} 2027 planner is ready!</b></p>
<p>Here's your access code${codes.length > 1 ? "s (one for each planner you bought)" : ""}:</p>
${codeLines}
<p>To get in:</p>
<p>1. Open <a href="${app}" target="_blank">${app.replace(/^https?:\/\//, "")}</a><br>
2. Type this email address and tap <b>Email me a sign-in link</b><br>
3. Click the link we send you, pop in your code, and you're in.</p>
<p>It'll ask you a few quick questions (your colour, your week, your daily page) and then it's all yours. Pick a password when it asks, so next time you can just sign in.</p>
<p>Little tip: add the planner to your home screen or bookmarks so it's always one tap away.</p>
<p>If anything doesn't work, just reply to this email and I'll sort it.</p>
<p>Christina x<br><span style="color:#6f7772">Live Love Planners</span></p>
</div>`;
  const text = `${name ? name + ", your" : "Your"} 2027 planner is ready!\n\nYour access code${codes.length > 1 ? "s" : ""}:\n${codes.join("\n")}\n\n1. Open ${app}\n2. Type this email address and tap "Email me a sign-in link"\n3. Click the link we send you, pop in your code, and you're in.\n\nIf anything doesn't work, just reply to this email.\n\nChristina x\nLive Love Planners`;
  return { html, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = new Uint8Array(await req.arrayBuffer());
  if (!(await validHmac(raw, req.headers.get("X-Shopify-Hmac-Sha256"), Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? ""))) {
    return new Response("bad signature", { status: 401 });
  }
  let order: any; try { order = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response("bad body", { status: 400 }); }

  const ids = (Deno.env.get("PLANNER_PRODUCT_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const isPlanner = (li: any) => ids.length ? ids.includes(String(li.product_id)) : /online planner/i.test(`${li.title} ${li.name ?? ""}`);
  const qty = (order.line_items ?? []).filter(isPlanner).reduce((a: number, li: any) => a + (Number(li.quantity) || 1), 0);
  if (!qty) return new Response("no planner in order");

  const to = order.email || order.contact_email || order.customer?.email;
  const name = order.customer?.first_name || order.billing_address?.first_name || "";
  const orderId = String(order.id);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Shopify retries webhooks: never make a second set of codes for the same order
  const { data: have } = await sb.from("access_codes").select("code").eq("shopify_order_id", orderId);
  const codes: string[] = (have ?? []).map((r: any) => r.code);
  const fresh = codes.length === 0;
  while (codes.length < qty) {
    const code = newCode();
    const { error } = await sb.from("access_codes").insert({ code, year: YEAR, shopify_order_id: orderId, email: to ?? null });
    if (!error) codes.push(code);
    else if (!/duplicate/i.test(error.message)) return new Response("db error: " + error.message, { status: 500 });
  }
  if (!fresh) return new Response("already done");

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) { console.log("codes made but not emailed", orderId, codes); return new Response("codes made, email not configured"); }
  const app = Deno.env.get("APP_URL") ?? "https://llp-planner-app.vercel.app";
  const { html, text } = email(name, codes, app);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") ?? "Christina at Live Love Planners <hello@liveloveplanners.com>",
      to: [to], reply_to: "hello@liveloveplanners.com",
      subject: "Your 2027 planner is ready", html, text,
    }),
  });
  if (!r.ok) console.log("email failed", orderId, r.status, await r.text());
  return new Response("ok");
});
