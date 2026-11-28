# Live Love Planners: 2027 Online Planner, project log

**Read this first at the start of every task on this project.** Update it at the end of every task: tick off what was finished, add anything new to the to-do list, and note any decision Christina made.

Last updated: 28 Nov 2026
Launch date: **Monday 30 November 2026**

---

## Where everything lives

| What | Where |
|---|---|
| Live planner | https://app.liveloveplanners.com (live 28 Nov). https://llp-planner-app.vercel.app still works too. |
| Try-it preview (no login, saves in the browser only) | https://app.liveloveplanners.com/?demo#builder-1 |
| Code | GitHub `LLHW-glitch/llp-planner`. The app is one file, `app/index.html`, plus `app/api/ics.js` (Apple Calendar event file). Vercel deploys `main` automatically. |
| Working copy of the app | `dash-app/index.html` in the Claude scratchpad, versioned `index-vNN.html`. Deploy = first 4 lines of `vercel-app/index.html` (Supabase config) + `dash-app/index.html` + `</body></html>`, copied to `app/index.html` and `tests/app-source.html`. |
| Vercel | Team "Live Love Planners", project `llp-planner-app` (the Vercel connector can't see this project, so use the dashboard in Chrome) |
| Database and sign in | Supabase project "LLP Planner", ref `hanqpldjcegadyrrxzvw` (London, free plan). Only touch this project. |
| Shop | Shopify store "Live Love Planners", admin `admin.shopify.com/store/uxu71y-mr`. Reach it in Chrome via liveloveplanners.com/admin. The Shopify connector here is linked to Her Sunday Society, not this store. |
| Email sending | Resend account `liveloveplanners21`, sending domain `updates.liveloveplanners.com` (verified) |
| Domain DNS | Hostinger (nameservers dns-parking.com). Christina logs in herself. CNAME `app` → `01597a70a22763d5.vercel-dns-017.com` added 28 Nov. |
| Business email | hello@liveloveplanners.com forwards to liveloveplanners21@gmail.com through ImprovMX. Replies to planner emails go here, which is what she wants. |
| PDF planner (separate product, parked) | `pdf/` folder, see `pdf/STATUS.md` |

## How buying works (live since 27 Nov)

1. Customer buys a product with **"Online Planner"** in its title on liveloveplanners.com.
2. They get **one email**: Shopify's order confirmation. For planner orders it's replaced with a pretty planner email (subject "Your 2027 planner is ready") showing their access code(s), an "Open my planner" button and three steps. Template source: `shopify/order-confirmation-planner.liquid`. It wraps Shopify's standard template, so every other order still gets the normal email.
3. The code is worked out inside that email: `LLP27-` + first 12 hex characters of HMAC-SHA256(key = order confirmation number, message = "`<order id>-<n>`"), in groups of 4. One code per planner bought.
4. Shopify webhook **Order payment** → Supabase edge function `shopify-order` works out the same codes and saves them to `access_codes`. It checks Shopify's signature (`SHOPIFY_WEBHOOK_SECRET`) and is safe if Shopify sends the same order twice. It no longer sends its own email (only if the secret `SEND_CODE_EMAIL=1` is set).
5. The customer opens the planner, signs in with an emailed link (Supabase auth emails go through Resend SMTP with Christina's designs), enters the code, sets a password and goes through the setup builder.

Tested end to end on 27 Nov with a £0 test order (#1010, archived). That test used the old two-email setup. The one-email version is checked in Shopify's preview and the codes match the server, but no live order has run through it yet.

## Done

### Online planner app
- Full planner: dashboard, year at a glance, quarters, months, weeks (list or schedule), days (Productivity or Balanced layout), journal with a log of entries, vision boards, add-ons (meals, recipes, budget, habits with monthly ring overview, workout, wellness), bonus templates, notes pages (lined, dot, grid, Cornell, blank), custom sections with covers, stickers including "upload your own image", undo, search.
- December 2026 included (reached from the year page). Today opens Mon 30 Nov until the year starts.
- 13 colourways including Afterdark and Rainbow (each month and section its own colour, on white).
- Six-step setup builder on first login (name, colour, week start and calendar, daily page, weekly page, done) with real page previews. Settings page holds everything else.
- Sign in: password, emailed link, access codes; set a password after first sign in; sign out goes back to the sign in screen.
- "Download my planner" gives an .html copy that works offline, and "Bring a copy back" uploads it into the account.
- Preview mode with `?demo`.
- No green flash on refresh (colour remembered on the device).

### Mobile pass (v56, 28 Nov)
- Apple Calendar buttons run the new "LLP Planner Calendar" shortcut (v57): opens Calendar at that date and time, no Goodnotes. Install link goes in `APPLE_SC_URL` in the app once Christina shares it. (`app/api/ics.js` is left in place, unused.)
- Setup builder page previews no longer jumble on phones.
- Month, budget, vision board and reflection headers: icons sit on the title line. Day names are 3 letters on phones.
- Year page: two neat mini calendars per row on phones; "December 2026 ›" button on the title line.
- Vision boards (year and month) are one big board. "+ Add photos" (several at once) and "Stickers and words" put movable images on it. The dashboard collage uses these photos. Old photo tiles are no longer shown.
- Add-ons menu is two columns: Add-ons, and that month's pages.
- Manifestation "It happened!" sets off confetti.
- Content planner stacks on phones, recipes are centred, book review redesigned for phones (and its progress bar fixed on desktop), routines lost "Clear ticks for next time".
- Wide tables (habits, measurements, subscriptions, wellness) scroll sideways on phones instead of spilling off the page.

### v58 (28 Nov)
- Notes box on the Week list layout.
- Add-ons menu no longer lists Journal, Custom sections, Meal planner or Recipes. Meal planner and My recipes are in Bonus templates under Health & fitness. Journal and Custom sections already have their own cards on the Bonus templates page, and are reachable from day and week pages.

### Behind the scenes
- Supabase: tables, row level security, `apply_patch`, `redeem_code`, history table, storage for images, PDF job queue (for the parked PDF product).
- Resend set up (API key `LLP Planner`, sending only). Supabase auth emails use custom SMTP through Resend, 30 emails an hour.
- Auth email templates ("Open your 2027 planner", "Your 2027 planner is waiting") in her design. Source in `supabase/email-templates/`.
- Shopify webhook and the `shopify-order` function, tested.
- Pretty planner order confirmation in Shopify, saved 27 Nov.

## To do before launch (30 Nov)

- [ ] **Online Planner product listing**: "2027 Online Planner" saved as a **draft** in Shopify (27 Nov): £19.99, not a physical product, inventory not tracked, type Digital Planner, full description. Christina is dragging in the 6 images (`/mnt/user-data/outputs/online-planner-listing/`, also sent in chat). Then set it to Active. The description's "Have a play with it first" link points to app.liveloveplanners.com/?demo, so it only works once the domain is live.
- [x] **app.liveloveplanners.com** live (28 Nov): DNS added, Vercel valid, Supabase Site URL switched, "Open my planner" in the Shopify email switched. (`shopify-order` only mentions the URL in its switched-off email; repo updated, not redeployed.)
- [ ] Christina builds the "LLP Planner Calendar" shortcut and sends the iCloud share link; Claude adds it to `APPLE_SC_URL` so customers get an install link in settings.
- [ ] Christina to check the v56 mobile fixes on her phone.
- [ ] **Christina: upgrade Supabase to Pro** ($25/month) for daily backups. She said she'll do it before launch.
- [ ] Final test: real checkout of the listing (with a 100% discount code), check the one email arrives with a working code, sign up as a new customer, then archive the order and delete the test discount.
- [ ] Remove the unused `app_config` table in Supabase (needs Christina to approve).

## Test page (not live yet)

- https://app.liveloveplanners.com/test?demo&v=59 is `app/test.html` (v59): Seasons colourway (each month its own palette), written schedule slots filled like a highlighter, ticks pop, "x of 3 done" ring on top priorities. Waiting on Christina's go-ahead to make it the real app. Then copy v59 into `app/index.html` and delete `app/test.html`.

## Later

- Nightly backup to outside storage (GitHub Action with `pg_dump`). Needs the database connection string added as a GitHub secret by Christina.
- Staging copy of the database (after Supabase Pro).
- Renewal prompt for 2028 from 1 Dec 2027.
- PDF planner product (parked, see `pdf/STATUS.md`).
- Update `CODEX_BRIEF.md` to match this log.

## Decisions Christina has made

- Online planner and PDF planner are separate products. The online planner has no PDF download.
- One email per order, with the code in it, and it must look pretty.
- Replies go to hello@liveloveplanners.com (forwards to her Gmail).
- Online planner price £19.99.
- Use app.liveloveplanners.com.
- Mobile has to look as good as desktop: it's a main selling point.
- Vision boards are one big board you add photos to, not fixed photo boxes.
- The add-ons menu stays short: things reachable elsewhere (journal, sections, meals, recipes) live in Bonus templates instead.
- Apple Calendar uses its own shortcut that opens Calendar at the date and time (not the Live Love Planners one, which opens Goodnotes).
- Launch 30 Nov 2026. She'll upgrade Supabase herself before then.
- Rainbow: white background, colour in the tabs and sections, headers stay black.
- The setup builder only asks the few things that matter. Everything else is preset and lives in settings.
