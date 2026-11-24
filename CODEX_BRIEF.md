# Live Love Planners 2027: online planner handover brief

You are taking over a finished front end and moving it to production hosting. **Do not redesign anything.** The design, layouts, templates, stickers and widgets are approved. Your job is the hosting, database, logins, access codes and data safety.

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
| `gen.js` | PDF generator (Node and Playwright) that builds the printed planner layout. It is not wired to customer data yet. |
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

**PDF export (next phase).** `gen.js` builds the planner layout with Playwright. It will need to run as a server function or a background job, read the user's documents and fill them in. It should also apply their colourway (`settings.tone`) and day layout (`settings.dayLayout`, which is `d1` or `d2`), and draw their stickers from the `stickers` doc using `x`/`y`/`w`/`r` as percentages of the page. This is not built yet.

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
