# Live Love Planners 2027: online planner handover brief

You are taking over a finished front end and moving it to production hosting. **Do not redesign anything.** The design, layouts, templates, stickers and widgets are approved. Your job is the hosting, database, logins, access codes and data safety.

## 0. Where things stand (updated 24 November 2026)

### Live now
- **Site:** https://llp-planner-app.vercel.app (Vercel project `llp-planner-app`, deploys automatically from `main`, root directory `app`).
- **Repo:** `LLHW-glitch/llp-planner` on GitHub.
- **Database:** Supabase project **LLP Planner**, ref `hanqpldjcegadyrrxzvw`, region London, free plan.
  - Everything in `supabase/migrations/0001_planner_core.sql` is applied: `planner_docs`, `planner_docs_history`, `access_codes`, `entitlements`, the `apply_patch` and `redeem_code` functions, row level security, realtime and the private `user-uploads` bucket.
  - Test codes `LLP27-TEST-0001` to `LLP27-TEST-0010` exist for 2027.
  - Auth URL settings point at the live site: Site URL `https://llp-planner-app.vercel.app`, redirect `https://llp-planner-app.vercel.app/**`.
- **App adapter:** already built into `app/index.html`. When `window.LLP_SUPA` is set, the app uses magic-link sign-in, the code screen, `apply_patch` for saves, realtime for other devices, and Storage for photos. Without it, it falls back to the original `window.claude` storage. So sections 3 and 4 below describe what exists, not a to-do list.
- **PDF export:** `pdf/gen-v2.js` fills the printed layout from a customer's documents (see section 8).

### Still to do before launch (in order)
1. End-to-end test on the live site: sign in, redeem a test code, tick and type, refresh, open on a second device.
2. Custom SMTP for auth emails (for example Resend). The built-in Supabase email only sends a few emails an hour.
3. Shopify order to access code: an order-paid webhook into a Supabase edge function that creates a code, emails it and verifies the Shopify HMAC.
4. Upgrade Supabase to Pro (point-in-time backups) and Vercel to Pro. Add billing alerts on both.
5. Staging. **Not created yet.** The free Supabase plan allows two active projects and both slots are in use ("LLP Planner" and "Live a Healthy Me"). Once on Pro, create "LLP Planner Staging", apply the same migration, and point a Vercel preview branch at it.
6. Nightly independent backup (GitHub Action running `pg_dump` to outside storage). It needs the database connection string as a GitHub secret, which Christina must add herself.
7. Move the base64 images out of `index.html` into files (section 5).
8. Custom domain `app.liveloveplanners.com`, renewal banner from 1 December, and a PDF download button (section 8).

## 1. What this product is

A pay-once online 2027 digital planner at `app.liveloveplanners.com`.

- Customers buy on liveloveplanners.com (Shopify). They get a unique access code and use it to unlock a planner year.
- There are no payments inside the app.
- From 1 December the app prompts for next year. "Buy 2028" sends them to the Shopify product page, which opens in a new tab.
- A customer keeps access to every year they have unlocked. Old years stay readable and editable.
- The planner also exports a US Letter PDF that matches the printed planner design (see section 8).

## 2. Files in this folder

| File | What it is |
|---|---|
| `index.html` | The whole app, about 4.7MB. A single page that renders every view from JavaScript. |
| `gen.js` / `gen-v2.js` | PDF generator (Node and Playwright). `gen-v2.js` fills the printed layout from customer data. |
| `mock.js` | A fake version of the current database API, used for local testing. |
| `tests/*.js` | Playwright scripts used during the build. Reuse them for regression checks. |

To run locally, wrap `index.html` with `mock.js` exactly as the test scripts do (`t2.html`). Then open the page with a `#route`, for example `#dashboard`, `#day-20270105`, `#tpl-travel` or `#recipes`.

## 3. How the app stores data today (keep this shape)

All data belongs to one user. It is a set of **documents**, each identified by a string key. Each document is a JSON object.

Example keys:

- `settings`, `year`, `q1` to `q4`, `m1` to `m12`
- `d20270105` (a day), `w20270104` (a week)
- `hb202701` (habits), `money1`, `wellness1`, `meals20270104`
- `recipes`, `recur`, `brain`, `stickers`, `pages`
- `tpl-<id>` and `pg-<id>` (templates and copies of them)
- image docs such as `vb-year-0`, `recipe-img-<id>` and `stw-<id>`

Saving is **field level**:

- The app sends a patch of *flat* keys, where `~` separates path parts. For example `{"pri~0~t": "Call Mum", "pri~0~c": true}`.
- A value of `null` deletes that field.
- Lists are stored as objects with numeric keys and converted back to arrays when loaded (see `unflat` and `arr`).

