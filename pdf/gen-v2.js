// Live Love Planners PDF generator v2: the printed planner layout, filled with a customer's planner data.
// It reads the same documents the online app saves, opens the app itself (headless) to work out recurring tasks,
// brain dump items and calendar entries exactly as the app does, and photographs each sticker so it matches the app.
//
// Usage:
//   node gen-v2.js '{"name":"jan","months":[0],"data":"mock-docs.json","app":"../dash-app/index.html"}'
//   data: JSON file of { docKey: flatFields } (the shape stored in planner_docs.data). Leave it out for a blank planner.
//   tone / dayLayout: optional overrides; otherwise taken from the customer's settings doc.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const S = Object.assign({ name: 'full', months: [0,1,2,3,4,5,6,7,8,9,10,11], data: null, app: '../dash-app/index.html', stickers: true }, JSON.parse(process.argv[2] || '{}'));
const Y = 2027;
const TONES = { linen: ['#faf0e6', '#935927'], blush: ['#ffe7ef', '#ef90ab'], sky: ['#d7f2ff', '#0091d7'], arctic: ['#ffffff', '#1b1b1b'], breeze: ['#e0f2ec', '#50b694'], orchid: ['#f2eafb', '#b48fe0'], midnight: ['#ffffff', '#1b1b1b'], shea: ['#f1eae4', '#b18a70'], slate: ['#b1c0cd', '#4a6174'], dustyrose: ['#e7cbcb', '#d7a9a9'], afterdark: ['#2a2a2a', '#ffffff'] };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v * t + hex(b)[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
// colour slots are filled in once the customer's settings are known (see setTone)
let TN = 'breeze', G, MINT, FILL, SOFT, RULE, PALE, WHEEL, PAPER = '#ffffff', BASE = '#f4f4f3', INK = '#1e1e1e', GREY = '#9a9a9a', TABINK = '#1e1e1e', TABEDGE = '';
function setTone(t) {
  TN = TONES[t] ? t : 'breeze';
  const [light, line] = TONES[TN];
  G = line; MINT = light; FILL = mix(light, '#ffffff', .65); SOFT = mix(line, '#ffffff', .28); RULE = mix(line, '#ffffff', .2); PALE = mix(light, '#ffffff', .5); WHEEL = mix(line, '#ffffff', .5);
  PAPER = '#ffffff'; BASE = '#f4f4f3'; INK = '#1e1e1e'; GREY = '#9a9a9a'; TABINK = INK; TABEDGE = '';
  if (TN === 'arctic') { FILL = '#ffffff'; PALE = '#ffffff'; SOFT = '#c4c4c4'; RULE = '#d0d0d0'; WHEEL = '#9a9a9a'; TABEDGE = '#1b1b1b'; }
  if (TN === 'midnight') { MINT = '#1b1b1b'; TABINK = '#ffffff'; FILL = '#fafafa'; PALE = '#f4f4f4'; SOFT = '#d6d6d6'; RULE = '#d0d0d0'; WHEEL = '#9a9a9a'; }
  if (TN === 'afterdark') { PAPER = '#1b1b1b'; BASE = '#0e0e0e'; INK = '#f1f1f1'; GREY = '#a9a9a9'; TABINK = INK; MINT = '#2c2c2c'; FILL = '#232323'; PALE = '#262626'; SOFT = '#555555'; RULE = '#3a3a3a'; WHEEL = '#777777'; }
}
setTone(S.tone || 'breeze');

// ---------- customer data ----------
let DOCS = {}, SET = { from: 5, to: 23, step: 60, cur: '£', habits: [], dayLayout: 'd1', ws: 1 }, DAYX = {}, MENT = {}, ETC = {}, PAGES = [], STK = [];
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gp = (o, p) => p.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
const dk = k => DOCS[k] || {};
const L = (k, f) => { const v = gp(dk(k), f); return (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).filter(i => /^\d+$/.test(i)).sort((a, b) => a - b).map(i => v[i]) : []).filter(x => x && typeof x === 'object'); };
const LT = (k, f) => L(k, f).filter(x => String(x.t ?? '').trim());
const num = v => parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
const money = v => (v < 0 ? '-' : '') + SET.cur + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// text drawn into the printed slots
const tx = (s, x, y, w, cls = '', extra = '') => String(s ?? '').trim() ? `<div class="v ${cls}" style="left:${x}pt;top:${y}pt;width:${w}pt;${extra}">${E(s)}</div>` : '';
const para = (s, x, y, w, h, extra = '') => String(s ?? '').trim() ? `<div class="vp" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt;${extra}">${E(s)}</div>` : '';
const tick = (x, y, s) => `<svg class="svg" style="left:${x}pt;top:${y}pt;width:${s}pt;height:${s}pt" viewBox="0 0 10 10"><path d="M2 5.3l2.1 2.1L8.2 2.9" fill="none" stroke="${G}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const hm = t => String(Math.floor(t / 60)).padStart(2, '0') + String(t % 60).padStart(2, '0');
const lab12 = t => { const h = Math.floor(t / 60), m = t % 60; return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm'); };
const tm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
const FS = 'node_modules/@fontsource';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MS = MONTHS.map(x => x.slice(0, 3));
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYNAME = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ---------- dates (Monday start) ----------
const D = (y, m, d) => new Date(Date.UTC(y, m, d));
const add = (dt, n) => new Date(dt.getTime() + n * 864e5);
const dow = dt => (dt.getUTCDay() + 6) % 7;
const mondayOf = dt => add(dt, -dow(dt));
const key = dt => dt.toISOString().slice(0, 10).replace(/-/g, '');
function isoWeek(dt) { const t = add(dt, 3 - dow(dt)); return 1 + Math.round((t - mondayOf(D(t.getUTCFullYear(), 0, 4))) / 6048e5); }
// the app's week doc for a day (customers can start their week on Sunday; the printed layout is Monday first)
const appWeek = dt => { const off = (dt.getUTCDay() - (SET.ws === 0 ? 0 : 1) + 7) % 7; return { k: key(add(dt, -off)), i: off }; };
const hbDone = (hi, dt) => gp(dk('hb' + key(dt).slice(0, 6)), `g.h${hi}.d${dt.getUTCDate()}`) === true;
const HABITS = () => (SET.habits || []).filter(x => x && x.t);
// a list of tickable rows: box at (bx,by+i*step), text to the right
function rowsOut(items, n, x0, y0, step, w, boxOff = 0) {
  return items.slice(0, n).map((it, i) => { const y = y0 + i * step;
    return (it.c ? tick(x0 + boxOff, y + 1.4, 9) : '') + tx((it.pre || '') + it.t, x0 + 17, y + .6, w - 17, it.c ? 'done' : '') }).join('');
}

const MC = S.months.map(m => {
  const first = D(Y, m, 1), last = D(Y, m + 1, 0);
  const weeks = []; for (let w = mondayOf(first); w <= last; w = add(w, 7)) weeks.push(w);
  const from = m === 0 ? weeks[0] : first, to = m === 11 ? add(weeks[weeks.length - 1], 6) : last;
  const days = []; for (let x = from; x <= to; x = add(x, 1)) days.push(x);
  return { m, first, last, weeks, days };
});
const HAS = new Set(MC.flatMap(c => c.days.map(key)));
const HASM = new Set(MC.map(c => c.m));
const dayHref = dt => HAS.has(key(dt)) ? '#d' + key(dt) : null;
const wkId = (m, dt) => `w${m}_${key(mondayOf(dt))}`, rvId = (m, dt) => `r${m}_${key(mondayOf(dt))}`;
const mHref = (p, m) => HASM.has(m) ? `#${p}${m}` : null;
const A = (href, cls, style, inner = '') => href ? `<a class="${cls}" href="${href}" style="${style}">${inner}</a>` : `<div class="${cls}" style="${style}">${inner}</div>`;
const lbl = (t, x, y, extra = '') => `<div class="lbl" style="left:${x}pt;top:${y}pt;${extra}">${t}</div>`;
const box = (x, y, w, h, cls = '') => `<div class="bx ${cls}" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt"></div>`;
const grid = (x, y, w, h) => `<div class="ngrid" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt"></div>`;

