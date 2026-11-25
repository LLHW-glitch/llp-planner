"""Puts Christina's own page artwork into the code-built planner.
The code-built PDF already has every page with the coloured tabs, frame links and a page id (named destination p<N>).
For each of her pages we take the InDesign master page, recolour it, clip away her frame (the tabs come from the code
frame), draw it on top, and copy her in-page links pointing at the right pages of this planner."""
import json, sys, pikepdf

out, cfg = sys.argv[1], json.load(open(sys.argv[2]))
C = cfg['colours']
rgb = lambda h: [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
G, MINT, RULE, WHEEL, SOFT, PALE = (rgb(C[k]) for k in ('G', 'MINT', 'RULE', 'WHEEL', 'SOFT', 'PALE'))
mix = lambda a, b, t: [a[i] * t + b[i] * (1 - t) for i in range(3)]

def tint(vals, stroke):
    if max(vals) - min(vals) > .02: return None
    v = sum(vals) / 3
    if v < .02 or v > .985: return None               # black text, white paper
    if abs(v - .1059) < .006: return G                  # her accent colour (lines, boxes)
    if abs(v - .247) < .01: return None                 # grey text
    if stroke: return [1, 1, 1] if v < .6 else RULE   # grey shadow lines beside boxes disappear; pale lines stay pale
    if v < .55: return None                             # mid grey text and placeholders
    if v < .82: return SOFT                             # stronger accents (week numbers, highlighted bands)
    if v < .95: return MINT
    return PALE

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

def n_is_light(v):
    return max(v) - min(v) < .02 and .55 < sum(v) / 3 < .985

def recolour_form(x, pdf, done):
    if x.objgen in done: return
    done.add(x.objgen)
    ops = []; fill = None; fillop = 'scn'; mapped = None; size = 10; tm = 1
    lw = 1; seg = []
    for operands, op in pikepdf.parse_content_stream(x):
        o = str(op)
        if o in ('scn', 'SCN', 'sc', 'SC', 'rg', 'RG') and len(operands) == 3 and not any(isinstance(v, pikepdf.Name) for v in operands):
            vals = [float(v) for v in operands]
            n = tint(vals, o.isupper())
            if not o.isupper(): fill, fillop, mapped = vals, o, n
            if n: operands = [round(v, 4) for v in n]
        elif o == 'w':
            lw = float(operands[0])
            if lw > .8: operands = [0.75]                    # one line weight throughout
        elif o in ('m', 'l'): seg.append([float(v) for v in operands])
        elif o == 'S' and len(seg) == 2 and lw <= .55 and abs(seg[0][1] - seg[1][1]) < .01 and abs(seg[0][0] - seg[1][0]) > 500:
            seg = []; ops.append(([], pikepdf.Operator('n'))); continue   # thin full-width rule that doubles up with a box edge
        elif o in ('S', 's', 'f', 'B', 'b', 'f*', 'n', 'B*', 'b*'): seg = []
        elif o == 're':
            x_, y_, w_, h_ = (float(v) for v in operands)
            if 1 < abs(h_) < 2.7 and abs(w_) > 15: operands = [x_, y_ + (h_ - .75 * (1 if h_ > 0 else -1)) / 2, w_, .75 * (1 if h_ > 0 else -1)]   # heavy rules drawn as bars
            elif 1 < abs(w_) < 2.7 and abs(h_) > 15: operands = [x_ + (w_ - .75 * (1 if w_ > 0 else -1)) / 2, y_, .75 * (1 if w_ > 0 else -1), h_]
        elif o == 'Tf': size = abs(float(operands[1]))
        elif o == 'Tm': tm = abs(float(operands[3])) or abs(float(operands[1])) or 1
        if o in ('Tj', 'TJ', "'", '"') and fill and n_is_light(fill) and size * tm < 20:
            # light grey text (week numbers and similar) becomes the accent colour so it stays readable
            ops.append(([round(v, 4) for v in G], pikepdf.Operator(fillop)))
            ops.append((operands, op))
            ops.append(([round(v, 4) for v in (mapped or fill)], pikepdf.Operator(fillop)))
            continue
        ops.append((operands, op))
    xo = (x.get('/Resources') or {}).get('/XObject') or {}
    def pic(name):
        im = xo.get(name)
        return im is not None and im.get('/Subtype') == '/Image' and 60 <= int(im.Width) <= 200
    ops = [(a, o) for a, o in ops if not (str(o) == 'Do' and pic(a[0]))]
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
    # her artwork first (clipped to the paper), then the code page on top: see-through paper, tabs, icons
    page.contents_add(doc.make_stream(b'q 0 0 574.8 771 re W n ' + str(name).encode() + b' Do Q\n'), prepend=True)
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
