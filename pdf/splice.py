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

def mmul(a, b):
    return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3], a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3], a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]]
def minv(m):
    a, b, c, d, e, f = m; det = a * d - b * c
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
def apply(m, x, y): return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
SCRIPT = ('HeartMaze', 'Larianti', 'LuckyRetro')

def analyse(ops, fonts):
    """Geometry of one form in its own coordinates: white boxes, horizontal lines, text positions, tiny dots."""
    ctm = [1, 0, 0, 1, 0, 0]; st = []; path = []; fill = None; lw = 1
    boxes = []; hlines = []; texts = []; dots = set(); thin_full = []
    tm = [1, 0, 0, 1, 0, 0]; tl = [1, 0, 0, 1, 0, 0]
    for k, (a, op) in enumerate(ops):
        o = str(op)
        if o == 'q': st.append((ctm[:], lw))
        elif o == 'Q' and st: ctm, lw = st.pop()
        elif o == 'cm': ctm = mmul([float(v) for v in a], ctm)
        elif o == 'w': lw = float(a[0])
        elif o in ('scn', 'sc', 'rg') and len(a) == 3 and not any(isinstance(v, pikepdf.Name) for v in a): fill = [float(v) for v in a]
        elif o in ('m', 'l'): path.append(apply(ctm, float(a[0]), float(a[1])))
        elif o in ('c', 'v', 'y'): path.append(apply(ctm, float(a[-2]), float(a[-1]))); path.append(apply(ctm, float(a[0]), float(a[1])))
        elif o == 're':
            x0, y0, w0, h0 = (float(v) for v in a)
            path += [apply(ctm, x0, y0), apply(ctm, x0 + w0, y0 + h0), apply(ctm, x0 + w0, y0), apply(ctm, x0, y0 + h0)]
        elif o in ('f', 'f*', 'B', 'b', 'B*', 'b*', 'S', 's', 'n'):
            if path:
                xs = [p_[0] for p_ in path]; ys = [p_[1] for p_ in path]
                bb = (min(xs), min(ys), max(xs), max(ys))
                if o.startswith(('f', 'B', 'b')) and fill and min(fill) > .99 and bb[2] - bb[0] > 50 and bb[3] - bb[1] > 30: boxes.append((k, bb, ctm[:]))
                if o.startswith(('f', 'B', 'b')) and bb[2] - bb[0] < 3.5 and bb[3] - bb[1] < 3.5: dots.add(k)
                if o in ('S', 's', 'B', 'b') and bb[3] - bb[1] < .2 and bb[2] - bb[0] > 20:
                    hlines.append((bb[1], bb[0], bb[2], k))
                    if lw <= .55 and bb[2] - bb[0] > 500: thin_full.append((bb[1], k))
                if o in ('S', 's', 'B', 'b') and len(path) >= 4 and bb[3] - bb[1] > 5:   # box edges as lines too
                    hlines.append((bb[1], bb[0], bb[2], -1)); hlines.append((bb[3], bb[0], bb[2], -1))
            path = []
        elif o == 'BT': tm = [1, 0, 0, 1, 0, 0]; tl = tm[:]
        elif o == 'Tm': tm = [float(v) for v in a]; tl = tm[:]
        elif o in ('Td', 'TD'): tl = mmul([1, 0, 0, 1, float(a[0]), float(a[1])], tl); tm = tl[:]
        elif o in ('Tj', 'TJ', "'", '"'): texts.append(apply(mmul(tm, ctm), 0, 0))
    # a thin full-width rule sitting within 1pt of a box edge doubles up: drop the rule
    drop = {k for y, k in thin_full if any(abs(y - y2) < 1.2 and k2 != k and (x1 - x0) < 520 for y2, x0, x1, k2 in hlines)}
    # header bands: a white box whose first full-width line sits 10-34pt below its top, with text between
    bands = {}
    for k, (x0, y0, x1, y1), c in boxes:
        inside = sorted({round(y, 1) for y, a0, a1, kk in hlines if a0 <= x0 + 3 and a1 >= x1 - 3 and y0 + 1 < y < y1 - 1}, reverse=True)
        if not inside: continue
        yl = inside[0]
        if 10 <= y1 - yl <= 34 and any(x0 < tx < x1 and yl < ty < y1 for tx, ty in texts):
            bands.setdefault(k, []).append((x0, yl, x1 - x0, y1 - yl, c))
    return drop, bands, dots