// ---------- shared frame ----------
// Shapes + shadows are drawn once per state into one background image (keeps the PDF small); text and links stay vector on top.
function frameShapes(active) {
  let h = '<div class="marble"></div><div class="sheet"></div>';
  for (let i = 0; i < 10; i++) h += `<div class="ttab" style="left:${i * 58.9}pt"></div>`;
  h += `<div class="ipanel"></div>`;
  for (let i = 0; i < 13; i++) h += `<div class="stab${active !== null && i - 1 === active ? ' on' : ''}" style="top:${101 + i * 53.15}pt"></div>`;
  return h;
}
function frame(active = null) {
  let h = `<img class="fbg" src="assets/frame-${TN}-${active === null ? 'x' : active}.png">`;
  for (let i = 0; i < 10; i++) h += `<div class="ttab t" style="left:${i * 58.9}pt">${i + 1}</div>`;
  ['home', 'flag', 'projects', 'notebook', 'sticker'].forEach((n, i) =>
    h += A(n === 'home' ? '#index' : null, 'sicon', `top:${23 + i * 15.6}pt`, `<img src="assets/side-${n}.png">`));
  ['2027', ...MS].forEach((l, i) => {
    const href = i === 0 ? '#index' : mHref('mc', i - 1);
    h += A(href, 'stab t', `top:${101 + i * 53.15}pt`, `<span>${l}</span>`);
  });
  return h + '<div class="foot">© Live Love Planners</div>';
}
const page = (id, inner, active) => `<section class="page" id="${id}">${frame(active)}${inner}</section>`;
const h1 = t => `<div class="h1" style="top:41pt">${t}</div>`;

function micons(m) {
  return ['mc', 'db', 'fin', 'ref'].map((p, i) =>
    A(mHref(p, m), 'micon', `left:${[511, 530, 549.5, 565][i]}pt;width:${[18, 16.5, 13.5, 17.5][i]}pt`, `<img src="assets/micon${i}.png">`)).join('');
}
function switcher(p, m) {
  return MS.map((t, i) => A(mHref(p, i), 'msw' + (i === m ? ' on' : ''), `left:${215 + i * 23.37}pt`, t)).join('');
}
function star(cx, cy, size, n, on = false) {
  const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? .42 : 1, a = Math.PI / 5 * i - Math.PI / 2; pts.push(`${(Math.cos(a) * r * 100).toFixed(1)},${((Math.sin(a) * r + .08) * 100).toFixed(1)}`); }
  return `<svg class="svg" style="left:${cx - size / 2}pt;top:${cy - size / 2}pt;width:${size}pt;height:${size}pt" viewBox="-110 -110 220 220"><polygon points="${pts.join(' ')}" fill="${on ? SOFT : 'none'}" stroke="${G}" stroke-width="7" stroke-linejoin="round"/><text x="0" y="30" font-size="60" text-anchor="middle" fill="${on ? INK : GREY}" font-style="italic" font-family="Body">${n}</text></svg>`;
}
function sparkles(x, y, w, h) {
  const sp = (cx, cy, r) => `<path transform="translate(${cx} ${cy}) scale(${r})" d="M0-1Q.12-.12 1 0Q.12 .12 0 1Q-.12 .12-1 0Q-.12-.12 0-1Z" fill="${SOFT}"/>`;
  return `<svg class="svg" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt" viewBox="0 0 ${w} ${h}">${sp(w / 2, h / 2, 22)}${sp(w / 2 - 21, h / 2 - 16, 8)}${sp(w / 2 + 28, h / 2 - 2, 5.5)}${sp(w / 2 - 25, h / 2 + 22, 5)}${sp(w / 2 + 20, h / 2 + 19, 3)}</svg>`;
}
function table({ x, y, cols, heads = null, rows, rh = 14.3, hh = 16.4, total = 0, mintFirst = false, labels = null, center = true, data = [], totals = [], vals = [] }) {
  let t = `<table class="tb" style="left:${x}pt;top:${y}pt;width:${cols.reduce((a, b) => a + b)}pt"><colgroup>${cols.map(c => `<col style="width:${c}pt">`).join('')}</colgroup>`;
  if (heads) t += `<tr style="height:${hh}pt">${heads.map(hd => `<th>${hd}</th>`).join('')}</tr>`;
  for (let r = 0; r < rows; r++) t += `<tr style="height:${rh}pt">${cols.map((c, i) => `<td class="${mintFirst && i === 0 ? 'm' : ''}">${labels && i === 0 ? labels[r] : ''}${data[r] && data[r][i] != null ? `<span class="tv${i === 0 && !labels ? ' l' : ''}">${data[r][i]}</span>` : ''}${vals[r] != null && i === cols.length - 1 ? `<span class="tv">${vals[r]}</span>` : ''}</td>`).join('')}</tr>`;
  if (total) t += `<tr style="height:${hh}pt"><td colspan="${total}" class="tot">Total:</td>${cols.slice(total).map((_, i) => `<td>${totals[i] != null ? `<span class="tv">${totals[i]}</span>` : ''}</td>`).join('')}</tr>`;
  return t + '</table>';
}

function miniCal(c, top) {
  let h = `<div class="mc-title" style="top:${top}pt">${MONTHS[c.m]}</div>`;
  const cols = [423, 444, 464.5, 485, 506, 527, 548];
  'MTWTFSS'.split('').forEach((ch, i) => h += `<div class="mc-h" style="top:${top + 22}pt;left:${cols[i] - 8}pt">${ch}</div>`);
  c.weeks.forEach((w, r) => {
    const y = top + 42 + r * (c.weeks.length > 5 ? 16.4 : 19.7);
    h += A('#' + wkId(c.m, w), 'mc-w', `top:${y}pt`, 'W' + isoWeek(w));
    for (let i = 0; i < 7; i++) {
      const dt = add(w, i), inM = dt.getUTCMonth() === c.m;
      h += A(dayHref(dt), 'mc-d' + (inM ? '' : ' out'), `top:${y}pt;left:${cols[i] - 10}pt`, dt.getUTCDate());
    }
  });
  return h;
}

// ---------- INDEX ----------
function indexPage() {
  let h = h1('Index');
  h += `<div class="box" style="left:47pt;top:79pt;width:215pt;height:346pt"><div class="bh">2027</div>`;
  ['Yearly Planner', 'Monthly Goal Overview', 'At a glance', 'Important Dates', 'Year spread (Jan - Jun)', 'Year spread (Jul - Dec)', 'Year Reset', 'My Vision', 'Vision Board', 'My Finances', 'Life Goals', 'Memories']
    .forEach((t, i) => h += `<div class="li" style="top:${26 + i * 27.1}pt">${t}</div>`);
  h += `</div><div class="box" style="left:47pt;top:444pt;width:215pt;height:318pt"><div class="bh">Custom Sections</div>`;
  for (let i = 0; i < 10; i++) h += `<div class="cs" style="top:${31 + i * 28.7}pt">${i + 1}. ${E((PAGES[i] || {}).title || '')}</div>`;
  h += '</div>';
  h += `<div class="btn" style="top:79pt"><img src="assets/goals.png" style="height:21pt"> My Goals</div>`;
  h += `<div class="btn" style="top:123pt"><img src="assets/projects.png" style="height:21pt"> My Projects</div>`;
  h += `<div class="box" style="left:292pt;top:171pt;width:275pt;height:91pt"><div class="bh">Monthly Calendars</div>`;
  MS.forEach((t, i) => h += A(mHref('mc', i), 'mcal', `left:${(i % 4) * 68.7}pt;top:${26 + Math.floor(i / 4) * 23}pt`, t));
  h += '</div>';
  ['Finances', 'Lifestyle', 'Wellness', 'Health &amp; Fitness'].forEach((t, i) => {
    const x = 293 + i * 70;
    h += `<div class="cat" style="left:${x}pt"><img src="assets/cat${i}.png"></div><div class="catl" style="left:${x - 1.5}pt">${t}</div>`;
  });
  h += `<div class="box" style="left:292pt;top:391pt;width:275pt;height:371pt"><div class="bh">Notes</div></div>`;
  ['Lined', 'Lined w/ Cornell', 'Wide Ruled', 'Wide Ruled Cornell', 'Narrow Lined', 'Narrow Lined Cornell', 'Half Lined (L)', 'Half Lined (R)', 'Small Grid', 'Small Grid Cornell', 'Large Grid', 'Large Grid Cornell', 'Small Dot Grid', 'Small Dot Cornell', 'Large Dot Grid', 'Large Dot Grid Cornell', '12 Box Layout', '4 Box Layout', 'Checklist', 'Blank']
    .forEach((t, k) => {
      const x = [305, 372.5, 439.5, 507][k % 4], y = [422, 490.5, 559, 627, 695][Math.floor(k / 4)];
      h += `<div class="nthumb" style="left:${x - .5}pt;top:${y - .5}pt"><img src="assets/note${k}.png"><i></i></div><div class="npill" style="left:${x - 9}pt;top:${y + 34}pt">${t}</div>`;
    });
  return page('index', h);
}

