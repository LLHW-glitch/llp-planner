# PDF builder (customer's chosen options -> planner PDF)

Builds the PDF planner from Christina's InDesign master PDFs, keeping the exact artwork:

1. Picks pages by option (daily layout D1/D2/none, weekly W1/W2, goal planner, project planner, bonus templates).
2. Rewires all page links to the new page order. Links to left-out daily pages go to that week, links to left-out sections are removed.
3. Switches the schedule links to Google Calendar if chosen (Apple uses the LiveLovePlanners shortcut).
4. Recolours the grey artwork to the chosen colourway (`recolour.py`).

Masters live outside git (`masters/D1W1.pdf` etc., or set `LLP_MASTERS`). A full planner builds in about 5 seconds, no browser needed.

Still to do: Monday start (date pages), combined weekly/schedule layout (W3), hiding index buttons for left-out sections, coloured tabs, builder page, Shopify order hook.
