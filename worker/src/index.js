// تحصين — خادم الإشعارات.
// Keeps the list of devices that turned the reminder on and sends «هل قرأت التحصين؟» on the cron schedule.
// No login for anyone: a device registers itself with its push subscription. The VAPID keys are made
// here on first use and never leave Cloudflare.
import { DurableObject } from 'cloudflare:workers';
import { newVapidKeys, sendPush } from './webpush.js';

const SUBJECT = 'https://belalpark.github.io/tahseen/';
const ALLOWED_ORIGINS = ['https://belalpark.github.io'];
// only real browser push services may be stored or called
const PUSH_HOSTS = [/\.push\.apple\.com$/, /(^|\.)fcm\.googleapis\.com$/, /(^|\.)google\.com$/, /(^|\.)googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const BATCH = 40;                 // pushes per invocation (stays under the free plan's 50 outgoing requests)
const REMIND = JSON.stringify({ title: 'هل قرأت التحصين؟', kind: 'remind', url: './' });
const TEST = JSON.stringify({ title: 'هل قرأت التحصين؟', body: 'إشعار تجريبي من الخادم — الإشعارات تعمل على هذا الجهاز ✓', kind: 'test', url: './' });

async function idFor(endpoint) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return [...h.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function validSub(s) {
  try {
    if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1024 || !s.keys) return false;
    const u = new URL(s.endpoint);
    if (u.protocol !== 'https:' || !PUSH_HOSTS.some(r => r.test(u.hostname))) return false;
    const p = s.keys.p256dh, a = s.keys.auth;
    return typeof p === 'string' && typeof a === 'string' && /^[A-Za-z0-9_-]{86,88}$/.test(p) && /^[A-Za-z0-9_-]{21,24}$/.test(a);
  } catch (e) { return false; }
}

export class Store extends DurableObject {
  async keys() {
    let k = await this.ctx.storage.get('vapid');
    if (!k) { k = await newVapidKeys(); await this.ctx.storage.put('vapid', k); }
    return k;
  }
  async publicKey() { return (await this.keys()).publicKey; }
  async add(sub, device) {
    const id = await idFor(sub.endpoint);
    const old = await this.ctx.storage.get('sub:' + id);
    await this.ctx.storage.put('sub:' + id, { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, device: String(device || '').slice(0, 40), added: old ? old.added : Date.now(), seen: Date.now() });
    return id;
  }
  async remove(endpoint) { await this.ctx.storage.delete('sub:' + await idFor(endpoint)); }
  async count() { return (await this.ctx.storage.list({ prefix: 'sub:' })).size; }
  async test(endpoint) {
    const id = await idFor(endpoint);
    const rec = await this.ctx.storage.get('sub:' + id);
    if (!rec) return { ok: false, error: 'not-registered' };
    const last = (await this.ctx.storage.get('test:' + id)) || 0;
    if (Date.now() - last < 20000) return { ok: false, error: 'too-soon' };
    await this.ctx.storage.put('test:' + id, Date.now());
    const r = await sendPush(rec.sub, TEST, await this.keys(), SUBJECT, { ttl: 600, urgency: 'high' });
    if (r.status === 404 || r.status === 410) await this.ctx.storage.delete('sub:' + id);
    return { ok: r.status >= 200 && r.status < 300, status: r.status };
  }
  // A reminder round goes through the devices in batches, one alarm per batch.
  async startRound() { await this.ctx.storage.put('cursor', ''); await this.ctx.storage.setAlarm(Date.now()); }
  async alarm() {
    const cursor = await this.ctx.storage.get('cursor');
    if (cursor === undefined) return;
    const opts = { prefix: 'sub:', limit: BATCH };
    if (cursor) opts.startAfter = cursor;
    const page = await this.ctx.storage.list(opts);
    const keys = await this.keys();
    let sent = 0, gone = 0, failed = 0, last = '';
    for (const [k, rec] of page) {
      last = k;
      try {
        const r = await sendPush(rec.sub, REMIND, keys, SUBJECT);
        if (r.status === 404 || r.status === 410) { await this.ctx.storage.delete(k); gone++; }
        else if (r.status >= 200 && r.status < 300) sent++;
        else { failed++; console.log('push failed', rec.device, r.status, r.text); }
      } catch (e) { failed++; console.log('push error', rec.device, String(e)); }
    }
    console.log(`round batch: sent ${sent}, removed ${gone}, failed ${failed}`);
    if (page.size === BATCH) { await this.ctx.storage.put('cursor', last); await this.ctx.storage.setAlarm(Date.now() + 1000); }
    else await this.ctx.storage.delete('cursor');
  }
}

const store = env => env.STORE.get(env.STORE.idFromName('main'));
function cors(req) {
  const o = req.headers.get('Origin');
  return ALLOWED_ORIGINS.includes(o) ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {};
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const s = store(env);
    if (req.method === 'GET' && url.pathname === '/key') return json(req, { publicKey: await s.publicKey() });
    if (req.method === 'GET' && url.pathname === '/') return json(req, { service: 'tahseen-push', devices: await s.count() });
    if (req.method === 'POST' && ['/subscribe', '/unsubscribe', '/test'].includes(url.pathname)) {
      if (!cors(req)['Access-Control-Allow-Origin']) return json(req, { ok: false, error: 'origin' }, 403);
      const text = await req.text();
      if (text.length > 4096) return json(req, { ok: false, error: 'too-large' }, 413);
      let body; try { body = JSON.parse(text); } catch (e) { return json(req, { ok: false, error: 'bad-json' }, 400); }
      const sub = body && body.subscription;
      if (!validSub(sub)) return json(req, { ok: false, error: 'bad-subscription' }, 400);
      if (url.pathname === '/subscribe') return json(req, { ok: true, id: await s.add(sub, body.device) });
      if (url.pathname === '/unsubscribe') { await s.remove(sub.endpoint); return json(req, { ok: true }); }
      const r = await s.test(sub.endpoint);
      return json(req, r, r.ok ? 200 : r.error === 'not-registered' ? 404 : r.error === 'too-soon' ? 429 : 502);
    }
    return json(req, { ok: false, error: 'not-found' }, 404);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(store(env).startRound()); }
};