// ---------- MONTH CALENDAR ----------
function monthCal(c) {
  const mk_ = 'm' + (c.m + 1), md = dk(mk_), ent = MENT[c.m] || {};
  let h = h1(MONTHS[c.m]) + micons(c.m);
  DAYNAME.forEach((n, i) => h += `<div class="dh" style="left:${62.2 + i * 72}pt">${n}</div>`);
  const top = 108, H = 469.3, n = c.weeks.length, rh = H / n;
  h += `<div class="cal" style="top:${top}pt;height:${H}pt"></div>`;
  c.weeks.forEach((w, r) => {
    const y = top + r * rh;
    if (r) h += `<div class="calh" style="top:${y}pt"></div>`;
    h += A('#' + wkId(c.m, w), 'calw', `top:${y}pt;height:${rh}pt`, `<span>Week ${isoWeek(w)}</span>`);
    for (let i = 0; i < 7; i++) {
      const dt = add(w, i), inM = dt.getUTCMonth() === c.m, href = dayHref(dt);
      const show = inM || href, es = show ? (ent[key(dt)] || []) : [], cap = Math.max(1, Math.floor((rh - 16) / 9.4));
      const items = es.slice(0, es.length > cap ? cap - 1 : cap).map(e => `<span class="ce${e.done ? ' done' : ''}"><i style="background:${String(ETC[e.y] || G).startsWith('var') ? G : ETC[e.y] || G}"></i>${E(e.t)}</span>`).join('') + (es.length > cap ? `<span class="ce more">+${es.length - cap + 1} more</span>` : '');
      h += A(show ? href : null, 'calc', `left:${62.2 + i * 72}pt;top:${y}pt;height:${rh}pt`, show ? `<b class="${inM ? '' : 'out'}">${dt.getUTCDate()}</b>${items ? `<span class="ces">${items}</span>` : ''}` : '');
    }
  });
  for (let i = 1; i < 7; i++) h += `<div class="calv" style="left:${62.2 + i * 72}pt;top:${top}pt;height:${H}pt"></div>`;
  h += lbl('This month’s focus:', 47, 595) + box(47.8, 614.6, 132.8, 57, 'mint') + para(md.focus, 51, 617, 125, 51);
  h += lbl('Top Priorities this month:', 47, 684.5);
  const pri = L(mk_, 'pri');
  [1, 2, 3].forEach((k, i) => { const p = pri[i] || {}; h += `<div class="pri2" style="top:${708 + i * 15.3}pt">${k}.</div>` + tx(p.t, 61, 708 + i * 15.3 - 1, 118, p.c ? 'done' : ''); });
  const goals = LT(mk_, 'goals');
  h += lbl(goals.length ? 'Goals this month:' : 'To do:', 195.7, 595);
  for (let i = 0; i < 9; i++) h += `<div class="todo" style="left:196pt;width:141pt;top:${617.9 + i * 15}pt"></div>`;
  h += rowsOut(goals, 9, 196, 617.9, 15, 141, 3.5);
  const dates = LT(mk_, 'dates').map(x => (x.d ? x.d + '  ' : '') + x.t);
  h += grid(354, 601.5, 212, 146.5) + para([md.notes, dates.length ? 'Important dates\n' + dates.join('\n') : ''].filter(Boolean).join('\n\n'), 359, 605, 202, 139, 'line-height:14.4pt');
  return page('mc' + c.m, h, c.m);
}

// ---------- DASHBOARD ----------
function dashboard(c) {
  const mk_ = 'm' + (c.m + 1), md = dk(mk_);
  let h = h1(MONTHS[c.m] + ' Dashboard') + switcher('db', c.m) + micons(c.m);
  h += lbl("This month's focus", 47, 80) + box(47, 100, 251.5, 49, 'mint') + para(md.focus, 51, 103, 243, 43);
  const circ = (y, n, items) => { let s = ''; for (let i = 0; i < n; i++) { const it = items[i]; s += `<div class="crow" style="top:${y + i * 15.3}pt"><i></i></div>` + (it ? (it.c ? tick(48.2, y + i * 15.3 + 1.2, 9.4) : '') + tx(it.t, 64, y + i * 15.3 - .5, 232, it.c ? 'done' : '') : ''); } return s; };
  h += lbl('Goals I want to achieve this month', 47, 160) + circ(177.3, 5, LT(mk_, 'goals'));
  h += lbl('Top projects this month', 47, 264) + circ(282, 5, []);
  h += lbl('To do', 47, 367.7) + `<div class="sub" style="left:104pt;width:80pt;top:387pt">Action steps</div><div class="sub" style="left:238pt;width:60pt;top:387pt">Date:</div>`;
  for (let i = 0; i < 15; i++) h += `<div class="crow td" style="top:${393.3 + i * 15.9}pt"><i></i><u></u></div>`;
  h += lbl('Important dates / events', 328, 80);
  const dates = LT(mk_, 'dates');
  for (let i = 0; i < 13; i++) { const dd = dates[i]; h += `<div class="idate" style="top:${100.8 + i * 16}pt">${i < 12 && !dd ? '<i>/</i>' : ''}</div>` + (dd ? tx(dd.d, 328, 100.8 + i * 16 + 2, 57.5, 'c') + tx(dd.t, 403, 100.8 + i * 16 + 2, 147) : ''); }
  h += lbl('Habit Trackers', 328, 316);
  const hs = HABITS();
  [334.5, 439.2, 543.9].forEach((y, hi) => {
    h += `<div class="ht"><div class="hth" style="top:${y}pt"></div></div>` + (hs[hi] ? tx(hs[hi].t, 328, y + 3, 221, 'c') : '');
    let t = `<table class="tb hab" style="left:328pt;top:${y + 17}pt;width:221pt">`;
    for (let r = 0; r < 4; r++) { t += '<tr style="height:17.3pt">'; for (let k = 0; k < 8; k++) { const n = r * 8 + k + 1, ok = hs[hi] && n <= c.last.getUTCDate() && hbDone(hi, D(Y, c.m, n)); t += `<td class="${ok ? 'on' : ''}">${n <= 31 ? n : ''}</td>`; } t += '</tr>'; }
    h += t + '</table>';
  });
  h += lbl('Notes', 47, 641.3) + grid(47, 660.4, 504.8, 84.5);
  return page('db' + c.m, h, c.m);
}

