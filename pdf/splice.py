"""Puts Christina's own page artwork into the code-built planner.
The code-built PDF already has every page with the coloured tabs, frame links and a page id (named destination p<N>).
For each of her pages we take the InDesign master page, recolour it, clip away her frame (the tabs come from the code
frame), draw it on top, and copy her in-page links pointing at the right pages of this planner."""
import json, sys, pikepdf

out, cfg = sys.argv[1], json.load(open(sys.argv[2]))
C = cfg['colours']
rgb = lambda h: [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
G, MINT, RULE, WHEEL = (rgb(C[k]) for k in ('G', 'MINT', 'RULE', 'WHEEL'))
mix = lambda a, b, t: [a[i] * t + b[i] * (1 - t) for i in range(3)]

def tint(vals, stroke):
    if max(vals) - min(vals) > .02: return None
    v = sum(vals) / 3
    if v < .02 or v > .985: return None               # black text, white paper
    if abs(v - .1059) < .006: return G                  # her accent colour (lines, boxes)
    if abs(v - .247) < .01: return None                 # grey text
    if stroke: return WHEEL if v < .6 else RULE         # softer lines
    if v < .55: return None                             # mid grey text and placeholders
    return mix(MINT, [1, 1, 1], max(0, min(1, (.98 - v) / .38)))

def recolour(stream_owner, pdf, done):
    key = stream_owner.objgen
    if key in done: return
    done.add(key)
    ops = []
    for operands, op in pikepdf.parse_content_stream(stream_owner):
        o = str(op)
        if o in ('scn', 'SCN', 'sc', 'SC', 'rg', 'RG') and len(operands) == 3 and not any(isinstance(x, pikepdf.Name) for x in operands):
            n = tint([float(x) for x in operands], o.isupper())
            if n: operands = [round(x, 4) for x in n]
        ops.append((operands, op))
    stream_owner.write(pikepdf.unparse_content_stream(ops)) if isinstance(stream_owner, pikepdf.Stream) else None
    return ops

def recolour_form(x, pdf, done):
    if x.objgen in done: return
    done.add(x.objgen)
    ops = []
    for operands, op in pikepdf.parse_content_stream(x):
        o = str(op)
        if o in ('scn', 'SCN', 'sc', 'SC', 'rg', 'RG') and len(operands) == 3 and not any(isinstance(v, pikepdf.Name) for v in operands):
            n = tint([float(v) for v in operands], o.isupper())
            if n: operands = [round(v, 4) for v in n]
        ops.append((operands, op))
    x.write(pikepdf.unparse_content_stream(ops))
    for k, y in ((x.get('/Resources') or {}).get('/XObject') or {}).items():
        if y.get('/Subtype') == '/Form': recolour_form(y, pdf, done)

doc = pikepdf.open(out, allow_overwriting_input=True)
master = pikepdf.open(cfg['master'])
# page ids in the code-built PDF, in page order
dests = {pid: doc.pages[i].obj for i, pid in enumerate(cfg['order'])}
assert len(cfg['order']) == len(doc.pages), (len(cfg['order']), len(doc.pages))
pagepos = {p.objgen: i for i, p in enumerate(doc.pages)}
mpos = {p.objgen: i + 1 for i, p in enumerate(master.pages)}
mnames = {}
for k, v in pikepdf.NameTree(master.Root.Names.Dests).items():
    arr = v.get('/D') if isinstance(v, pikepdf.Dictionary) else v
    mnames[str(k)] = mpos.get(arr[0].objgen)
linkmap = {int(k): v for k, v in cfg['linkmap'].items()}
done = set(); placed = links = 0
for n in cfg['static']:
    pid0 = 'index' if n == 3 else 'p%d' % n
    tgt = dests.get(pid0)
    if tgt is None: continue
    page = doc.pages[cfg['order'].index(pid0)]
    form = doc.copy_foreign(master.pages[n - 1].as_form_xobject())
    recolour_form(form, doc, done)
    name = page.add_resource(form, pikepdf.Name.XObject, prefix='LLP')
    page.contents_add(doc.make_stream(b'q\n'), prepend=True)   # isolate Chromium's own drawing state
    page.contents_add(doc.make_stream(b'\nQ q 0 0 577 771 re W n ' + str(name).encode() + b' Do Q'), prepend=False)
    placed += 1
    ann = page.obj.get('/Annots')
    if ann is None: page.obj['/Annots'] = ann = doc.make_indirect(pikepdf.Array()) if False else pikepdf.Array()
    for a in master.pages[n - 1].get('/Annots', []) or []:
        act = a.get('/A')
        if act is None: continue
        r = [float(x) for x in a.Rect]
        if min(r[0::2]) > 576 or max(r[1::2]) > 771: continue     # frame links come from the code frame
        if act.get('/S') == '/URI':
            na = pikepdf.Dictionary(Type=pikepdf.Name.Annot, Subtype=pikepdf.Name.Link, Rect=a.Rect, Border=[0, 0, 0], A=pikepdf.Dictionary(S=pikepdf.Name.URI, URI=act.URI))
        else:
            t = mnames.get(str(act.get('/D')))
            pid = linkmap.get(t)
            if not pid or pid not in dests: continue
            na = pikepdf.Dictionary(Type=pikepdf.Name.Annot, Subtype=pikepdf.Name.Link, Rect=a.Rect, Border=[0, 0, 0], A=pikepdf.Dictionary(S=pikepdf.Name.GoTo, D=pikepdf.Array([dests[pid], pikepdf.Name.Fit])))
        page.obj.Annots.append(doc.make_indirect(na)); links += 1
doc.save(out, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
print(f'her pages placed: {placed}, links added: {links}')
