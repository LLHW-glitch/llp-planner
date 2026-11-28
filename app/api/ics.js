// Apple Calendar: returns one event as an .ics file. Safari / Chrome on iPhone, iPad and Mac show "Add to Calendar".
// /api/ics?t=Title&s=20270104T090000&e=20270104T093000   (floating local time, so it lands at the time they typed)
module.exports = (req, res) => {
  const q = req.query || {};
  const okT = (v) => /^\d{8}T\d{6}$/.test(String(v || ''));
  const s = String(q.s || ''), e = okT(q.e) ? String(q.e) : s;
  if (!okT(s)) { res.status(400).send('Missing time'); return; }
  const esc = (v) => String(v || 'Planner').slice(0, 200).replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Live Love Planners//2027 Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${s}-${Math.random().toString(36).slice(2)}@liveloveplanners.com`, `DTSTAMP:${now}`,
    `DTSTART:${s}`, `DTEND:${e}`, `SUMMARY:${esc(q.t)}`, 'END:VEVENT', 'END:VCALENDAR', ''
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="planner-event.ics"');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(ics);
};