// ---------- FINANCES ----------
function finances(c) {
  const k = 'money' + (c.m + 1), d = dk(k), sum = f => L(k, f).reduce((a, r) => a + num(r.amt), 0);
  const inc = sum('inc'), bills = sum('bills'), spend = sum('spend'), sav = sum('save');
  const any = L(k, 'inc').length + L(k, 'bills').length + L(k, 'spend').length + L(k, 'save').length > 0;
  const m = v => String(v ?? '').trim() ? (num(v) || num(v) === 0 && /\d/.test(v) ? money(num(v)) : E(v)) : '';
  let h = h1(MONTHS[c.m] + ' Finances') + switcher('fin', c.m) + micons(c.m);
  h += lbl('Financial Goal this month', 47, 77.8) + box(47, 95, 249, 56, 'sh') + para(d.goal, 51, 98, 241, 50);
  const rows = (f, map) => L(k, f).filter(r => Object.values(r).some(v => String(v ?? '').trim() && v !== false)).map(map);
  const tk = '<b class="tick">&#10003;</b>';
  h += table({ x: 47, y: 171.5, cols: [144, 52.35, 52.35], heads: ['Income', 'Expected', 'Amount'], rows: 4, rh: 14.4, total: 1, data: rows('inc', r => [E(r.src), m(r.exp), m(r.amt)]), totals: any ? [money(L(k, 'inc').reduce((a, r) => a + num(r.exp), 0)), money(inc)] : [] });
  h += table({ x: 47, y: 275.6, cols: [142, 42.5, 44.5, 18.3], heads: ['Bills', 'Due', 'Amount', '&#10003;'], rows: 13, rh: 14.3, total: 2, data: rows('bills', r => [E(r.name), E(r.due), m(r.amt), r.paid ? tk : '']), totals: any ? [money(bills)] : [] });
  h += table({ x: 47, y: 511.8, cols: [144, 52.35, 52.35], heads: ['Expenses', 'Date', 'Amount'], rows: 14, rh: 14.45, total: 2, data: rows('spend', r => [E(r.what), E(r.date), m(r.amt)]), totals: any ? [money(spend)] : [] });
  h += lbl('Monthly Overview', 322.7, 77.8);
  h += table({ x: 322.7, y: 94.9, cols: [148.6, 93.7], rows: 4, rh: 17.2, mintFirst: true, labels: ['Opening Balance:', 'Total Income (+) :', 'Total Expenses (-) :', 'Closing Balance:'], vals: any ? [null, money(inc), money(bills + spend), money(inc - bills - spend)] : [] });
  h += table({ x: 322.7, y: 182.6, cols: [148.6, 47.1, 46.6], heads: ['Sinking Funds', 'Date', 'Amount'], rows: 13, rh: 14.2, hh: 14.5, total: 2 });
  h += table({ x: 322.7, y: 418.9, cols: [148.6, 47.1, 46.6], heads: ['Savings / Investments', 'Date', 'Amount'], rows: 5, rh: 14.2, hh: 14.5, total: 2, data: rows('save', r => [E(r.goal), '', m(r.amt)]), totals: any ? [money(sav)] : [] });
  h += table({ x: 322.7, y: 540, cols: [148.6, 47.1, 46.6], heads: ['Debt Payments', 'Date', 'Amount'], rows: 6, rh: 14.2, hh: 14.5, total: 2 });
  h += lbl('Notes', 322.7, 668.8) + box(322.7, 684.6, 242.3, 62.2);
  return page('fin' + c.m, h, c.m);
}