The app currently talks to a host API through three calls. **Replace only these. Do not touch page code.**

| Current call | What it does |
|---|---|
| `window.claude.use('user')` then `user.id()` | Returns the signed-in user's id |
| `window.claude.use('db')` then `db.collection('data/users/'+uid)` | Returns `coll` |
| `coll.doc(k).update(flatFields)` | Merges a flat patch into document `k` (creating it if missing) |
| `coll.doc(k).set(flatObject)` | Fallback full write |
| `coll.onSnapshot(cb, err)` | Calls `cb({docs:[{id, data()}]})` with **all** of this user's documents on load and again whenever they change. `data()` returns the flat stored object. |

Look for `coll.` near `async function flush(` and in the boot block at the bottom of the script (`coll.onSnapshot`). Write a small adapter object with the same methods, backed by Supabase. Then the rest of the app works unchanged.

The app also keeps a local backup of every document in `localStorage` (`llp27:<key>`). Keep it.

## 4. Supabase setup

### Projects

Use two projects: **production** and **staging**. Every change goes to staging first.

### Auth

Use email magic link or email OTP (no passwords). Add Apple and Google sign-in later if wanted.

### Tables

```sql
create table planner_docs (
  user_id uuid not null references auth.users on delete cascade,
  year int not null default 2027,
  doc_key text not null,
  data jsonb not null default '{}',     -- flat keys exactly as the app sends them
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,               -- soft delete, never hard delete
  primary key (user_id, year, doc_key)
);

create table access_codes (
  code text primary key,                -- e.g. LLP27-XXXX-XXXX
  year int not null,
  shopify_order_id text,
  email text,
  redeemed_by uuid references auth.users,
  redeemed_at timestamptz,
  created_at timestamptz default now()
);

create table entitlements (
  user_id uuid references auth.users on delete cascade,
  year int,
  source_code text references access_codes(code),
  created_at timestamptz default now(),
  primary key (user_id, year)
);

create table planner_docs_history (     -- every write, kept for 90 days, for restores
  id bigserial primary key,
  user_id uuid, year int, doc_key text,
  patch jsonb, created_at timestamptz default now()
);
```

### Row level security

Turn it on for every table. A user can only select, insert or update their own `planner_docs` rows, and only for years they hold in `entitlements`. `access_codes` is never readable from the browser; codes are redeemed through an edge function.

### Merge function

Write an RPC `apply_patch(p_year int, p_doc text, p_patch jsonb)`. It should:

- upsert the row;
- for each key in the patch, set it, or remove it if the value is null;
- bump `updated_at`;
- insert the patch into `planner_docs_history`.

The adapter's `update()` calls this. It must be a merge, never a whole-document overwrite. Overwrites wiped edits during development.

### Realtime

Subscribe to `planner_docs` filtered by `user_id`. On any change, call the app's snapshot callback with the full current list of the user's documents. A small debounce is fine.

### Storage

Create a bucket `user-uploads` with each user's files under `uid/...`. Photos are currently saved as data URLs inside documents (search for `data-vimg` and `resizeImage`). Change the upload handler to:

1. upload the file to Storage;
2. save the public or signed URL in the same `src` field.

Keep reading old data URLs so nothing breaks.

## 5. Static assets

`index.html` embeds base64 images: the 106 everyday stickers, 63 icons, and washi tape and quotes in 9 colourways. Look for `const IMGSTK=`, `const ICONS=`, and the injected styles for `.wsh1` to `.wsh6`, `.qte1` to `.qte6` and `.ic0` to `.ic62`.

- Extract them into `/public/stickers/...` as files and reference them by URL. Keep the same ids and class names.
- This should bring the page well under 1MB.
- The look must not change.

## 6. Access codes and years

1. **Shopify side.** On a paid order for the planner product, create a code for that year and email it to the customer. Use a Shopify Flow webhook, or an order-paid webhook to a Vercel or Supabase edge function. Verify the Shopify HMAC.
2. **Redeem.** An edge function `redeem(code)` checks the code exists and is unused, marks it redeemed, and inserts the entitlement.
3. **In the app:**
   - a signed-in user with no entitlement sees a simple "Enter your access code" screen;
   - with an entitlement they see the planner;
   - a year switcher appears if they own more than one year.
4. **Renewal prompt.** From 1 December, show a gentle banner: "Your 2028 planner is ready". The button opens the Shopify product in a new tab, and there is an "I have a code" box.

## 7. Data safety (required, not optional)

