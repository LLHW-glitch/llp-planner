// Live Love Planners: full-year generator (Index + monthly section). Settings in, PDF out.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const S = Object.assign({ name: 'full', startHour: 5, endHour: 22, step: 60, months: [0,1,2,3,4,5,6,7,8,9,10,11] }, JSON.parse(process.argv[2] || '{}'));
const Y = 2027;
const G = '#39a845', MINT = '#dff2e6', FILL = '#e5f5eb', INK = '#1e1e1e', GREY = '#9a9a9a', SOFT = '#cfe9d6';
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
  let h = `<img class="fbg" src="assets/frame-${active === null ? 'x' : active}.png">`;
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
function star(cx, cy, size, n) {
  const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? .42 : 1, a = Math.PI / 5 * i - Math.PI / 2; pts.push(`${(Math.cos(a) * r * 100).toFixed(1)},${((Math.sin(a) * r + .08) * 100).toFixed(1)}`); }
  return `<svg class="svg" style="left:${cx - size / 2}pt;top:${cy - size / 2}pt;width:${size}pt;height:${size}pt" viewBox="-110 -110 220 220"><polygon points="${pts.join(' ')}" fill="none" stroke="${G}" stroke-width="7" stroke-linejoin="round"/><text x="0" y="30" font-size="60" text-anchor="middle" fill="${GREY}" font-style="italic" font-family="Body">${n}</text></svg>`;
}
function sparkles(x, y, w, h) {
  const sp = (cx, cy, r) => `<path transform="translate(${cx} ${cy}) scale(${r})" d="M0-1Q.12-.12 1 0Q.12 .12 0 1Q-.12 .12-1 0Q-.12-.12 0-1Z" fill="${SOFT}"/>`;
  return `<svg class="svg" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt" viewBox="0 0 ${w} ${h}">${sp(w / 2, h / 2, 22)}${sp(w / 2 - 21, h / 2 - 16, 8)}${sp(w / 2 + 28, h / 2 - 2, 5.5)}${sp(w / 2 - 25, h / 2 + 22, 5)}${sp(w / 2 + 20, h / 2 + 19, 3)}</svg>`;
}
function table({ x, y, cols, heads = null, rows, rh = 14.3, hh = 16.4, total = 0, mintFirst = false, labels = null, center = true }) {
  let t = `<table class="tb" style="left:${x}pt;top:${y}pt;width:${cols.reduce((a, b) => a + b)}pt"><colgroup>${cols.map(c => `<col style="width:${c}pt">`).join('')}</colgroup>`;
  if (heads) t += `<tr style="height:${hh}pt">${heads.map(hd => `<th>${hd}</th>`).join('')}</tr>`;
  for (let r = 0; r < rows; r++) t += `<tr style="height:${rh}pt">${cols.map((c, i) => `<td class="${mintFirst && i === 0 ? 'm' : ''}">${labels && i === 0 ? labels[r] : ''}</td>`).join('')}</tr>`;
  if (total) t += `<tr style="height:${hh}pt"><td colspan="${total}" class="tot">Total:</td>${cols.slice(total).map(() => '<td></td>').join('')}</tr>`;
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
  for (let i = 0; i < 10; i++) h += `<div class="cs" style="top:${31 + i * 28.7}pt">${i + 1}.</div>`;
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
      h += `<img class="nthumb" src="assets/note${k}.png" style="left:${x - .5}pt;top:${y - .5}pt"><div class="npill" style="left:${x - 9}pt;top:${y + 34}pt">${t}</div>`;
    });
  return page('index', h);
}

// ---------- MONTH CALENDAR ----------
function monthCal(c) {
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
      const show = inM || href;
      h += A(show ? href : null, 'calc', `left:${62.2 + i * 72}pt;top:${y}pt;height:${rh}pt`, show ? `<b class="${inM ? '' : 'out'}">${dt.getUTCDate()}</b>` : '');
    }
  });
  for (let i = 1; i < 7; i++) h += `<div class="calv" style="left:${62.2 + i * 72}pt;top:${top}pt;height:${H}pt"></div>`;
  h += lbl('This month’s focus:', 47, 595) + box(47.8, 614.6, 132.8, 57, 'mint');
  h += lbl('Top Priorities this month:', 47, 684.5);
  [1, 2, 3].forEach((k, i) => h += `<div class="pri2" style="top:${708 + i * 15.3}pt">${k}.</div>`);
  h += lbl('To do:', 195.7, 595);
  for (let i = 0; i < 9; i++) h += `<div class="todo" style="left:196pt;width:141pt;top:${617.9 + i * 15}pt"></div>`;
  h += grid(354, 601.5, 212, 146.5);
  return page('mc' + c.m, h, c.m);
}