// ---------- REFLECTION ----------
function wheel() {
  const cx = 204.2, cy = 504.6, R = 110, pt = (r, a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)].map(v => v.toFixed(2));
  let s = `<svg class="svg" style="left:0;top:0;width:612pt;height:792pt" viewBox="0 0 612 792"><defs>`;
  const areas = ['Personal Growth', 'Health &amp; Fitness', 'Finances', 'Family &amp; Friends', 'Relationships', 'Fun / Social', 'Career / Business', 'Spiritual'];
  const cw = [1, 1, 0, 0, 0, 0, 1, 1];
  areas.forEach((t, i) => {
    const a0 = i * 45 + 2, a1 = i * 45 + 43;
    if (cw[i]) { const r = 115, p0 = pt(r, a0), p1 = pt(r, a1); s += `<path id="ap${i}" d="M${p0} A${r} ${r} 0 0 1 ${p1}"/>`; }
    else { const r = 122, p0 = pt(r, a1), p1 = pt(r, a0); s += `<path id="ap${i}" d="M${p0} A${r} ${r} 0 0 0 ${p1}"/>`; }
  });
  s += '</defs>';
  for (let k = 1; k <= 10; k++) s += `<circle cx="${cx}" cy="${cy}" r="${k * 11}" fill="none" stroke="${WHEEL}" stroke-width=".7"/>`;
  for (let a = 0; a < 360; a += 45) { const p = pt(R, a); s += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="${WHEEL}" stroke-width=".7"/>`; }
  for (let k = 1; k <= 10; k++) s += `<text x="${(cx + k * 11 - 5.5).toFixed(1)}" y="${cy + 2.4}" font-size="6.6" text-anchor="middle" fill="${GREY}" font-style="italic" font-family="Body">${k}</text>`;
  areas.forEach((t, i) => s += `<text font-size="9.6" font-family="Body" fill="${INK}"><textPath href="#ap${i}" startOffset="50%" text-anchor="middle">${t}</textPath></text>`);
  return s + '</svg>';
}
function reflection(c) {
  let h = h1(MONTHS[c.m] + ' Reflection') + switcher('ref', c.m) + micons(c.m);
  h += lbl('How would I rate this month:', 47, 81);
  for (let i = 0; i < 10; i++) h += star(216 + i * 37.3, 87, 22, i + 1);
  h += lbl('Highlights this month:', 47, 107.2);
  [47, 227, 407].forEach(x => h += box(x, 125.7, 157.7, 78.5, 'rnd') + sparkles(x, 125.7, 157.7, 78.5));
  h += lbl('Biggest challenges this month:', 47, 217.2) + lbl('Lessons learnt this month:', 314.8, 217.2);
  for (let i = 0; i < 5; i++) h += `<div class="ln" style="left:47pt;width:247.5pt;top:${242.2 + i * 15.5}pt"></div><div class="ln" style="left:314.8pt;width:248.2pt;top:${242.2 + i * 15.5}pt"></div>`;
  h += lbl('Areas of my life', 47, 317.3);
  h += `<div class="instr">Use this Level 10 life wheel to assess and improve 8 areas of your life. Color code each area of your life and give it a score from 1-10 for the entire month.</div>`;
  h += wheel();
  h += lbl('Color', 371, 416.8, 'width:25.7pt;text-align:center') + lbl('Area', 412.4, 416.8, 'width:107.3pt;text-align:center') + lbl('Score', 538.7, 416.8, 'width:25pt;text-align:center');
  ['Personal Growth', 'Health &amp; Fitness', 'Finances', 'Family &amp; Friends', 'Relationships', 'Fun / Social', 'Career / Business', 'Spiritual'].forEach((t, i) => {
    const y = 439.9 + i * 19.96;
    h += `<div class="lw" style="left:371pt;width:25.7pt;top:${y}pt"></div><div class="lw a" style="left:412.4pt;width:107.3pt;top:${y}pt">${t}</div><div class="lw" style="left:538.7pt;width:24.9pt;top:${y}pt"></div>`;
  });
  h += lbl('Intentions next month:', 47, 657.7);
  ['to start', 'to continue', 'to stop'].forEach((t, i) => { const x = [47, 227, 407][i]; h += box(x, 677.5, 157.7, 66.7, 'rnd') + `<div class="script" style="left:${x}pt;top:677.5pt">${t}</div>`; });
  return page('ref' + c.m, h, c.m);
}

// ---------- WEEKLY + REVIEW ----------
function weekly(c, w) {
  const wk = appWeek(w), K = 'w' + wk.k;
  let h = h1(MONTHS[c.m]);
  h += A('#' + rvId(c.m, w), 'pill', 'left:450pt;top:46.5pt;width:70pt', 'Weekly Review');
  h += `<div class="pill" style="left:527pt;top:47pt;width:46pt">Week ${isoWeek(w)}</div>`;
  for (let i = 0; i < 7; i++) {
    const dt = add(w, i), y = 77 + i * 96.9, inM = dt.getUTCMonth() === c.m, aw = appWeek(dt);
    h += `<div class="wline" style="top:${y}pt"></div>` + A(dayHref(dt), 'wday', `top:${y + 5}pt`, `${DOW[i]}<b class="${inM ? '' : 'out'}">${dt.getUTCDate()}</b>`);
    h += para(gp(dk('w' + aw.k), 'days.d' + aw.i), 90, y + 5, 258, 88, 'line-height:12pt');
  }
  h += `<div class="wline g" style="top:${77 + 7 * 96.9}pt"></div>`;
  h += lbl('Priorities this week', 374, 72);
  const pri = L(K, 'pri');
  [1, 2, 3].forEach((n, i) => h += `<div class="pri" style="left:374pt;width:191pt;top:${94 + i * 17.3}pt">${n}.</div>` + tx((pri[i] || {}).t, 389, 94 + i * 17.3 + 2, 175, (pri[i] || {}).c ? 'done' : ''));
  h += lbl('To do', 374, 155);
  for (let i = 0; i < 14; i++) h += `<div class="todo big" style="left:374pt;width:191pt;top:${175 + i * 15.4}pt"></div>`;
  h += rowsOut(LT(K, 'todo'), 14, 374, 175.5, 15.4, 191, 1.4);
  h += lbl('Habit Tracker', 374, 403);
  'MTWTFSS'.split('').forEach((ch, i) => h += `<div class="ht-h" style="left:${478 + i * 12.4}pt">${ch}</div>`);
  const hs = HABITS();
  for (let r = 0; r < 5; r++) {
    h += `<div class="ht-line" style="top:${428 + r * 14.1}pt"></div>` + (hs[r] ? tx(hs[r].t, 374, 417.5 + r * 14.1, 96, 'sm') : '');
    for (let i = 0; i < 7; i++) h += `<div class="ht-b" style="left:${478 + i * 12.4}pt;top:${418.5 + r * 14.1}pt"></div>` + (hs[r] && hbDone(r, add(w, i)) ? tick(478 + i * 12.4 + .3, 418.5 + r * 14.1 + .3, 9) : '');
  }
  const rem = LT(K, 'rem').map(r => `${DOW[(+(r.day || 0) + (SET.ws === 0 ? 6 : 0)) % 7]}${tm(r.time) != null ? ' ' + lab12(tm(r.time)) : ''}  ${r.t}`);
  h += lbl('Notes', 374, 499) + grid(372, 518, 192, 89.5) + para(rem.length ? 'Reminders\n' + rem.join('\n') : '', 377, 520.5, 183, 85, 'line-height:14.4pt');
  return page(wkId(c.m, w), h + miniCal(c, 626));
}

function review(c, w) {
  const K = 'w' + appWeek(w).k, rv = gp(dk(K), 'rv') || {};
  let h = h1('Weekly Review');
  h += A('#' + wkId(c.m, w), 'pill', 'left:463.4pt;top:47.8pt;width:58.3pt', '&#9666; Back to Week');
  h += `<div class="pill" style="left:527.6pt;top:47.8pt;width:45pt">Week ${isoWeek(w)}</div>`;
  h += lbl('Focus this week:', 47, 81) + box(47, 98.2, 244.3, 43.2, 'mint') + para(rv.focus, 51, 100.5, 236, 24);
  h += `<div class="acc">Accomplished?</div><div class="ht-b" style="left:272.3pt;top:127pt;width:9.8pt;height:9.8pt"></div>` + (rv.acc ? tick(272.4, 127.1, 9.6) : '');
  h += lbl("This week's rating:", 314.8, 81);
  for (let i = 0; i < 5; i++) h += star(335.8 + i * 54, 119.8, 29.5, i + 1, i < +(rv.rating || 0));
  h += lbl('How was my week?', 47, 154.4) + box(47, 172.8, 513.3, 28.8, 'sh') + para(rv.how, 51, 175, 505, 24);
  h += lbl('Productivity level this week', 47, 219.2);
  h += `<div class="prod">${[20, 40, 60, 80, 100].map(p => `<span class="${+rv.prod === p ? 'on' : ''}">${p}%</span>`).join('')}</div>`;
  h += lbl('My biggest <b>accomplishments</b> this week', 47, 268.3) + box(47, 289.3, 244.3, 81.8, 'mint') + para(rv.wins, 51, 292, 236, 76);
  h += lbl('My biggest <b>challenges</b> this week', 316.1, 268.3) + box(316.1, 289.3, 244.2, 81.8) + para(rv.chal, 320, 292, 236, 76);
  h += lbl("Things <b>I've learnt</b> this week...", 47, 385.4) + box(47, 406.5, 244.3, 81.1) + para(rv.learnt, 51, 409, 236, 76);
  h += lbl('Things <b>to improve</b> on next week...', 316.1, 385.4) + box(316.1, 406.5, 244.2, 81.1, 'mint') + para(rv.improve, 320, 409, 236, 76);
  h += lbl('Main Priorities next week', 47, 504.5);
  const nx = L(K, 'rv.next');
  [1, 2, 3].forEach((n, i) => h += `<div class="nrow" style="top:${524 + i * 17}pt"><i>${n}</i></div>` + tx((nx[i] || {}).t, 64, 524 + i * 17, 226, (nx[i] || {}).c ? 'done' : ''));
  h += lbl("Next week's action plan:", 47, 588.3);
  for (let i = 0; i < 10; i++) h += `<div class="todo" style="left:44pt;width:248pt;top:${603.5 + i * 14.7}pt"></div>`;
  h += lbl('Notes', 316.1, 506.5) + grid(316.1, 528.2, 244.2, 219.3);
  return page(rvId(c.m, w), h);
}

// ---------- DAILY ----------
function daily(c, dt) {
  const k = key(dt), K = 'd' + k, dd = dk(K), d2 = SET.dayLayout === 'd2', x = DAYX[k] || { rc: [], bd: [] };
  let h = h1(`${DAYNAME[dow(dt)]}, ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`);
  h += `<a class="clip" href="shortcuts://run-shortcut?name=LiveLovePlanners&amp;input=text&amp;text=${k}"><img src="assets/clipboard.png"></a>`;
  h += A('#' + wkId(c.m, dt), 'pill', 'left:514pt;top:53pt;width:56pt', 'Week ' + isoWeek(dt));
  h += lbl(d2 ? 'Intention for the day' : "Today's focus", 47, 79) + `<div class="focus"></div>` + para(dd.focus, 51, 100.5, 291, 31) + lbl('Schedule', 47, 150);
  const step = (SET.to - SET.from > 12) ? 60 : (+SET.step || 60);
  const rows = []; for (let t = SET.from * 60; t < SET.to * 60; t += step) rows.push(t);
  const top = 169.5, rh = (752.6 - top) / rows.length;
  rows.forEach((t, i) => {
    const y = top + i * rh, e = t + step, p = n => String(n).padStart(2, '0'), hr = Math.floor(t / 60), mn = t % 60;
    const lab = (hr % 12 || 12) + (mn ? ':' + p(mn) : '') + (hr < 12 ? ' am' : ' pm');
    const gc = `https://calendar.google.com/calendar/u/0/r/eventedit?action=TEMPLATE&amp;dates=${k}T${p(hr)}${p(mn)}00/${k}T${p(Math.floor(e / 60))}${p(e % 60)}00`;
    const v = gp(dd, 'sched.t' + hm(t)), dn = gp(dd, 'schedc.t' + hm(t)) === true;
    h += `<div class="srow" style="top:${y}pt;height:${rh}pt">${step === 60 ? '<i></i>' : ''}</div><a class="hour${step === 60 ? '' : ' sm'}" href="${gc}" style="top:${y}pt;height:${rh}pt">${lab}</a>`;
    h += tx(v, 91, y + (step === 60 ? rh / 2 - 12.5 : (rh - 11) / 2), 252, dn ? 'done' : '');
  });
  h += `<div class="srow" style="top:752.6pt;height:0"></div><div class="svl" style="top:${top}pt;height:${752.6 - top}pt"></div>`;
  h += lbl(d2 ? 'Absolutely must get done' : 'Top 3 priorities', 375, 79);
  const pri = L(K, 'pri');
  [1, 2, 3].forEach((n, i) => h += `<div class="pri" style="left:375pt;width:187pt;top:${99.5 + i * 16.9}pt">${n}.</div>` + tx((pri[i] || {}).t, 390, 99.5 + i * 16.9 + 1.8, 171, (pri[i] || {}).c ? 'done' : ''));
  const rc = x.rc.map(r => ({ t: r.t, c: r.done, pre: '↻ ' + (tm(r.time) != null ? lab12(tm(r.time)) + ' ' : '') }));
  const bd = a => x.bd.filter(b => a === 'all' || b.a === a).map(b => ({ t: b.t, c: b.done }));
  const mine = f => LT(K, f).map(r => ({ t: r.t, c: !!r.c }));
  h += lbl(d2 ? 'To do' : 'Personal To do', 375, 160);
  for (let i = 0; i < 12; i++) h += `<div class="todo" style="left:375pt;width:187pt;top:${178 + i * 13.15}pt"></div>`;
  h += rowsOut(d2 ? [...rc, ...bd('all'), ...mine('ptodo')] : [...rc, ...bd('personal'), ...mine('ptodo')], 12, 375, 178.2, 13.15, 187, 4.2);
  if (!d2) {
    h += lbl('Work To do', 375, 345.5);
    for (let i = 0; i < 12; i++) h += `<div class="todo" style="left:375pt;width:187pt;top:${361.5 + i * 13.15}pt"></div>`;
    h += rowsOut([...bd('work'), ...mine('wtodo')], 12, 375, 361.7, 13.15, 187, 4.2);
  } else {
    const aw = appWeek(dt), meals = dk('meals' + aw.k), wl = dk('wellness' + (dt.getUTCMonth() + 1)), wd = 'days.d' + dt.getUTCDate();
    const water = +gp(wl, wd + '.water') || 0;
    const kv = (label, val, y, done) => `<div class="kv" style="top:${y}pt"><span>${label}</span></div>` + tx(val, 432, y + .5, 130, done ? 'done' : '');
    h += lbl('Meals', 375, 345.5);
    [['b', 'Breakfast'], ['l', 'Lunch'], ['d', 'Dinner'], ['s', 'Snacks']].forEach(([f, n], i) => h += kv(n, gp(meals, `days.d${aw.i}.${f}`), 363 + i * 15));
    h += lbl('Wellbeing', 375, 428);
    h += `<div class="kv" style="top:446pt"><span>Water</span></div>` + Array.from({ length: 8 }, (_, j) => `<div class="drop${j < water ? ' on' : ''}" style="left:${433 + j * 16}pt;top:446pt"></div>`).join('');
    const mv = [gp(dd, 'move.t'), gp(dd, 'move.mins') ? gp(dd, 'move.mins') + ' mins' : ''].filter(Boolean).join(', ');
    h += kv('Movement', mv, 462) + kv('Grateful for', gp(dd, 'grat'), 477) + kv('Just for me', gp(dd, 'care.t'), 492, gp(dd, 'care.c'));
    const mood = gp(wl, wd + '.mood'); if (mood) h += kv('Mood', mood, 507);
  }
  const rem = LT(K, 'rem').map(r => (tm(r.time) != null ? lab12(tm(r.time)) + '  ' : '') + r.t);
  h += lbl('Notes', 375, 526.5) + grid(375.5, 546, 187.5, 70) + para([dd.notes, rem.length ? 'Reminders: ' + rem.join(', ') : ''].filter(Boolean).join('\n'), 379, 548, 180, 66, 'line-height:14.4pt');
  return page('d' + k, h + miniCal(c, 626));
}