- Daily automatic backups, using Supabase point-in-time recovery on a paid plan.
- A **second, independent nightly backup**: a GitHub Action that runs `pg_dump` and stores an encrypted copy outside Supabase (for example Backblaze or S3) with 30 days of retention.
- Soft deletes only. Nothing in the app hard deletes user rows.
- Keep `planner_docs_history` so a single user's page can be restored.
- Billing alerts on Supabase and Vercel.
- No hand-editing the production database. Changes go through scripts that are tested on staging.
- **Migrations rule.** If a page ever changes how it stores data, write a conversion that copies old entries into the new shape before release. There is an example in the app: the recipe ingredients conversion in `rcMigrate`. New templates and pages only add new keys, so they never touch existing entries.

## 8. Vercel

- The GitHub repo holds code only. No customer data and no secrets in the repo.
- Use Vercel environment variables for the Supabase URL and anon key. The service key goes only in server functions.
- Domains:
  - `app.liveloveplanners.com` points to production;
  - `staging.app.liveloveplanners.com` (or a Vercel preview) points to the staging Supabase project.

**PDF export.** `pdf/gen-v2.js` is built and tested with mock data (`pdf/test-data/`). `pdf/gen.js` is the earlier blank-only version, kept for reference.
- Run: `node gen-v2.js '{"name":"jan","months":[0],"data":"test-data/mock-docs.json","app":"../app/index.html"}'`. It needs Playwright, the fonts in `node_modules/@fontsource` (figtree, forum, dancing-script) and the `assets/` folder of page artwork, which lives on Christina's Mac in the build folder (not in the repo yet).
- `data` is a JSON file of `{ docKey: flatFields }`, exactly what `planner_docs.data` holds for one user and year. To export a customer, select their rows and write them out in that shape.
- It opens the app headlessly with that data, so recurring tasks, brain dump items, calendar entries, habits and settings are worked out by the app's own code. It adds one line to the end of the app script to reach those helpers; the app file is not changed.
- Filled pages: Index (custom sections list the customer's own pages), monthly calendar (entries in each day), dashboard (focus, goals, important dates, habit grids), finances (income, bills, spending, savings and totals), weekly (day notes, priorities, to do, habit ticks, reminders), weekly review, and daily pages.
- Colourway comes from `settings.tone` (all 11, including Arctic outlines, Midnight dark tabs and Afterdark dark pages). Day layout comes from `settings.dayLayout`: D2 swaps in intention, must-dos, meals (from the weekly meal planner), water and mood (from monthly wellness), movement, gratitude and "just for me".
- Stickers are photographed from the app as the customer sees them and placed using `x`/`y`/`w`/`r` as percentages of the paper. Stickers on template pages are skipped because the printed layout has no template pages yet.
- Not filled yet: the monthly reflection page (the app has no monthly reflection; quarter reviews cover it), the dashboard "Top projects" and "To do" lists, sinking funds and debt tables (the app keeps these in templates), and template pages generally.
- Sunday-start customers get the correct entries, but the printed weeks still run Monday to Sunday.
- Production idea: run it as a background job (not a Vercel function, it needs a full Chromium and takes about 8 seconds a month), store the PDF in Storage and email a signed link.

## 9. Things that must keep working (test on staging)

Run the Playwright scripts against staging and compare screenshots against the current version.

- Every desktop page fits one screen with no scrolling, at 1280x720, 1366x768 and 1440x900.
- Ticks, typing, undo (top bar arrow and Ctrl/Cmd+Z), deleting rows, copying templates and organising pages all save and survive a refresh and a second device.
- Stickers:
  - add, move, resize and rotate them, double-click to write on them, and tick the checklist notes;
  - mobile positions are stored separately (`mx`/`my`/`mw`).
- Widgets: typing saves, and Currently reading fills itself from the book library.
- Brain dump items with a day appear on that day and stay until ticked there.
- Both day layouts work. D2 meals write into the weekly meal planner, and D2 water writes into monthly wellness.
- All 11 colourways work. Washi tape and quotes swap to the matching colourway, and Arctic and Afterdark use Midnight.
- Phone layout at 390px wide, with no sideways scrolling.
- Two test users cannot see each other's data.
- The Apple Calendar option opens `shortcuts://run-shortcut?name=LiveLovePlanners&input=text&text=YYYYMMDDTHH:MM:SS` and works on a real iPhone or Mac. It is blocked in previews, so test it on the staging domain.

## 10. Style rules for anything customer-facing you add

- UK spelling.
- Friendly, plain wording. No corporate tone.
- No em dashes.
- External links open in a new tab.
