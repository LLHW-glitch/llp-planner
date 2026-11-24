# Live Love Planners 2027 online planner

- `app/` is the site Vercel serves (`app/index.html`). It signs in with Supabase and saves every entry to the `planner_docs` table.
- `supabase/migrations/` holds the database setup: tables, security rules, functions and storage.
- `pdf/gen-v2.js` is the US Letter PDF generator, filled from a customer's data (colourway, day layout and stickers included). `pdf/gen.js` is the older blank version.
- `tests/` holds the Playwright checks. `tests/app-source.html` is the same app without the Supabase config, for local testing with `mock.js`.
- `CODEX_BRIEF.md` is the full handover brief.

Supabase project: **LLP Planner** (ref `hanqpldjcegadyrrxzvw`, London). The key in `app/index.html` is the public anon key, which is safe to ship. Never commit the service role key.