// ---------- CSS ----------
const cssFn = () => `
@font-face{font-family:Body;font-weight:400;src:url(${FS}/figtree/files/figtree-latin-400-normal.woff2)}
@font-face{font-family:Body;font-weight:500;src:url(${FS}/figtree/files/figtree-latin-500-normal.woff2)}
@font-face{font-family:Body;font-weight:700;src:url(${FS}/figtree/files/figtree-latin-700-normal.woff2)}
@font-face{font-family:Body;font-weight:400;font-style:italic;src:url(${FS}/figtree/files/figtree-latin-400-italic.woff2)}
@font-face{font-family:Head;src:url(${FS}/forum/files/forum-latin-400-normal.woff2)}
@font-face{font-family:Script;src:url(${FS}/dancing-script/files/dancing-script-latin-400-normal.woff2)}
@page{size:612pt 792pt;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Body;color:${INK};-webkit-print-color-adjust:exact;print-color-adjust:exact}
a{color:inherit;text-decoration:none}
.page{position:relative;width:612pt;height:792pt;overflow:hidden;page-break-after:always;background:${BASE}}
.page>*{position:absolute}
.marble{left:588pt;top:0;width:24pt;height:21pt;background:url(assets/marble.png) center/cover}
.sheet{left:0;top:21pt;width:588.5pt;height:771pt;background:${PAPER};box-shadow:1.5pt 0 2pt rgba(0,0,0,.22),0 -1pt 2pt rgba(0,0,0,.15)}
.ttab{top:0;width:62pt;height:21pt;background:${MINT};border-top-right-radius:5pt;box-shadow:inset -1pt -1.5pt 1.5pt rgba(0,0,0,.18),1pt 0 1.5pt rgba(0,0,0,.18);font-size:9.5pt;line-height:20pt;text-align:center;padding-right:6pt;color:${TABINK};${TABEDGE ? `border:.75pt solid ${TABEDGE};border-left:0;border-bottom:0` : ''}}
.ipanel{left:588.5pt;top:21pt;width:22pt;height:84pt;background:${PAPER};border-radius:0 5pt 0 0;clip-path:polygon(0 0,100% 0,100% 88%,0 100%);box-shadow:1pt 1pt 2pt rgba(0,0,0,.2)}
.sicon{left:592.5pt;width:18pt;height:16pt}.sicon img{width:18pt;height:16pt;display:block}
.stab{left:588.5pt;width:23pt;height:52pt;background:${MINT};border-bottom-right-radius:5pt;${TABEDGE ? `border:.75pt solid ${TABEDGE};border-left:0;` : ''}box-shadow:inset 1.5pt 0 2pt rgba(0,0,0,.16),0 1pt 1.5pt rgba(0,0,0,.2)}
.stab.on{background:${PAPER};box-shadow:1pt 1pt 2pt rgba(0,0,0,.22);z-index:2}
.fbg{left:0;top:0;width:612pt;height:792pt}
.t{background:none!important;box-shadow:none!important}
.stab span{color:${TABINK};position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg);font-size:9.5pt;white-space:nowrap}
.foot{left:0;width:612pt;top:774pt;text-align:center;font-size:7pt;font-style:italic;color:#b4b4b4}
.h1{left:47pt;font-family:Head;font-size:19.5pt;letter-spacing:.2pt;white-space:nowrap}
.lbl{font-size:9.6pt;white-space:nowrap}.lbl b{font-weight:700}
.svg{position:absolute;overflow:visible}
.bx{border:.75pt solid ${G}}.bx.mint{background:${FILL}}.bx.sh{box-shadow:.6pt .6pt 0 ${G}}.bx.rnd{border-radius:8pt}
.micon{top:44pt;height:18pt}.micon img{width:100%;height:18pt;display:block}
.msw{top:51pt;width:22pt;text-align:center;font-size:8.6pt;color:#c4c4c4}.msw.on{color:${INK};font-weight:700}
.box{position:absolute;border:.75pt solid ${G}}.box>*{position:absolute}
.bh{left:0;right:0;top:0;height:22.5pt;background:${FILL};border-bottom:.75pt solid ${G};text-align:center;font-weight:500;font-size:9.6pt;line-height:22pt}
.li{left:0;right:0;text-align:center;font-size:9.6pt;line-height:14pt}
.cs{left:9pt;width:197pt;height:20pt;background:${PALE};border:.6pt solid ${G};box-shadow:inset -1.2pt -1.2pt 0 ${G};font-size:9.6pt;line-height:19pt;padding-left:6pt}
.btn{left:292pt;width:275pt;height:30pt;border:.75pt solid ${G};border-radius:7pt;display:flex;align-items:center;justify-content:center;gap:5pt;font-size:9.6pt}
.mcal{width:68.7pt;text-align:center;font-size:9.6pt;line-height:14pt}
.cat{top:282pt;width:61pt;height:61pt;border:.9pt solid ${G};border-radius:7pt;overflow:hidden;display:flex;align-items:center;justify-content:center}.cat img{width:54pt;height:53pt}
.catl{top:351pt;width:64pt;height:23pt;border:.75pt solid ${G};border-radius:4pt;font-size:8.6pt;display:flex;align-items:center;justify-content:center;text-align:center;line-height:9pt}
.nthumb{width:51pt;height:29pt;overflow:hidden;isolation:isolate}.nthumb img{width:51pt;height:29pt;display:block;filter:grayscale(1) contrast(3)}.nthumb i{position:absolute;inset:0;background:${G};mix-blend-mode:lighten}
.npill{width:69pt;height:24pt;border:.75pt solid ${G};border-radius:10pt;font-size:7.6pt;line-height:8pt;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 3pt}
.pill{height:13.5pt;border:.75pt solid ${G};border-radius:7pt;font-size:7.6pt;font-weight:500;text-align:center;line-height:12.5pt;white-space:nowrap}
.clip{left:487pt;top:49pt;width:20pt;height:19pt}.clip img{width:20pt;height:19pt;display:block}
.focus{left:47pt;top:98pt;width:299pt;height:35.5pt;background:${FILL};border:.75pt solid ${G}}
.srow{left:47pt;width:299pt;border-top:.75pt solid ${G}}.srow i{position:absolute;left:41pt;right:0;top:50%;border-top:.75pt dotted #c9c9c9}
.svl{left:86pt;border-left:.75pt solid ${G}}
.hour{left:47pt;width:39pt;display:flex;align-items:center;justify-content:center;font-size:9.4pt}.hour.sm{font-size:7.8pt}
.pri{height:16pt;border-bottom:.75pt solid ${G};font-size:9.6pt;line-height:15pt;padding-left:6pt}
.pri2{left:47pt;width:134pt;height:13pt;font-size:9.6pt;line-height:13pt}.pri2::after{content:'';position:absolute;left:12.6pt;right:0;bottom:1pt;border-bottom:.75pt solid ${G}}
.todo{height:13.15pt}
.todo::before{content:'';position:absolute;left:4pt;top:2.5pt;width:8pt;height:8pt;border:.75pt solid ${G}}
.todo::after{content:'';position:absolute;left:17pt;right:0;bottom:1pt;border-bottom:.75pt solid ${G}}
.todo.big::before{width:10pt;height:10pt;left:1pt;top:2pt}.todo.big::after{left:17pt;bottom:0}
.ngrid{border:.9pt solid ${G};border-radius:4pt;background-image:linear-gradient(${RULE} .6pt,transparent .6pt),linear-gradient(90deg,${RULE} .6pt,transparent .6pt);background-size:14.4pt 14.4pt;background-position:-1pt -1pt}
.wline{left:47pt;width:304pt;border-top:.6pt solid #8a8a8a}.wline.g{border-top:1.2pt solid ${G}}
.wday{left:52pt;width:30pt;font-size:9.6pt;line-height:11pt;text-align:center}
.wday b{display:block;font-weight:400;font-family:Head;font-size:13pt;line-height:13pt}.wday b.out{color:#b3b3b3}
.ht-h{top:405pt;width:10pt;text-align:center;font-size:9.6pt}
.ht-b{width:9.5pt;height:9.5pt;border:.75pt solid ${G}}
.ht-line{left:374pt;width:96pt;border-top:.75pt solid ${G}}
.mc-title{left:415pt;width:140pt;text-align:center;font-weight:500;font-size:9.6pt}
.mc-h{width:16pt;text-align:center;font-size:9.6pt}
.mc-w{left:386pt;width:22pt;text-align:center;font-size:8.6pt;font-style:italic;color:${WHEEL};line-height:14pt}
.mc-d{width:20pt;text-align:center;font-size:9.6pt;line-height:14pt}.mc-d.out{color:#b3b3b3}
.dh{top:89pt;width:72pt;text-align:center;font-size:9.6pt}
.cal{left:47.8pt;width:518.4pt;border:.9pt solid ${G}}
.calh{left:47.8pt;width:518.4pt;border-top:.75pt solid ${G}}
.calv{border-left:.6pt solid #8a8a8a}
.calw{left:47.8pt;width:14.4pt;background:${FILL};border-right:.75pt solid ${G};border-top:.75pt solid ${G};margin-top:-.75pt}
.calw span{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-90deg);font-size:9.4pt;white-space:nowrap}
.calc{width:72pt}.calc b{position:absolute;right:4.5pt;top:3pt;font-weight:400;font-size:9.6pt}.calc b.out{color:#b3b3b3}
.crow{left:47pt;width:251.5pt;height:12pt}
.crow i{position:absolute;left:0;top:0;width:11.8pt;height:11.8pt;border:.75pt solid ${G};border-radius:50%}
.crow::after{content:'';position:absolute;left:16.5pt;right:0;top:11pt;border-top:.75pt solid ${G}}
.crow.td::after{right:75.5pt}.crow.td u{position:absolute;left:191pt;right:0;top:11pt;border-top:.75pt solid ${G}}
.sub{font-size:7.4pt;font-style:italic;color:${GREY};text-align:center}
.idate{left:328pt;width:222pt;height:16pt}
.idate::before{content:'';position:absolute;left:0;width:57.5pt;top:0;border-top:.75pt solid ${G}}
.idate::after{content:'';position:absolute;left:73pt;right:0;top:0;border-top:.75pt solid ${G}}
.idate i{position:absolute;left:24pt;top:4pt;font-style:normal;font-size:8pt}
.hth{left:328pt;width:221pt;height:17.5pt;background:${FILL};border:.75pt solid ${G};position:absolute}
.tb{position:absolute;border-collapse:collapse;table-layout:fixed;border:.9pt solid ${G}}
.tb th{background:${FILL};font-weight:400;font-size:9.4pt;border:.6pt solid ${G};padding:0}
.tb td{border:.5pt solid ${G};font-size:9.4pt;padding:0;text-align:center}
.tb td.m{background:${FILL}}
.tb td.tot{text-align:right;padding-right:3pt}
.tb.hab td{font-size:7.6pt;font-style:italic;color:${GREY};border-color:#a8a8a8;border-width:.4pt}
.tb.hab{border:.75pt solid ${G}}
.ln{border-top:.75pt solid ${G}}
.instr{left:130pt;width:385pt;top:334.5pt;text-align:center;font-size:9.6pt;font-style:italic;color:${GREY};line-height:12.4pt}
.lw{height:19.96pt;border:.6pt solid ${G};margin-top:-.3pt}.lw.a{font-size:9.6pt;text-align:center;line-height:19pt}
.script{width:157.7pt;height:66.7pt;display:flex;align-items:center;justify-content:center;font-family:Script;font-size:15pt;color:${SOFT}}
.acc{left:150pt;width:116pt;top:126.5pt;text-align:right;font-size:6.6pt;font-style:italic;color:${GREY}}
.prod{left:47pt;top:237.6pt;width:513.3pt;height:18.4pt;border:.75pt solid ${G};border-radius:9.2pt;display:flex}
.prod span{flex:1;text-align:center;font-size:9pt;font-style:italic;color:${GREY};line-height:17pt;border-left:.6pt solid #a8a8a8}.prod span:first-child{border:none}
.nrow{left:47pt;width:245pt;height:12.4pt}
.nrow i{position:absolute;left:0;top:0;width:12.4pt;height:12.4pt;border:.75pt solid ${G};border-radius:50%;font-style:normal;font-size:7.4pt;text-align:center;line-height:11pt}
.nrow::after{content:'';position:absolute;left:16.5pt;right:0;top:11.6pt;border-top:.75pt solid ${G}}

.page>.ttab.t,.page>.stab.t{color:${TABINK}}
.v{font-size:8.4pt;line-height:11pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${INK}}
.v.done{text-decoration:line-through;text-decoration-color:${G};color:${GREY}}
.v.c{text-align:center}.v.sm{font-size:7.4pt;padding-right:4pt}
.vp{font-size:8.4pt;line-height:11pt;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;color:${INK}}
.ces{position:absolute;left:3pt;right:3pt;top:15pt;display:flex;flex-direction:column;gap:1pt}
.ce{display:block;font-size:6.6pt;line-height:8.4pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${INK}}
.ce i{display:inline-block;width:4pt;height:4pt;border-radius:50%;margin-right:2.5pt;vertical-align:.5pt}
.ce.done{color:${GREY};text-decoration:line-through}.ce.more{color:${GREY};font-style:italic}
.tv{display:block;font-size:8pt;line-height:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3pt}.tv.l{text-align:left}
.tick{color:${G};font-weight:700}
.tb.hab td.on{background:${SOFT};color:${INK};font-weight:700}
.prod span.on{background:${SOFT};color:${INK};font-weight:700;font-style:normal}
.prod span.on:first-child{border-radius:9pt 0 0 9pt}.prod span.on:last-child{border-radius:0 9pt 9pt 0}
.kv{left:375pt;width:187pt;height:12pt}.kv span{position:absolute;left:0;top:0;font-size:7.6pt;color:${GREY};font-style:italic;line-height:12pt}
.kv::after{content:'';position:absolute;left:56pt;right:0;top:12pt;border-top:.75pt solid ${G}}
.drop{width:10pt;height:10pt;border:.75pt solid ${G};border-radius:50% 50% 50% 0;transform:rotate(-45deg)}.drop.on{background:${SOFT}}
.stk{position:absolute;transform-origin:center center}
${TN === 'afterdark' ? '.sicon img,.micon img,.clip img,.btn img,.cat img{filter:invert(.92)}.nthumb img{filter:grayscale(1) contrast(3) invert(1)}.nthumb i{mix-blend-mode:darken;background:#555}' : ''}.stk img{display:block;width:100%}
`;