// ---------- DASHBOARD ----------
function dashboard(c) {
  let h = h1(MONTHS[c.m] + ' Dashboard') + switcher('db', c.m) + micons(c.m);
  h += lbl("This month's focus", 47, 80) + box(47, 100, 251.5, 49, 'mint');
  const circ = (y, n) => { let s = ''; for (let i = 0; i < n; i++) s += `<div class="crow" style="top:${y + i * 15.3}pt"><i></i></div>`; return s; };
  h += lbl('Goals I want to achieve this month', 47, 160) + circ(177.3, 5);
  h += lbl('Top projects this month', 47, 264) + circ(282, 5);
  h += lbl('To do', 47, 367.7) + `<div class="sub" style="left:104pt;width:80pt;top:387pt">Action steps</div><div class="sub" style="left:238pt;width:60pt;top:387pt">Date:</div>`;
  for (let i = 0; i < 15; i++) h += `<div class="crow td" style="top:${393.3 + i * 15.9}pt"><i></i><u></u></div>`;
  h += lbl('Important dates / events', 328, 80);
  for (let i = 0; i < 13; i++) h += `<div class="idate" style="top:${100.8 + i * 16}pt">${i < 12 ? '<i>/</i>' : ''}</div>`;
  h += lbl('Habit Trackers', 328, 316);
  [334.5, 439.2, 543.9].forEach(y => {
    h += `<div class="ht"><div class="hth" style="top:${y}pt"></div></div>`;
    let t = `<table class="tb hab" style="left:328pt;top:${y + 17}pt;width:221pt">`;
    for (let r = 0; r < 4; r++) { t += '<tr style="height:17.3pt">'; for (let k = 0; k < 8; k++) { const n = r * 8 + k + 1; t += `<td>${n <= 31 ? n : ''}</td>`; } t += '</tr>'; }
    h += t + '</table>';
  });
  h += lbl('Notes', 47, 641.3) + grid(47, 660.4, 504.8, 84.5);
  return page('db' + c.m, h, c.m);
}

