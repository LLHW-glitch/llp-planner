"""Live Love Planners PDF builder.

Builds a customer's planner from Christina's InDesign master PDFs (Sunday start, White):
  masters/D1W1.pdf  D1W2.pdf  D2W1.pdf  D2W2.pdf   (all 706 pages, identical structure)
Every page keeps its exact artwork. Pages are picked by option, recoloured to the chosen colourway,
and every link is rewired to the new page order (links to removed pages go somewhere sensible).

Options (JSON):
  tone:     linen | blush | sky | arctic | breeze | orchid | midnight | shea | slate | dustyrose | afterdark | white
  daily:    d1 | d2 | none
  weekly:   w1 | w2
  calendar: apple | google
  goals, projects, bonus: true | false
  start:    sunday   (monday is built in a later step)
Usage: python3 assemble.py '{"tone":"blush","daily":"d2","weekly":"w1"}' out.pdf
"""
import json, re, sys, os
from datetime import datetime, timedelta
import pikepdf
from recolour import recolour

HERE = os.path.dirname(os.path.abspath(__file__))
MASTERS = os.environ.get('LLP_MASTERS', os.path.join(HERE, 'masters'))
TITLES = json.load(open(os.path.join(HERE, 'catalogue-titles.json')))['D1W1']
MON = 'January February March April May June July August September October November December'.split()

# ---------- page catalogue (original page numbers, 1-based) ----------
def catalogue():
    kind = {}
    for i, t in enumerate(TITLES, 1):
        if re.match(r'(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), \w+ \d+, \d{4}', t): kind[i] = 'daily'
        elif re.match(r'\w+\s+Weekly Review\s+Week \d+', t) and t.split()[0] in MON: kind[i] = 'weekly'
        elif i in range(16, 27): kind[i] = 'goals'
        elif i in range(27, 38): kind[i] = 'projects'
        elif i >= 614: kind[i] = 'bonus'
        else: kind[i] = 'fixed'
    return kind
KIND = catalogue()

def daily_info(n):
    m = re.match(r'\w+, (\w+) (\d+), (\d{4}).*?Week (\d+)', TITLES[n - 1])
    return m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4))

WEEKP = {}
for n, k in KIND.items():
    if k == 'weekly':
        m = re.match(r'(\w+)\s+Weekly Review\s+Week (\d+)', TITLES[n - 1]); WEEKP[(m.group(1), int(m.group(2)))] = n
def week_of_daily(n):
    mon, d, y, w = daily_info(n)
    if y == 2026: mon = 'January'
    if y == 2028: mon = 'December'
    return WEEKP.get((mon, w)) or WEEKP.get((mon, w - 1))

def build(opts, out):
    o = dict(tone='white', daily='d1', weekly='w1', calendar='apple', goals=True, projects=True, bonus=True, start='sunday'); o.update(opts)
    D = {'d1': '1', 'd2': '2', 'none': '1'}[o['daily']]; W = {'w1': '1', 'w2': '2'}[o['weekly']]
    src = {}
    def master(name):
        if name not in src: src[name] = pikepdf.open(os.path.join(MASTERS, name + '.pdf'))
        return src[name]
    base = master('D1W1')
    # which master each original page comes from
    def source(n):
        k = KIND[n]
        if k == 'weekly': return master('D1W' + W)
        if k == 'daily': return master('D' + D + 'W1')
        return base
    keep = [n for n in range(1, len(TITLES) + 1)
            if not (KIND[n] == 'daily' and o['daily'] == 'none')
            and not (KIND[n] == 'goals' and not o['goals'])
            and not (KIND[n] == 'projects' and not o['projects'])
            and not (KIND[n] == 'bonus' and not o['bonus'])]
    keepset = set(keep)
    # where a link to a removed page should go instead
    def redirect(n):
        if n in keepset: return n
        if KIND[n] == 'daily': return week_of_daily(n)
        return None  # section left out: drop the link

    # named destinations of each master -> original page number
    namemaps = {}
    def names(pdf):
        key = id(pdf)
        if key not in namemaps:
            pos = {p.objgen: i + 1 for i, p in enumerate(pdf.pages)}
            m = {}
            for k, v in pikepdf.NameTree(pdf.Root.Names.Dests).items():
                arr = v.get('/D') if isinstance(v, pikepdf.Dictionary) else v
                m[str(k)] = (pos.get(arr[0].objgen), list(arr)[1:])
            namemaps[key] = m
        return namemaps[key]

    outpdf = pikepdf.new()
    pending = []  # (annotation, original target page, view)
    for n in keep:
        s = source(n); nm = names(s)
        outpdf.pages.append(s.pages[n - 1])
        page = outpdf.pages[-1]
        ann = page.get('/Annots')
        if ann is None: continue
        newann = pikepdf.Array()
        for a in ann:
            act = a.get('/A')
            if act is not None and act.get('/S') == '/GoTo':
                d = act.get('/D'); t = None
                if isinstance(d, (pikepdf.String, pikepdf.Name)) and str(d) in nm: t, view = nm[str(d)]
                if t is None: continue
                t = redirect(t)
                if t is None: continue
                pending.append((act, t)); newann.append(a)
            elif act is not None and act.get('/S') == '/URI':
                u = str(act.URI)
                m = re.search(r'text=(\d{8})(?:T(\d\d):(\d\d))?', u)
                if o['calendar'] == 'google' and m:
                    day = m.group(1)
                    if m.group(2):
                        s0 = datetime.strptime(day + m.group(2) + m.group(3), '%Y%m%d%H%M'); s1 = s0 + timedelta(hours=1)
                        dates = s0.strftime('%Y%m%dT%H%M00') + '/' + s1.strftime('%Y%m%dT%H%M00')
                    else:
                        d0 = datetime.strptime(day, '%Y%m%d'); dates = day + '/' + (d0 + timedelta(days=1)).strftime('%Y%m%d')
                    act.URI = pikepdf.String('https://calendar.google.com/calendar/u/0/r/eventedit?dates=' + dates)
                newann.append(a)
            else:
                newann.append(a)
        page['/Annots'] = newann
    newpos = {n: i for i, n in enumerate(keep)}
    for act, t in pending:
        act['/D'] = pikepdf.Array([outpdf.pages[newpos[t]].obj, pikepdf.Name('/Fit')])
    if o['tone'] != 'white': recolour(outpdf, o['tone'])
    outpdf.Root.PageMode = pikepdf.Name('/UseNone')
    outpdf.docinfo['/Title'] = 'Live Love Planners 2027'
    outpdf.docinfo['/Author'] = 'Live Love Planners'
    outpdf.save(out, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
    return len(keep), len(pending)

if __name__ == '__main__':
    n, links = build(json.loads(sys.argv[1]), sys.argv[2])
    print('pages', n, 'page links', links)