// ---------- load the customer's planner through the app itself ----------
// The app keeps its code private inside one function. For the export we add a single line at its end that hands
// the helpers we need to this script. The app file itself is never changed.
function appWithHook() {
  const src = fs.readFileSync(S.app, 'utf8'), end = src.lastIndexOf('})();\n</script>');
  if (end < 0) throw new Error('Could not find the end of the app script to attach the export hook');
  return src.slice(0, end) + 'window.__LLP={docs,set,list,getPath,recurOn,parseMD,sameDay,monthEntries,ETYPES,myPages,tplName,mk,add,key};\n' + src.slice(end);
}
async function loadData(browser) {
  const raw = JSON.parse(fs.readFileSync(S.data, 'utf8'));
  const mock = `window.claude={use:async n=>n==='user'?{id:async()=>'pdf-export'}:n==='db'?{collection:()=>({onSnapshot:cb=>{setTimeout(()=>cb({docs:Object.entries(window.__DOCS).map(([id,d])=>({id,data:()=>JSON.parse(JSON.stringify(d))}))}),0);return()=>{}},doc:()=>({update:async()=>{},set:async()=>{}})})}:null};`;
  const wrap = path.resolve('_app.html');
  fs.writeFileSync(wrap, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.__DOCS=${JSON.stringify(raw).replace(/</g, '\\u003c')};${mock}</script></head><body>${appWithHook()}</body></html>`);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + wrap + '#dashboard');
  await p.waitForFunction(() => window.__LLP && Object.keys(window.__LLP.docs).length > 0, null, { timeout: 20000 });
  await p.waitForTimeout(600);
  const B = await p.evaluate(() => {
    const { docs, set, list, getPath, recurOn, parseMD, sameDay, monthEntries, ETYPES, myPages, tplName, mk, add, key } = window.__LLP;
    const s = set(), D = {};
    for (const k of Object.keys(docs)) if (!/^(vb-|recipe-img|stw-)|-cover-/.test(k)) D[k] = JSON.parse(JSON.stringify(docs[k]));
    const days = {}, bl = list('brain', 'list', 0).filter(x => x && x.t && x.date);
    for (let d = mk(2026, 11, 20); d <= mk(2028, 0, 12); d = add(d, 1)) {
      const k = key(d), dd = docs['d' + k] || {};
      const rc = recurOn(d).map(r => ({ t: r.t, time: r.time || '', done: !!getPath(dd, 'rc.' + r.id) }));
      const bd = bl.filter(x => { const q = parseMD(x.date); return q && sameDay(q, d); }).map(x => ({ t: x.t, a: x.area || 'personal', done: !!x.done }));
      if (rc.length || bd.length) days[k] = { rc, bd };
    }
    const ment = {}; for (let m = 0; m < 12; m++) ment[m] = monthEntries(m);
    return { set: s, docs: D, days, ment, et: Object.fromEntries(ETYPES.map(e => [e[0], e[2]])), pages: myPages().map(x => ({ id: x.id, title: x.title || tplName(x.tpl) })) };
  });
  DOCS = B.docs; SET = B.set; DAYX = B.days; MENT = B.ment; ETC = B.et; PAGES = B.pages;
  setTone(S.tone || SET.tone); if (S.dayLayout) SET.dayLayout = S.dayLayout;
  if (S.stickers) STK = await shootStickers(p);
  if (errs.length) console.log('app warnings:', errs.slice(0, 5).join(' | '));
  await ctx.close();
}

// which printed page(s) an app page's stickers belong on
function pdfPagesFor(pg) {
  const m = /^#(day|week|wsched|review|month|money|dashboard|year)(?:-(\d+))?$/.exec(pg || ''); if (!m) return [];
  const [, kind, arg] = m;
  if (kind === 'day') return HAS.has(arg) ? ['d' + arg] : [];
  if (kind === 'month') return HASM.has(+arg - 1) ? ['mc' + (+arg - 1)] : [];
  if (kind === 'money') return HASM.has(+arg - 1) ? ['fin' + (+arg - 1)] : [];
  if (kind === 'dashboard' || kind === 'year') return ['index'];
  const dt = D(+arg.slice(0, 4), +arg.slice(4, 6) - 1, +arg.slice(6, 8)), mon = key(mondayOf(add(dt, SET.ws === 0 ? 1 : 0)));
  return MC.filter(c => c.weeks.some(w => key(w) === mon)).map(c => (kind === 'review' ? 'r' : 'w') + c.m + '_' + mon);
}

// photograph each sticker exactly as the app draws it (colourway included), without its rotation; rotation is re-applied in the PDF
async function shootStickers(p) {
  const all = (gp(DOCS, 'stickers.list') || []).map((x, i) => Object.assign({ i }, x)).filter(x => x && x.s && x.pg);
  const want = all.filter(x => pdfPagesFor(x.pg).length);
  const skipped = all.length - want.length;
  await p.addStyleTag({ content: `body.pdfcap *{visibility:hidden!important;animation:none!important;transition:none!important}body.pdfcap .stlayer,body.pdfcap .stlayer *{visibility:visible!important}body.pdfcap .stk .sx,body.pdfcap .stk .srs,body.pdfcap .stk .srt{display:none!important}body.pdfcap .stk{outline:none!important;box-shadow:none!important}body.pdfcap ::placeholder{color:transparent!important}` });
  const out = [];
  for (const pg of [...new Set(want.map(x => x.pg))]) {
    await p.evaluate(h => { document.body.classList.remove('pdfcap'); location.hash = h; }, pg);
    await p.waitForTimeout(700);
    await p.evaluate(() => { document.body.classList.add('pdfcap'); document.querySelectorAll('.stk.sel').forEach(e => e.classList.remove('sel')); });
    for (const x of want.filter(z => z.pg === pg)) {
      const el = await p.$(`.stlayer .stk[data-sti="${x.i}"]`); if (!el) continue;
      await el.evaluate(e => { e.style.transform = 'translate(-50%,-50%)'; });
      const buf = await el.screenshot({ omitBackground: true });
      out.push({ pages: pdfPagesFor(pg), x: +x.x || 0, y: +x.y || 0, w: +x.w || 8, r: +x.r || 0, src: 'data:image/png;base64,' + buf.toString('base64') });
    }
  }
  console.log(`stickers: ${out.length} placed${skipped ? `, ${skipped} on pages the printed layout does not have` : ''}`);
  return out;
}
// stickers sit on the paper area of the page: x/y are the sticker centre, w its width, all as % of the paper
const stickersFor = id => STK.filter(s => s.pages.includes(id)).map(s => `<div class="stk" style="left:${(s.x * 588.5 / 100).toFixed(1)}pt;top:${(21 + s.y * 771 / 100).toFixed(1)}pt;width:${(s.w * 588.5 / 100).toFixed(1)}pt;transform:translate(-50%,-50%) rotate(${s.r}deg)"><img src="${s.src}"></div>`).join('');

(async () => {
  const browser = await chromium.launch();
  if (S.data) await loadData(browser);
  let body = indexPage(), n = 1;
  for (const c of MC) {
    body += monthCal(c) + dashboard(c) + finances(c) + reflection(c); n += 4;
    for (const w of c.weeks) { body += weekly(c, w) + review(c, w); n += 2; }
    for (const dt of c.days) { body += daily(c, dt); n++; }
  }
  // drop each page's stickers in just before its closing tag
  body = body.replace(/<section class="page" id="([^"]+)">([\s\S]*?)<\/section>/g, (m, id, inner) => `<section class="page" id="${id}">${inner}${stickersFor(id)}</section>`);
  const css = cssFn();
  const bp = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 3.125 });
  for (const a of [null, ...Array(12).keys()]) {
    const f = `assets/frame-${TN}-${a === null ? 'x' : a}.png`;
    if (fs.existsSync(f)) continue;
    fs.writeFileSync('fb.html', `<!doctype html><html><head><style>${css}</style></head><body><section class="page">${frameShapes(a)}</section></body></html>`);
    await bp.goto('file://' + path.resolve('fb.html')); await bp.screenshot({ path: f });
  }
  await bp.close();
  const out = `planner-${S.name}.html`;
  fs.writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
  const p = await browser.newPage();
  await p.goto('file://' + path.resolve(out), { timeout: 300000 }); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: `planner-${S.name}.pdf`, printBackground: true, preferCSSPageSize: true, timeout: 600000 });
  await browser.close();
  console.log('pages', n, 'tone', TN, 'layout', SET.dayLayout || 'd1');
})();