// ---------- FINANCES ----------
function finances(c) {
  let h = h1(MONTHS[c.m] + ' Finances') + switcher('fin', c.m) + micons(c.m);
  h += lbl('Financial Goal this month', 47, 77.8) + box(47, 95, 249, 56, 'sh');
  h += table({ x: 47, y: 171.5, cols: [144, 52.35, 52.35], heads: ['Income', 'Expected', 'Amount'], rows: 4, rh: 14.4, total: 1 });
  h += table({ x: 47, y: 275.6, cols: [142, 42.5, 44.5, 18.3], heads: ['Bills', 'Due', 'Amount', '&#10003;'], rows: 13, rh: 14.3, total: 2 });
  h += table({ x: 47, y: 511.8, cols: [144, 52.35, 52.35], heads: ['Expenses', 'Date', 'Amount'], rows: 14, rh: 14.45, total: 2 });
  h += lbl('Monthly Overview', 322.7, 77.8);
  h += table({ x: 322.7, y: 94.9, cols: [148.6, 93.7], rows: 4, rh: 17.2, mintFirst: true, labels: ['Opening Balance:', 'Total Income (+) :', 'Total Expenses (-) :', 'Closing Balance:'] });
  h += table({ x: 322.7, y: 182.6, cols: [148.6, 47.1, 46.6], heads: ['Sinking Funds', 'Date', 'Amount'], rows: 13, rh: 14.2, hh: 14.5, total: 2 });
  h += table({ x: 322.7, y: 418.9, cols: [148.6, 47.1, 46.6], heads: ['Savings / Investments', 'Date', 'Amount'], rows: 5, rh: 14.2, hh: 14.5, total: 2 });
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
  for (let k = 1; k <= 10; k++) s += `<circle cx="${cx}" cy="${cy}" r="${k * 11}" fill="none" stroke="#9fd3aa" stroke-width=".7"/>`;
  for (let a = 0; a < 360; a += 45) { const p = pt(R, a); s += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#9fd3aa" stroke-width=".7"/>`; }
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
  let h = h1(MONTHS[c.m]);
  h += A('#' + rvId(c.m, w), 'pill', 'left:450pt;top:46.5pt;width:70pt', 'Weekly Review');
  h += `<div class="pill" style="left:527pt;top:47pt;width:46pt">Week ${isoWeek(w)}</div>`;
  for (let i = 0; i < 7; i++) {
    const dt = add(w, i), y = 77 + i * 96.9, inM = dt.getUTCMonth() === c.m;
    h += `<div class="wline" style="top:${y}pt"></div>` + A(dayHref(dt), 'wday', `top:${y + 5}pt`, `${DOW[i]}<b class="${inM ? '' : 'out'}">${dt.getUTCDate()}</b>`);
  }
  h += `<div class="wline g" style="top:${77 + 7 * 96.9}pt"></div>`;
  h += lbl('Priorities this week', 374, 72);
  [1, 2, 3].forEach((n, i) => h += `<div class="pri" style="left:374pt;width:191pt;top:${94 + i * 17.3}pt">${n}.</div>`);
  h += lbl('To do', 374, 155);
  for (let i = 0; i < 14; i++) h += `<div class="todo big" style="left:374pt;width:191pt;top:${175 + i * 15.4}pt"></div>`;
  h += lbl('Habit Tracker', 374, 403);
  'MTWTFSS'.split('').forEach((ch, i) => h += `<div class="ht-h" style="left:${478 + i * 12.4}pt">${ch}</div>`);
  for (let r = 0; r < 5; r++) {
    h += `<div class="ht-line" style="top:${428 + r * 14.1}pt"></div>`;
    for (let i = 0; i < 7; i++) h += `<div class="ht-b" style="left:${478 + i * 12.4}pt;top:${418.5 + r * 14.1}pt"></div>`;
  }
  h += lbl('Notes', 374, 499) + grid(372, 518, 192, 89.5);
  return page(wkId(c.m, w), h + miniCal(c, 626));
}
function review(c, w) {
  let h = h1('Weekly Review');
  h += A('#' + wkId(c.m, w), 'pill', 'left:463.4pt;top:47.8pt;width:58.3pt', '&#9666; Back to Week');
  h += `<div class="pill" style="left:527.6pt;top:47.8pt;width:45pt">Week ${isoWeek(w)}</div>`;
  h += lbl('Focus this week:', 47, 81) + box(47, 98.2, 244.3, 43.2, 'mint');
  h += `<div class="acc">Accomplished?</div><div class="ht-b" style="left:272.3pt;top:127pt;width:9.8pt;height:9.8pt"></div>`;
  h += lbl("This week's rating:", 314.8, 81);
  for (let i = 0; i < 5; i++) h += star(335.8 + i * 54, 119.8, 29.5, i + 1);
  h += lbl('How was my week?', 47, 154.4) + box(47, 172.8, 513.3, 28.8, 'sh');
  h += lbl('Productivity level this week', 47, 219.2);
  h += `<div class="prod">${['20%', '40%', '60%', '80%', '100%'].map(p => `<span>${p}</span>`).join('')}</div>`;
  h += lbl('My biggest <b>accomplishments</b> this week', 47, 268.3) + box(47, 289.3, 244.3, 81.8, 'mint');
  h += lbl('My biggest <b>challenges</b> this week', 316.1, 268.3) + box(316.1, 289.3, 244.2, 81.8);
  h += lbl("Things <b>I've learnt</b> this week...", 47, 385.4) + box(47, 406.5, 244.3, 81.1);
  h += lbl('Things <b>to improve</b> on next week...', 316.1, 385.4) + box(316.1, 406.5, 244.2, 81.1, 'mint');
  h += lbl('Main Priorities next week', 47, 504.5);
  [1, 2, 3].forEach((n, i) => h += `<div class="nrow" style="top:${524 + i * 17}pt"><i>${n}</i></div>`);
  h += lbl("Next week's action plan:", 47, 588.3);
  for (let i = 0; i < 10; i++) h += `<div class="todo" style="left:44pt;width:248pt;top:${603.5 + i * 14.7}pt"></div>`;
  h += lbl('Notes', 316.1, 506.5) + grid(316.1, 528.2, 244.2, 219.3);
  return page(rvId(c.m, w), h);
}

// ---------- DAILY ----------
function daily(c, dt) {
  const k = key(dt);
  let h = h1(`${DAYNAME[dow(dt)]}, ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`);
  h += `<a class="clip" href="shortcuts://run-shortcut?name=LiveLovePlanners&amp;input=text&amp;text=${k}"><img src="assets/clipboard.png"></a>`;
  h += A('#' + wkId(c.m, dt), 'pill', 'left:514pt;top:53pt;width:56pt', 'Week ' + isoWeek(dt));
  h += lbl("Today's focus", 47, 79) + `<div class="focus"></div>` + lbl('Schedule', 47, 150);
  const rows = []; for (let t = S.startHour * 60; t < S.endHour * 60 + 60; t += S.step) rows.push(t);
  const top = 169.5, rh = (752.6 - top) / rows.length, p = n => String(n).padStart(2, '0');
  rows.forEach((t, i) => {
    const y = top + i * rh, hr = Math.floor(t / 60), mn = t % 60, e = t + S.step;
    const lab = (hr % 12 || 12) + (mn ? ':' + p(mn) : '') + (hr < 12 ? ' am' : ' pm');
    const gc = `https://calendar.google.com/calendar/u/0/r/eventedit?action=TEMPLATE&amp;dates=${k}T${p(hr)}${p(mn)}00/${k}T${p(Math.floor(e / 60))}${p(e % 60)}00`;
    h += `<div class="srow" style="top:${y}pt;height:${rh}pt">${S.step === 60 ? '<i></i>' : ''}</div><a class="hour${S.step === 60 ? '' : ' sm'}" href="${gc}" style="top:${y}pt;height:${rh}pt">${lab}</a>`;
  });
  h += `<div class="srow" style="top:752.6pt;height:0"></div><div class="svl" style="top:${top}pt;height:${752.6 - top}pt"></div>`;
  h += lbl('Top 3 priorities', 375, 79);
  [1, 2, 3].forEach((n, i) => h += `<div class="pri" style="left:375pt;width:187pt;top:${99.5 + i * 16.9}pt">${n}.</div>`);
  h += lbl('Personal To do', 375, 160);
  for (let i = 0; i < 12; i++) h += `<div class="todo" style="left:375pt;width:187pt;top:${178 + i * 13.15}pt"></div>`;
  h += lbl('Work To do', 375, 345.5);
  for (let i = 0; i < 12; i++) h += `<div class="todo" style="left:375pt;width:187pt;top:${361.5 + i * 13.15}pt"></div>`;
  h += lbl('Notes', 375, 526.5) + grid(375.5, 546, 187.5, 70);
  return page('d' + k, h + miniCal(c, 626));
}

// ---------- CSS ----------
const css = `
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
.page{position:relative;width:612pt;height:792pt;overflow:hidden;page-break-after:always;background:#f4f4f3}
.page>*{position:absolute}
.marble{left:588pt;top:0;width:24pt;height:21pt;background:url(assets/marble.png) center/cover}
.sheet{left:0;top:21pt;width:588.5pt;height:771pt;background:#fff;box-shadow:1.5pt 0 2pt rgba(0,0,0,.22),0 -1pt 2pt rgba(0,0,0,.15)}
.ttab{top:0;width:62pt;height:21pt;background:${MINT};border-top-right-radius:5pt;box-shadow:inset -1pt -1.5pt 1.5pt rgba(0,0,0,.18),1pt 0 1.5pt rgba(0,0,0,.18);font-size:9.5pt;line-height:20pt;text-align:center;padding-right:6pt}
.ipanel{left:588.5pt;top:21pt;width:22pt;height:84pt;background:#fff;border-radius:0 5pt 0 0;clip-path:polygon(0 0,100% 0,100% 88%,0 100%);box-shadow:1pt 1pt 2pt rgba(0,0,0,.2)}
.sicon{left:592.5pt;width:18pt;height:16pt}.sicon img{width:18pt;height:16pt;display:block}
.stab{left:588.5pt;width:23pt;height:52pt;background:${MINT};border-bottom-right-radius:5pt;box-shadow:inset 1.5pt 0 2pt rgba(0,0,0,.16),0 1pt 1.5pt rgba(0,0,0,.2)}
.stab.on{background:#fff;box-shadow:1pt 1pt 2pt rgba(0,0,0,.22);z-index:2}
.fbg{left:0;top:0;width:612pt;height:792pt}
.t{background:none!important;box-shadow:none!important}
.stab span{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg);font-size:9.5pt;white-space:nowrap}
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
.cs{left:9pt;width:197pt;height:20pt;background:#eef8f1;border:.6pt solid ${G};box-shadow:inset -1.2pt -1.2pt 0 ${G};font-size:9.6pt;line-height:19pt;padding-left:6pt}
.btn{left:292pt;width:275pt;height:30pt;border:.75pt solid ${G};border-radius:7pt;display:flex;align-items:center;justify-content:center;gap:5pt;font-size:9.6pt}
.mcal{width:68.7pt;text-align:center;font-size:9.6pt;line-height:14pt}
.cat{top:282pt;width:61pt;height:61pt;border:.9pt solid ${G};border-radius:7pt;overflow:hidden;display:flex;align-items:center;justify-content:center}.cat img{width:54pt;height:53pt}
.catl{top:351pt;width:64pt;height:23pt;border:.75pt solid ${G};border-radius:4pt;font-size:8.6pt;display:flex;align-items:center;justify-content:center;text-align:center;line-height:9pt}
.nthumb{width:51pt;height:29pt}
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
.ngrid{border:.9pt solid ${G};border-radius:4pt;background-image:linear-gradient(#d4eedb .6pt,transparent .6pt),linear-gradient(90deg,#d4eedb .6pt,transparent .6pt);background-size:14.4pt 14.4pt;background-position:-1pt -1pt}
.wline{left:47pt;width:304pt;border-top:.6pt solid #8a8a8a}.wline.g{border-top:1.2pt solid ${G}}
.wday{left:52pt;width:30pt;font-size:9.6pt;line-height:11pt;text-align:center}
.wday b{display:block;font-weight:400;font-family:Head;font-size:13pt;line-height:13pt}.wday b.out{color:#b3b3b3}
.ht-h{top:405pt;width:10pt;text-align:center;font-size:9.6pt}
.ht-b{width:9.5pt;height:9.5pt;border:.75pt solid ${G}}
.ht-line{left:374pt;width:96pt;border-top:.75pt solid ${G}}
.mc-title{left:415pt;width:140pt;text-align:center;font-weight:500;font-size:9.6pt}
.mc-h{width:16pt;text-align:center;font-size:9.6pt}
.mc-w{left:386pt;width:22pt;text-align:center;font-size:8.6pt;font-style:italic;color:#9fd3aa;line-height:14pt}
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
`;

(async () => {
  let body = indexPage(), n = 1;
  for (const c of MC) {
    body += monthCal(c) + dashboard(c) + finances(c) + reflection(c); n += 4;
    for (const w of c.weeks) { body += weekly(c, w) + review(c, w); n += 2; }
    for (const dt of c.days) { body += daily(c, dt); n++; }
  }
  const b0 = await chromium.launch(); const bp = await b0.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 3.125 });
  for (const a of [null, ...Array(12).keys()]) {
    const f = `assets/frame-${a === null ? 'x' : a}.png`;
    if (fs.existsSync(f)) continue;
    fs.writeFileSync('fb.html', `<!doctype html><html><head><style>${css}</style></head><body><section class="page">${frameShapes(a)}</section></body></html>`);
    await bp.goto('file://' + path.resolve('fb.html')); await bp.screenshot({ path: f });
  }
  await b0.close();
  const out = `planner-${S.name}.html`;
  fs.writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(out), { timeout: 300000 }); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: `planner-${S.name}.pdf`, printBackground: true, preferCSSPageSize: true, timeout: 600000 });
  await b.close();
  console.log('pages', n);
})();
