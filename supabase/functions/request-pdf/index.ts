// Called by the app's "Email me my PDF" button. Queues the job, then wakes the GitHub worker.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  let year = 2027;
  try { const b = await req.json(); if (Number.isInteger(b?.year)) year = b.year; } catch (_) { /* default year */ }
  const { data: job, error } = await sb.rpc("request_pdf", { p_year: year });
  if (error) return json({ error: error.message }, 400);

  // wake the worker straight away (GH_DISPATCH_TOKEN: fine-grained token with Actions read and write on the repo)
  const token = Deno.env.get("GH_DISPATCH_TOKEN");
  let woken = false;
  if (token) {
    const r = await fetch("https://api.github.com/repos/LLHW-glitch/llp-planner/actions/workflows/pdf-worker.yml/dispatches", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "llp-planner", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ ref: "main" }),
    });
    woken = r.status === 204;
    if (!woken) console.error("dispatch failed", r.status, await r.text());
  }
  return json({ job, woken });
});
