// Sends the «هل قرأت التحصين؟» reminder to every device registered in push/subs/*.json.
// Run by .github/workflows/push.yml. Needs data/push.json (public key) and the secret VAPID_PRIVATE_KEY.
// Devices whose subscription has expired (404/410) get their file deleted; the workflow commits that.
import * as webpush from 'web-push';
import { readFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SUBS = join(ROOT, 'push', 'subs');
const CFG = join(ROOT, 'data', 'push.json');
const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
const dry = process.argv.includes('--dry-run');

if (!existsSync(CFG)) { console.log('data/push.json not found — notifications are not set up yet. Nothing to send.'); process.exit(0); }
if (!priv) { console.error('The repository secret VAPID_PRIVATE_KEY is missing. Add it in Settings → Secrets and variables → Actions.'); process.exit(1); }
const cfg = JSON.parse(readFileSync(CFG, 'utf8'));
webpush.setVapidDetails(cfg.subject || 'https://belalpark.github.io/tahseen/', cfg.publicKey, priv);

const files = existsSync(SUBS) ? readdirSync(SUBS).filter(f => f.endsWith('.json')) : [];
if (!files.length) { console.log('No registered devices yet (push/subs/ is empty).'); process.exit(0); }

// The service worker writes the body from the last counted reading on that device; this payload is the fallback.
const payload = JSON.stringify({ title: 'هل قرأت التحصين؟', url: './' });
const host = u => { try { return new URL(u).host; } catch { return '?'; } };
let sent = 0, gone = 0, failed = 0;

for (const f of files) {
  let rec;
  try { rec = JSON.parse(readFileSync(join(SUBS, f), 'utf8')); } catch (e) { console.log(`✗ ${f}: not valid JSON`); failed++; continue; }
  const sub = rec.subscription || rec;
  const name = `${f} (${rec.device || 'device'} · ${host(sub.endpoint)})`;
  if (!sub.endpoint || !sub.keys) { console.log(`✗ ${name}: missing endpoint/keys`); failed++; continue; }
  if (dry) { console.log(`• would send to ${name}`); continue; }
  try {
    const r = await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'normal' });
    console.log(`✓ ${name}: ${r.statusCode}`); sent++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) { unlinkSync(join(SUBS, f)); console.log(`− ${name}: subscription expired (${e.statusCode}) → removed`); gone++; }
    else { console.log(`✗ ${name}: ${e.statusCode || ''} ${e.body || e.message}`.trim()); failed++; }
  }
}
console.log(`sent ${sent}, removed ${gone}, failed ${failed}`);
if (failed && !sent) process.exit(1);