def recolour_form(x, pdf, done):
    if x.objgen in done: return
    done.add(x.objgen)
    src = list(pikepdf.parse_content_stream(x))
    fonts = {}
    for nm, fo in (((x.get('/Resources') or {}).get('/Font')) or {}).items():
        fonts[str(nm)] = str(fo.get('/BaseFont', ''))
    drop, bands, dots = analyse(src, fonts)
    ops = []; fill = None; fillop = 'scn'; mapped = None; size = 10; tm = 1; font = ''
    stroke = None; strokeop = 'SCN'; smapped = None; dotted = False; curw = 1
    for k, (operands, op) in enumerate(src):
        o = str(op)
        if k in drop: ops.append(([], pikepdf.Operator('n'))); continue
        if o in ('scn', 'SCN', 'sc', 'SC', 'rg', 'RG') and len(operands) == 3 and not any(isinstance(v, pikepdf.Name) for v in operands):
            vals = [float(v) for v in operands]
            n = tint(vals, o.isupper())
            if not o.isupper(): fill, fillop, mapped = vals, o, n
            else: stroke, strokeop, smapped = vals, o, n
            if n: operands = [round(v, 4) for v in n]
        elif o == 'w':
            if float(operands[0]) > .8: operands = [0.75]                    # one line weight throughout
            curw = float(operands[0])
        elif o == 're':
            x_, y_, w_, h_ = (float(v) for v in operands)
            if 1 < abs(h_) < 2.7 and abs(w_) > 15: operands = [x_, y_ + (h_ - .75 * (1 if h_ > 0 else -1)) / 2, w_, .75 * (1 if h_ > 0 else -1)]   # heavy rules drawn as bars
            elif 1 < abs(w_) < 2.7 and abs(h_) > 15: operands = [x_ + (w_ - .75 * (1 if w_ > 0 else -1)) / 2, y_, .75 * (1 if w_ > 0 else -1), h_]
        elif o == 'Tf':
            size = abs(float(operands[1])); font = fonts.get(str(operands[0]), '')
        elif o == 'Tm': tm = abs(float(operands[3])) or abs(float(operands[1])) or 1
        elif o == 'd':
            arr = list(operands[0]) if len(operands) else []
            was = dotted; dotted = bool(arr) and float(arr[0]) == 0
            ops.append((operands, op))
            if dotted: ops.append(([1.3], pikepdf.Operator('w')))            # rounder, more visible dots
            elif was: ops.append(([curw], pikepdf.Operator('w')))
            continue
        if o in ('S', 's') and dotted and stroke is not None:
            # dot grids are drawn as dotted lines: give the dots a mid tone so they show
            ops.append(([round(v, 4) for v in G], pikepdf.Operator(strokeop))); ops.append((operands, op)); ops.append(([round(v, 4) for v in (smapped or stroke)], pikepdf.Operator(strokeop))); continue
        if k in dots and fill and n_is_light(fill):
            # dot grids: the dots get a mid tone so they show
            ops.append(([round(v, 4) for v in WHEEL], pikepdf.Operator(fillop))); ops.append((operands, op)); ops.append(([round(v, 4) for v in (mapped or fill)], pikepdf.Operator(fillop))); continue
        if o in ('Tj', 'TJ', "'", '"') and fill and n_is_light(fill) and size * tm < 20 and not any(sname in font for sname in SCRIPT):
            # light grey text (week numbers and similar) becomes the accent colour so it stays readable
            ops.append(([round(v, 4) for v in G], pikepdf.Operator(fillop)))
            ops.append((operands, op))
            ops.append(([round(v, 4) for v in (mapped or fill)], pikepdf.Operator(fillop)))
            continue
        ops.append((operands, op))
        if k in bands:
            # header row of a box or table gets the light accent fill (drawn straight after the white box, under its lines and text)
            for bx, by, bw, bh, c in bands[k]:
                inv = minv(c)
                ops.append(([], pikepdf.Operator('q')))
                ops.append(([round(v, 6) for v in inv], pikepdf.Operator('cm')))
                ops.append(([round(v, 4) for v in MINT], pikepdf.Operator('rg')))
                ops.append(([round(bx + .4, 2), round(by + .4, 2), round(bw - .8, 2), round(bh - .8, 2)], pikepdf.Operator('re')))
                ops.append(([], pikepdf.Operator('f')))
                ops.append(([], pikepdf.Operator('Q')))
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
