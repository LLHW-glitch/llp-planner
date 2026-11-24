// PDF worker. Runs in GitHub Actions (see .github/workflows/pdf-worker.yml).
// Takes waiting PDF requests one by one: loads the customer's planner, builds the PDF with gen-v2.js,
// stores it privately in Supabase Storage and emails them a 7 day download link plus a link back to their planner.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const env = k => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const APP = process.env.APP_URL || 'https://llp-planner-app.vercel.app';
const mail = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587), secure: +(process.env.SMTP_PORT || 587) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;
const FROM = process.env.MAIL_FROM || 'Live Love Planners <planner@liveloveplanners.com>';
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'emails/pdf-ready.html'), 'utf8');
const WEEK = 7 * 24 * 3600;

async function docsFor(uid, year) {
  const out = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('planner_docs').select('doc_key,data').eq('user_id', uid).eq('year', year).is('deleted_at', null).range(from, from + 999);
    if (error) throw error;
    data.forEach(r => out[r.doc_key] = r.data);
    if (data.length < 1000) return out;
  }
}

async function run(job) {
  const tmp = path.join(__dirname, `job-${job.id}.json`), name = `job-${job.id}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(await docsFor(job.user_id, job.year)));
    execFileSync('node', ['gen-v2.js', JSON.stringify({ name, data: tmp, app: '../tests/app-source.html' })], { cwd: __dirname, stdio: 'inherit', timeout: 20 * 60e3 });
    const file = path.join(__dirname, `planner-${name}.pdf`);
    const stamp = new Date().toISOString().slice(0, 10);
    const key = `${job.user_id}/${job.year}-planner-${stamp}-${job.id.slice(0, 8)}.pdf`;
    const up = await sb.storage.from('pdf-exports').upload(key, fs.readFileSync(file), { contentType: 'application/pdf', upsert: true });
    if (up.error) throw up.error;
    await sb.from('pdf_jobs').update({ status: 'done', path: key, finished_at: new Date().toISOString(), error: null }).eq('id', job.id);

    const { data: link } = await sb.storage.from('pdf-exports').createSignedUrl(key, WEEK, { download: `Live Love Planners ${job.year}.pdf` });
    const { data: u } = await sb.auth.admin.getUserById(job.user_id);
    const to = u && u.user && u.user.email;
    if (mail && to && link) {
      await mail.sendMail({ from: FROM, to, subject: `Your ${job.year} planner PDF is ready`, html: TEMPLATE.replace('{{PDF_URL}}', link.signedUrl).replace('{{APP_URL}}', APP),
        text: `Your ${job.year} planner PDF is ready.\n\nDownload it (link works for 7 days): ${link.signedUrl}\n\nGo back to your planner: ${APP}\n\nChristina x` });
      await sb.from('pdf_jobs').update({ emailed_at: new Date().toISOString() }).eq('id', job.id);
    } else console.log('Email not sent', { smtp: !!mail, to: !!to });
    console.log('done', job.id);
  } catch (e) {
    console.error('failed', job.id, e);
    await sb.from('pdf_jobs').update({ status: job.attempts >= 3 ? 'failed' : 'queued', error: String(e.message || e).slice(0, 500) }).eq('id', job.id);
  } finally {
    for (const f of [tmp, `planner-${name}.pdf`, `planner-${name}.html`]) try { fs.unlinkSync(path.resolve(__dirname, f)); } catch (_) {}
  }
}

// PDFs are kept for 8 days, then removed to keep storage small (customers can make a fresh one any time)
async function tidy() {
  const cut = new Date(Date.now() - 8 * 864e5).toISOString();
  const { data } = await sb.from('pdf_jobs').select('id,path').eq('status', 'done').not('path', 'is', null).lt('finished_at', cut).limit(200);
  if (!data || !data.length) return;
  await sb.storage.from('pdf-exports').remove(data.map(r => r.path));
  await sb.from('pdf_jobs').update({ path: null }).in('id', data.map(r => r.id));
  console.log('tidied', data.length);
}

(async () => {
  let n = 0;
  for (;;) {
    const { data, error } = await sb.rpc('claim_pdf_job');
    if (error) throw error;
    const job = (data || [])[0]; if (!job) break;
    await run(job); n++;
  }
  await tidy();
  console.log(`worker finished, ${n} job(s)`);
})().catch(e => { console.error(e); process.exit(1); });
