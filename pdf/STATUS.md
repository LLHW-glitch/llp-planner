# Custom PDF planner: parked 25 Nov 2026

Picking this back up later. This is where it stands.

## How it works
- `gen-v3.js` (Node + Playwright) builds the cover, frame, tabs and all date pages in code, then calls `splice.py`.
- `splice.py` (pikepdf) puts Christina's own InDesign page artwork (`assets/master-D1W1.pdf`, White, Sunday start) underneath the code frame, recoloured to the chosen tone, and copies her in-page links.
- Run: `node gen-v3.js '{"name":"v3-full","tone":"blush"}'` (702 pages).
- Checks: `check-line-weights.py`, `check-line-colours.py`.

## Done
- Tabs (top, side, icon tab) in her shapes with shade and edge line; her own icons traced to vectors.
- All links working (about 40k, none broken); notes links fixed by grid position.
- One line weight (0.75pt) and accent colour throughout; dotted grids visible; shadows removed.
- Header bands (light accent fill) on index boxes and small tables.
- Cursive placeholder text kept faint.
- Important Dates page rebuilt in code as 12 month tables with header cells.

## Still to do
1. Header fill on tables drawn as separate cell lines with no white box (e.g. My Finances: Financial summary and Balances header rows, the label column of "Income goal" and "Lowest income month"). `analyse()` in splice.py only finds header rows inside a white box; needs a second pass that groups cell-edge lines into tables.
2. Re-run both line scanners after that and check every page.
3. Sunday start for code pages, plus Monday versions of At a glance and year spreads.
4. Layout options: W2, D2, no daily, and W3 (combined weekly + schedule).
5. Apple / Google calendar link option.
6. Builder page (customer picks options), Shopify order hook, email delivery (waiting on email provider choice).
7. Wire gen-v3 into `worker.js` (still uses gen-v2) and update CODEX_BRIEF.
