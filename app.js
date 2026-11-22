/* تحصين — الرقية الشرعية */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');

  const RECITERS = [
    { id: 'MaherAlMuaiqly128kbps', name: 'ماهر المعيقلي' },
    { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' },
    { id: 'Abdurrahmaan_As-Sudais_192kbps', name: 'عبدالرحمن السديس' },
    { id: 'Saood_ash-Shuraym_128kbps', name: 'سعود الشريم' },
    { id: 'Ghamadi_40kbps', name: 'سعد الغامدي' },
    { id: 'Yasser_Ad-Dussary_128kbps', name: 'ياسر الدوسري' },
    { id: 'Husary_128kbps', name: 'محمود خليل الحصري' },
    { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي' }
  ];
  const AUDIO_BASE = 'https://everyayah.com/data/';
  const MIN_SESSION_MS = 4 * 60 * 1000;      // a reading shorter than this is not counted
  const REMIND_MS = 6 * 60 * 60 * 1000;      // remind when this long has passed since the last counted reading
  const pad2 = n => String(n).padStart(2, '0');
  const pad3 = n => String(n).padStart(3, '0');
  const arDigits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const plural = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : (n >= 3 && n <= 10) ? n + ' ' + few : n + ' ' + many;
  const ayahWord = n => plural(n, 'آية واحدة', 'آيتان', 'آيات', 'آية');
  const fmtDur = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + pad2(m) : pad2(m)) + ':' + pad2(s % 60); };
  const ago = ms => {
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'الآن';
    if (m < 60) return 'منذ ' + plural(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
    const h = Math.floor(m / 60);
    if (h < 24) return 'منذ ' + plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
    const d = Math.floor(h / 24);
    return 'منذ ' + plural(d, 'يوم', 'يومين', 'أيام', 'يوماً');
  };

  /* ---------- state (localStorage) ---------- */
  const KEY = 'tahseen.v2', OLD_KEY = 'tahseen.v1';
  const DEF = { fs: 1, theme: 'dark', mode: 'read', reciter: RECITERS[0].id, repeat: 1, auto: true, wake: true };
  let S = { prefs: Object.assign({}, DEF), session: null, history: {}, lastRead: 0, total: 0, installSeen: 0, lastResult: null };
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j) S = Object.assign({}, S, j, { prefs: Object.assign({}, DEF, j.prefs || {}) });
    else {
      const o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (o && o.prefs) S.prefs = Object.assign({}, DEF, o.prefs);
      localStorage.removeItem(OLD_KEY);
    }
  } catch (e) { /* storage unavailable */ }
  if (!RECITERS.some(r => r.id === S.prefs.reciter)) S.prefs.reciter = RECITERS[0].id;
  let saveT;
  const writeNow = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const save = now => { clearTimeout(saveT); if (now) writeNow(); else saveT = setTimeout(writeNow, 400); };

  let DATA = null;
  let pageIdx = -1, enterDir = '', turning = false;

  /* ---------- icons ---------- */
  const I = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M2.5 5.5c3-1.6 6.6-1.6 9.5.8 2.9-2.4 6.5-2.4 9.5-.8v13c-3-1.6-6.6-1.6-9.5.8-2.9-2.4-6.5-2.4-9.5-.8z"/><path d="M12 6.3v13"/></svg>',
    head: '<svg viewBox="0 0 24 24"><path d="M3.5 15v-3a8.5 8.5 0 0 1 17 0v3"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/></svg>',
    skipF: '<svg viewBox="0 0 24 24"><path d="M5 5v14l10-7z"/><rect x="16" y="5" width="3" height="14" rx="1"/></svg>',
    skipB: '<svg viewBox="0 0 24 24"><path d="M19 5v14L9 12z"/><rect x="5" y="5" width="3" height="14" rx="1"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v9h14v-9h-1"/></svg>',
    plusSq: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    swipe: '<svg viewBox="0 0 24 24"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>'
  };
  const frame = '<svg viewBox="0 0 440 64" aria-hidden="true"><defs><linearGradient id="fg" x1="0" x2="1"><stop offset="0" stop-color="#8a6224"/><stop offset=".5" stop-color="#fff0c0"/><stop offset="1" stop-color="#8a6224"/></linearGradient></defs><path d="M30 3H410L437 32L410 61H30L3 32Z" fill="none" stroke="url(#fg)" stroke-width="2.5"/><path d="M38 10H402L422 32L402 54H38L18 32Z" fill="none" stroke="url(#fg)" stroke-width="1" opacity=".7"/><path d="M14 32l6-6 6 6-6 6zM414 32l6-6 6 6-6 6z" fill="url(#fg)"/></svg>';
  const star = n => `<span class="star" aria-hidden="true"><i></i><span>${n}</span></span>`;

  /* ---------- prefs ---------- */
  function applyPrefs() {
    const root = document.documentElement;
    root.style.setProperty('--fs', S.prefs.fs);
    root.dataset.theme = S.prefs.theme;
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = S.prefs.theme === 'light' ? '#f5eedc' : '#041a10';
  }
  const reciterName = () => (RECITERS.find(r => r.id === S.prefs.reciter) || RECITERS[0]).name;

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3400);
  }

  /* ---------- session & timer ---------- */
  function ensureSession(i) {
    if (!S.session) S.session = { started: Date.now(), activeMs: 0, page: i, scroll: {}, ayah: {}, done: [] };
    return S.session;
  }
  const markDone = id => { const s = S.session; if (s && !s.done.includes(id)) { s.done.push(id); save(); } };
  function saveScroll() {
    if (pageIdx >= 0 && S.session) { S.session.scroll[pageIdx] = Math.round(window.scrollY); S.session.page = pageIdx; save(); }
  }
  let lastTick = Date.now();
  const isActive = () => !!S.session && ((document.visibilityState === 'visible' && pageIdx >= 0) || (!audio.paused && !!audio.getAttribute('src')));
  function updateTimer() {
    if (!S.session) return;
    const ok = S.session.activeMs >= MIN_SESSION_MS;
    document.querySelectorAll('.tchip[data-live]').forEach(c => {
      c.querySelector('b').textContent = fmtDur(S.session.activeMs);
      c.classList.toggle('ok', ok);
      c.title = ok ? 'تجاوزت الجلسة 4 دقائق وستُحتسب عند الإتمام' : 'تُحتسب القراءة إذا تجاوزت الجلسة 4 دقائق';
    });
  }
  setInterval(() => {
    const now = Date.now(), d = Math.min(now - lastTick, 5000);
    lastTick = now;
    if (isActive()) { S.session.activeMs += d; save(); updateTimer(); }
  }, 1000);

  function finish() {
    const s = S.session;
    if (pageIdx >= 0 && DATA) markDone(DATA.pages[pageIdx].id);
    if (!s) { location.hash = '#/'; return; }
    const ms = s.activeMs, ok = ms >= MIN_SESSION_MS;
    if (ok) {
      const k = dayKey(), h = S.history[k] || { count: 0, ms: 0 };
      h.count++; h.ms += ms; S.history[k] = h;
      S.total = (S.total || 0) + 1; S.lastRead = Date.now();
      const keep = Object.keys(S.history).sort().slice(-60);           // keep about two months
      S.history = Object.fromEntries(keep.map(x => [x, S.history[x]]));
    }
    S.lastResult = { ok, ms, at: Date.now() };
    S.session = null;
    stopAudio(); save(true);
    location.hash = '#/done';
  }
  function startOver() { S.session = null; ensureSession(0); save(true); enterDir = ''; if (location.hash === '#/p/1') route(); else location.hash = '#/p/1'; }

  /* ---------- wake lock ---------- */
  let wake = null;
  async function requestWake() {
    try {
      if (S.prefs.wake && pageIdx >= 0 && !wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => { wake = null; });
      }
    } catch (e) { wake = null; }
  }
  function releaseWake() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }

  /* ---------- install to home screen ---------- */
  let deferredPrompt = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (pageIdx < 0 && DATA) renderHome(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('تم تثبيت تحصين على جهازك'); if (pageIdx < 0 && DATA) renderHome(); });
  function installCard() {
    if (standalone() || (!deferredPrompt && !isIOS)) return '';
    return `<div class="install"><img src="icons/apple-touch-icon.png" alt="">
      <div><b>ثبّت «تحصين» على الشاشة الرئيسية</b><small>يفتح كتطبيق مستقل بملء الشاشة، ويعمل دون إنترنت.</small></div>
      <button class="btn gold small" id="instBtn">تثبيت</button></div>`;
  }
  function iosInstallSheet() {
    openModal(`<div class="sheet-grip"></div><h2>أضف «تحصين» إلى الشاشة الرئيسية</h2>
      <ol class="steps">
        <li><span class="n">1</span><span>اضغط زر المشاركة ${I.share} أسفل المتصفح (أو أعلاه).</span></li>
        <li><span class="n">2</span><span>اختر «إضافة إلى الشاشة الرئيسية» ${I.plusSq}</span></li>
        <li><span class="n">3</span><span>اضغط «إضافة»، ثم افتح «تحصين» من أيقونته كتطبيق.</span></li>
      </ol>
      <p class="note">على آيفون لا يسمح النظام لأي موقع بإضافة نفسه تلقائياً؛ هذه الخطوات الثلاث مرة واحدة فقط.</p>
      <button class="btn gold block" data-close>فهمت</button>`);
  }
  function doInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => { deferredPrompt = null; if (pageIdx < 0) renderHome(); });
    } else if (isIOS) iosInstallSheet();
  }

  /* ---------- modal ---------- */
  function openModal(html) {
    const m = $('#modal'); m.innerHTML = html; m.hidden = false; $('#modalBackdrop').hidden = false;
    m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  }
  function closeModal() { $('#modal').hidden = true; $('#modalBackdrop').hidden = true; }
  function confirmSheet(title, text, okLabel, onOk) {
    openModal(`<div class="sheet-grip"></div><h2>${title}</h2><p class="note" style="font-size:17px">${text}</p>
      <div class="modal-actions"><button class="btn ghost" data-close>إلغاء</button><button class="btn gold" id="mOk">${okLabel}</button></div>`);
    $('#mOk').addEventListener('click', () => { closeModal(); onOk(); });
  }

  /* ---------- audio engine ---------- */
  const audio = new Audio(); audio.preload = 'auto';
  const pre = new Audio(); pre.preload = 'auto';
  let Q = [], qi = -1, rep = 0, autoStart = false;
  const urlFor = it => AUDIO_BASE + S.prefs.reciter + '/' + pad3(it.s) + pad3(it.n) + '.mp3';

  function buildQueue(p) {
    const q = [];
    if (p.kind !== 'quran') return q;
    p.parts.forEach(pt => {
      if (pt.basmala) q.push({ s: 1, n: 1, b: true });
      pt.ayahs.forEach(([n]) => q.push({ s: pt.s, n }));
    });
    return q;
  }
  function highlight(k, scroll = true) {
    document.querySelectorAll('.cur').forEach(e => e.classList.remove('cur'));
    const el = document.querySelector(`[data-q="${k}"]`);
    if (!el) return;
    el.classList.add('cur');
    if (scroll) {
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      if (r.top < 90 || r.bottom > vh - 190) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  function playAt(k) {
    if (!Q[k]) return;
    qi = k;
    if (S.session && pageIdx >= 0) { S.session.ayah[pageIdx] = k; save(); }
    highlight(k);
    audio.src = urlFor(Q[k]);
    const pr = audio.play();
    if (pr) pr.catch(err => { if (err && err.name !== 'AbortError') toast('تعذّر تشغيل التلاوة. تحقّق من الاتصال بالإنترنت.'); ui(); });
    if (Q[k + 1]) pre.src = urlFor(Q[k + 1]);
    mediaMeta(); ui();
  }
  function toggle() {
    if (!Q.length) return;
    if (audio.paused) {
      if (qi < 0 || !audio.getAttribute('src')) {
        const saved = S.session && S.session.ayah[pageIdx];
        playAt(Number.isInteger(saved) && saved >= 0 && saved < Q.length ? saved : 0);
      } else audio.play().catch(() => {});
    } else audio.pause();
    ui();
  }
  function stopAudio() { audio.pause(); audio.removeAttribute('src'); audio.load(); qi = -1; rep = 0; ui(); }
  function onPageEnd() {
    rep++;
    if (rep < S.prefs.repeat) { playAt(0); return; }
    rep = 0;
    if (S.session) delete S.session.ayah[pageIdx];
    markDone(DATA.pages[pageIdx].id);
    if (pageIdx + 1 >= DATA.pages.length) { finish(); return; }
    if (S.prefs.auto) { autoStart = DATA.pages[pageIdx + 1].kind === 'quran'; turn('next'); }
    else { qi = -1; ui(); toast('انتهت تلاوة هذه الصفحة'); }
  }
  audio.addEventListener('ended', () => { if (qi + 1 < Q.length) playAt(qi + 1); else onPageEnd(); });
  audio.addEventListener('playing', () => { busy(false); ui(); });
  audio.addEventListener('pause', ui);
  audio.addEventListener('waiting', () => busy(true));
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    busy(false); ui(); toast('تعذّر تحميل التلاوة. تحقّق من الاتصال بالإنترنت.');
  });
  function busy(b) { const pb = $('#pPlay'); if (pb) pb.classList.toggle('busy', b); }
  function ui() {
    const pb = $('#pPlay'); if (!pb) return;
    const playing = !audio.paused && !!audio.getAttribute('src');
    pb.innerHTML = playing ? I.pause : I.play;
    pb.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
    const it = Q[qi], now = $('#pNow');
    if (now) now.textContent = it ? (it.b ? 'البسملة' : 'الآية ' + it.n) : 'اضغط ▶ أو على أي آية';
    const rec = $('#pRec'); if (rec) rec.textContent = reciterName() + (S.prefs.repeat > 1 ? ` · المرة ${Math.min(rep + 1, S.prefs.repeat)} من ${S.prefs.repeat}` : '');
    const rb = $('#pRep'); if (rb) rb.textContent = S.prefs.repeat > 1 ? 'تكرار ' + S.prefs.repeat : 'بلا تكرار';
  }
  function mediaMeta() {
    if (!('mediaSession' in navigator) || pageIdx < 0) return;
    const p = DATA.pages[pageIdx], it = Q[qi];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: p.short + (it && !it.b ? ' · الآية ' + it.n : ''), artist: reciterName(), album: 'تحصين',
        artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
      });
    } catch (e) { /* unsupported */ }
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => toggle());
      ms.setActionHandler('pause', () => toggle());
      ms.setActionHandler('nexttrack', () => playAt(Math.min(qi + 1, Q.length - 1)));
      ms.setActionHandler('previoustrack', () => playAt(Math.max(qi - 1, 0)));
    } catch (e) { /* ignore */ }
  }

  /* ---------- page turning ---------- */
  function setFlip(el, x) {
    const p = Math.max(-1, Math.min(1, x / window.innerWidth));
    el.style.transformOrigin = x > 0 ? 'right center' : 'left center';
    el.style.transform = `perspective(1400px) translateX(${x}px) rotateY(${p * -12}deg)`;
    el.style.opacity = String(1 - Math.abs(p) * 0.35);
  }
  function springBack(el) {
    el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1), opacity .28s';
    el.style.transform = ''; el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; }, 300);
  }
  // RTL book: the next page lies to the left, so a finger moving left→right (dx > 0) turns forward.
  function turn(dir) {
    if (turning || !DATA) return;
    const j = dir === 'next' ? pageIdx + 1 : pageIdx - 1;
    if (j < 0 || j >= DATA.pages.length) return;
    turning = true;
    if (dir === 'next') markDone(DATA.pages[pageIdx].id);
    saveScroll();
    const st = $('#stage');
    if (st) {
      st.style.transition = 'transform .24s ease-in, opacity .24s ease-in';
      setFlip(st, (dir === 'next' ? 1 : -1) * window.innerWidth * 1.05);
    }
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } }
    setTimeout(() => { turning = false; enterDir = dir; location.hash = '#/p/' + (j + 1); }, 230);
  }
  function attachSwipe(stage) {
    let g = null;
    stage.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || turning) { g = null; return; }
      const t = e.touches[0]; g = { x: t.clientX, y: t.clientY, t: performance.now(), dx: 0, on: false };
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (!g) return;
      const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.on) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) { g.on = true; stage.classList.add('dragging'); }
        else if (Math.abs(dy) > 12) { g = null; return; }
        else return;
      }
      const canNext = pageIdx < DATA.pages.length - 1, canPrev = pageIdx > 0;
      let x = dx;
      if ((x > 0 && !canNext) || (x < 0 && !canPrev)) x *= 0.25;   // resist at the ends
      g.dx = x; setFlip(stage, x);
    }, { passive: true });
    const end = () => {
      if (!g || !g.on) { g = null; return; }
      stage.classList.remove('dragging');
      const w = window.innerWidth, v = Math.abs(g.dx) / Math.max(1, performance.now() - g.t);
      const dir = g.dx > 0 ? 'next' : 'prev';
      const allowed = dir === 'next' ? pageIdx < DATA.pages.length - 1 : pageIdx > 0;
      if (allowed && (Math.abs(g.dx) > w * 0.22 || (v > 0.6 && Math.abs(g.dx) > 40))) turn(dir);
      else springBack(stage);
      g = null;
    };
    stage.addEventListener('touchend', end);
    stage.addEventListener('touchcancel', end);
  }

  /* ---------- views ---------- */
  function meta(p) {
    if (p.kind === 'dhikr') return 'ذِكر';
    const n = p.parts.reduce((a, pt) => a + pt.ayahs.length, 0);
    return p.sub ? p.sub : ayahWord(n);
  }
  const timerChip = (big) => S.session
    ? `<span class="tchip${S.session.activeMs >= MIN_SESSION_MS ? ' ok' : ''}" data-live${big ? ' style="font-size:16px"' : ''}>${I.clock}<b>${fmtDur(S.session.activeMs)}</b></span>` : '';

  function weekHTML() {
    const names = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
    const days = [];
    for (let k = 6; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - k); days.push(d); }
    const counts = days.map(d => (S.history[dayKey(d)] || { count: 0 }).count);
    const max = Math.max(1, ...counts);
    return '<div class="week" aria-label="قراءات آخر 7 أيام">' + days.map((d, i) =>
      `<div class="${i === 6 ? 'wk-today' : ''}"><em>${counts[i] || ''}</em><i style="height:${Math.round(counts[i] / max * 46) + 4}px"></i><span>${names[d.getDay()]}</span></div>`).join('') + '</div>';
  }

  function renderHome() {
    pageIdx = -1; releaseWake();
    if (!audio.paused) audio.pause();
    const P = DATA.pages, s = S.session, done = new Set(s ? s.done : []);
    const today = (S.history[dayKey()] || { count: 0, ms: 0 });
    const listen = S.prefs.mode === 'listen';
    const due = !S.lastRead || Date.now() - S.lastRead >= REMIND_MS;
    const sess = s ? `
      <section class="box">
        <div class="sess-top"><div><h3>جلسة قراءة جارية</h3><p class="sub">الصفحة ${s.page + 1} من ${P.length} · ${P[s.page].short}</p></div>${timerChip(true)}</div>
        <div class="prog"><i style="width:${Math.round(done.size / P.length * 100)}%"></i></div>
        <p class="sub" style="margin-top:8px">${s.activeMs >= MIN_SESSION_MS ? 'تجاوزت 4 دقائق — ستُحتسب القراءة عند الإتمام.' : 'تُحتسب القراءة إذا تجاوزت مدة الجلسة 4 دقائق.'}</p>
        <div class="row2"><a class="btn gold" href="#/p/${s.page + 1}" id="resumeBtn">أكمل من حيث توقفت</a><button class="btn ghost" id="restartBtn">ابدأ من جديد</button></div>
      </section>` : `
      <section class="box">
        <h3>ابدأ قراءة الرقية</h3><p class="sub">${P.length} صفحات · تُحتسب القراءة إذا تجاوزت 4 دقائق</p>
        <div style="margin-top:12px"><button class="btn gold block" id="startBtn">${listen ? 'ابدأ الاستماع' : 'ابدأ القراءة'}</button></div>
      </section>`;
    app.innerHTML = `
      <header class="apphead">
        <img src="icons/logo-mark.png" alt="شعار تحصين" width="46" height="46">
        <h1 class="goldtxt">تحصين</h1>
        <button class="icon-btn" id="gear" aria-label="الإعدادات">${I.gear}</button>
      </header>
      ${installCard()}
      ${due ? `<div class="remind">${I.bell}<div><b>هل قرأت التحصين؟</b><small>${S.lastRead ? 'آخر قراءة محتسبة ' + ago(Date.now() - S.lastRead) : 'لم تُسجَّل قراءة محتسبة بعد'}</small></div></div>` : ''}
      ${sess}
      <section class="box">
        <div class="stats">
          <div class="big"><div><b>${today.count}</b><small>قراءات اليوم</small></div></div>
          ${weekHTML()}
        </div>
        <div class="statline"><span>المجموع: <b>${S.total || 0}</b></span><span>${S.lastRead ? 'آخر قراءة: <b>' + ago(Date.now() - S.lastRead) + '</b>' : 'لا قراءات بعد'}</span></div>
      </section>
      <div class="modes" role="group" aria-label="طريقة الاستخدام">
        <button class="mode" data-mode="read" aria-pressed="${!listen}"><span class="tag">الأساسي</span>${I.book}<h3>القراءة</h3><p>بخط مصحف المدينة، صفحةً بعد صفحة.</p></button>
        <button class="mode" data-mode="listen" aria-pressed="${listen}">${I.head}<h3>الاستماع</h3><p>تلاوة مع تظليل الآية التي تُتلى.</p></button>
      </div>
      <ol class="index">${P.map((p, i) => `<li class="${done.has(p.id) ? 'done' : ''}"><a href="#/p/${i + 1}">${star(i + 1)}<span class="tt"><b>${p.short}</b><small>${meta(p)}</small></span><span class="chk">${I.check}</span></a></li>`).join('')}</ol>
      <p class="foot">${DATA.source}<br>التلاوات الصوتية من موقع <a href="https://everyayah.com" target="_blank" rel="noopener">EveryAyah</a>.</p>`;
    app.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { S.prefs.mode = b.dataset.mode; save(); renderHome(); }));
    $('#gear').addEventListener('click', openSheet);
    const ib = $('#instBtn'); if (ib) ib.addEventListener('click', doInstall);
    const sb = $('#startBtn'); if (sb) sb.addEventListener('click', startOver);
    const rb = $('#restartBtn'); if (rb) rb.addEventListener('click', () => confirmSheet('البدء من جديد', 'ستبدأ جلسة جديدة من الصفحة الأولى، ويُصفَّر عدّاد الجلسة الحالية دون احتسابها.', 'ابدأ من جديد', startOver));
  }

  function renderPage(i) {
    const P = DATA.pages, p = P[i];
    const keepPlaying = autoStart; autoStart = false;
    if (pageIdx !== i) { if (!keepPlaying) audio.pause(); qi = -1; rep = 0; }
    pageIdx = i;
    ensureSession(i).page = i; save();
    const listen = S.prefs.mode === 'listen';
    Q = buildQueue(p);
    const done = new Set(S.session.done);
    let body, qk = 0;
    if (p.kind === 'dhikr') {
      body = `<article class="card">
        <div class="dhikr-head">${star(i + 1)}<h2 class="goldtxt">${p.title}</h2></div>
        <p class="dhikr"><span class="p">(</span> ${p.text} <span class="p">)</span></p>
        ${listen ? '<p class="note">هذا الذكر يُقرأ بصوتك، ثم انتقل إلى الصفحة التالية.</p>' : ''}
      </article>`;
    } else {
      body = '<article class="card">' + p.parts.map((pt, k) => {
        const whole = pt.from === 1 && pt.to === pt.total;
        const sub = pt.label || (whole ? ayahWord(pt.ayahs.length) : (pt.from === pt.to ? 'الآية ' + pt.from : 'الآيات ' + pt.from + ' – ' + pt.to));
        const lbl = pt.label ? 'color:var(--gold);font-size:18px;' : '';
        let h = k === 0
          ? `<div class="surah-head">${frame}<b class="goldtxt">سورة ${pt.sname}</b></div><p class="part-sub" style="${lbl}">${sub}</p>`
          : `<div class="sep-orn" aria-hidden="true"><i></i><b></b><i></i></div><p class="part-sub" style="margin-top:0;${lbl}">${sub}</p>`;
        if (pt.basmala) h += `<p class="basmala" data-q="${qk++}">${DATA.basmala}</p>`;
        h += '<p class="mushaf">' + pt.ayahs.map(([n, t]) => `<span class="ayah" data-q="${qk++}">${t}&nbsp;<span class="an">۝${arDigits(n)}</span></span>`).join(' ') + '</p>';
        return h;
      }).join('') + '</article>';
    }
    const isLast = i === P.length - 1;
    const hint = i === 0 && !S.session.scroll[0] ? `<p class="swipe-hint">${I.swipe} اسحب الصفحة يميناً أو يساراً للتقليب</p>` : '';
    app.innerHTML = `
      <div class="reader${listen ? ' listen' : ''}">
        <div class="topbar">
          <div class="row">
            <a class="icon-btn" href="#/" aria-label="الرئيسية">${I.home}</a>
            <div class="ttl"><b>${p.title}</b>${timerChip(false)}</div>
            <button class="icon-btn" id="modeBtn" aria-label="${listen ? 'التبديل إلى القراءة' : 'التبديل إلى الاستماع'}">${listen ? I.book : I.head}</button>
            <button class="icon-btn" id="gear" aria-label="الإعدادات">${I.gear}</button>
          </div>
          <div class="bar"><i style="width:${(i + 1) / P.length * 100}%"></i></div>
          <nav class="dots" aria-label="الصفحات">${P.map((q, k) => `<a href="#/p/${k + 1}" class="${k === i ? 'on' : done.has(q.id) ? 'ok' : ''}" aria-label="${q.short}"></a>`).join('')}</nav>
        </div>
        <main id="stage" class="stage${listen ? ' listen' : ''}${enterDir ? ' in-' + enterDir : ''}">${body}${hint}</main>
        ${listen && Q.length ? `<div class="player">
          <div class="prow">
            <div class="info"><b id="pNow"></b><small id="pRec"></small></div>
            <button class="pbtn rep" id="pRep" aria-label="عدد مرات التكرار"></button>
            <div dir="ltr" style="display:flex;gap:6px;align-items:center">
              <button class="pbtn" id="pB" aria-label="الآية السابقة">${I.skipB}</button>
              <button class="pbtn main" id="pPlay" aria-label="تشغيل">${I.play}</button>
              <button class="pbtn" id="pF" aria-label="الآية التالية">${I.skipF}</button>
            </div>
          </div></div>` : ''}
        <nav class="pager">
          <button class="btn ghost" id="prevBtn"${i === 0 ? ' disabled style="opacity:.45"' : ''}>${I.prev} السابق</button>
          <span class="pg">${i + 1} من ${P.length}</span>
          <button class="btn gold" id="nextBtn">${isLast ? 'إتمام الرقية ' + I.check : 'التالي ' + I.next}</button>
        </nav>
      </div>`;
    enterDir = '';

    const stage = $('#stage');
    attachSwipe(stage);
    $('#nextBtn').addEventListener('click', () => { if (isLast) finish(); else turn('next'); });
    $('#prevBtn').addEventListener('click', () => turn('prev'));
    $('#gear').addEventListener('click', openSheet);
    $('#modeBtn').addEventListener('click', () => { S.prefs.mode = listen ? 'read' : 'listen'; save(); audio.pause(); saveScroll(); renderPage(i); restoreScroll(i); });
    if (listen && Q.length) {
      $('#pPlay').addEventListener('click', toggle);
      $('#pF').addEventListener('click', () => playAt(Math.min((qi < 0 ? -1 : qi) + 1, Q.length - 1)));
      $('#pB').addEventListener('click', () => playAt(Math.max(qi - 1, 0)));
      $('#pRep').addEventListener('click', () => { const o = [1, 3, 7]; S.prefs.repeat = o[(o.indexOf(S.prefs.repeat) + 1) % o.length]; save(); ui(); toast(S.prefs.repeat > 1 ? `تكرار الصفحة ${S.prefs.repeat} مرات` : 'بلا تكرار'); });
      stage.addEventListener('click', e => { const el = e.target.closest('[data-q]'); if (el) { rep = 0; playAt(+el.dataset.q); } });
      ui();
      if (keepPlaying) playAt(0);
      else {
        const saved = S.session.ayah[i];
        if (Number.isInteger(saved) && saved >= 0) highlight(saved, false);
      }
    }
    requestWake();
    updateTimer();
  }
  function restoreScroll(i) {
    const y = (S.session && S.session.scroll[i]) || 0;
    const go = () => window.scrollTo(0, y);
    go();
    if (y && document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(go));
  }

  function renderDone() {
    pageIdx = -1; releaseWake();
    const r = S.lastResult;
    const today = (S.history[dayKey()] || { count: 0 }).count;
    if (!r) { location.hash = '#/'; return; }
    app.innerHTML = r.ok ? `<article class="card finish result" style="margin-top:36px">
        <img src="icons/logo-mark.png" alt="" width="104" height="104">
        <h3 class="goldtxt">تقبّل الله منك</h3>
        <p style="font-size:18px;color:var(--ink2);margin:0">تم احتساب القراءة · مدة الجلسة</p>
        <div class="dur">${fmtDur(r.ms)}</div>
        <p style="font-size:18px;margin:0 0 18px">قراءات اليوم: <b class="goldtxt">${today}</b> · المجموع: <b class="goldtxt">${S.total}</b></p>
        <a class="btn gold block" href="#/">العودة إلى الرئيسية</a>
      </article>` : `<article class="card finish result bad" style="margin-top:36px">
        <img src="icons/logo-mark.png" alt="" width="104" height="104">
        <h3 class="goldtxt">لم تُحتسب هذه الجلسة</h3>
        <div class="dur">${fmtDur(r.ms)}</div>
        <p style="font-size:18px;color:var(--ink2);margin:0 0 18px">مدة الجلسة أقل من 4 دقائق، فالغالب أنها فُتحت وأُغلقت بالخطأ أو لم تكتمل القراءة. ابدأ جلسة جديدة لتُحتسب.</p>
        <button class="btn gold block" id="againBtn">ابدأ جلسة جديدة</button>
        <a class="btn ghost block" style="margin-top:10px" href="#/">العودة إلى الرئيسية</a>
      </article>`;
    const a = $('#againBtn'); if (a) a.addEventListener('click', startOver);
  }

  /* ---------- settings sheet ---------- */
  function syncSheet() {
    $('#fsRange').value = S.prefs.fs;
    document.querySelectorAll('#themeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === S.prefs.theme));
    document.querySelectorAll('#repeatSeg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.rep === S.prefs.repeat));
    $('#reciterSel').value = S.prefs.reciter;
    $('#autoChk').checked = !!S.prefs.auto;
    $('#wakeChk').checked = !!S.prefs.wake;
  }
  function openSheet() { syncSheet(); $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false; }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; }
  function initSheet() {
    $('#reciterSel').innerHTML = RECITERS.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    $('#fsRange').addEventListener('input', e => { S.prefs.fs = +e.target.value; applyPrefs(); save(); });
    document.querySelectorAll('[data-fs]').forEach(b => b.addEventListener('click', () => {
      S.prefs.fs = Math.min(1.8, Math.max(0.8, +(S.prefs.fs + (b.dataset.fs === '+' ? 0.1 : -0.1)).toFixed(2))); applyPrefs(); save(); syncSheet();
    }));
    document.querySelectorAll('#themeSeg button').forEach(b => b.addEventListener('click', () => { S.prefs.theme = b.dataset.theme; applyPrefs(); save(); syncSheet(); }));
    document.querySelectorAll('#repeatSeg button').forEach(b => b.addEventListener('click', () => { S.prefs.repeat = +b.dataset.rep; save(); syncSheet(); ui(); }));
    $('#reciterSel').addEventListener('change', e => { S.prefs.reciter = e.target.value; save(); ui(); if (!audio.paused && qi >= 0) playAt(qi); });
    $('#autoChk').addEventListener('change', e => { S.prefs.auto = e.target.checked; save(); });
    $('#wakeChk').addEventListener('change', e => { S.prefs.wake = e.target.checked; save(); if (S.prefs.wake) requestWake(); else releaseWake(); });
    $('#resetBtn').addEventListener('click', () => { closeSheet(); confirmSheet('تصفير الجلسة', 'سيُمسح موضعك الحالي وعدّاد الجلسة دون احتسابها. لا يتأثر سجل القراءات.', 'تصفير', () => { stopAudio(); S.session = null; save(true); toast('تم تصفير الجلسة'); location.hash = '#/'; route(); }); });
    $('#clearHistBtn').addEventListener('click', () => { closeSheet(); confirmSheet('مسح سجل القراءات', 'سيُمسح عدد القراءات اليومية والمجموع نهائياً من هذا الجهاز.', 'مسح', () => { S.history = {}; S.total = 0; S.lastRead = 0; save(true); toast('تم مسح السجل'); route(); }); });
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#sheetBackdrop').addEventListener('click', closeSheet);
    $('#modalBackdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); closeModal(); } });
  }

  /* ---------- router ---------- */
  function route() {
    if (!DATA) return;
    const h = location.hash || '#/';
    const m = h.match(/^#\/p\/(\d+)/);
    if (m) {
      const i = Math.min(Math.max(+m[1] - 1, 0), DATA.pages.length - 1);
      const dir = enterDir;
      renderPage(i);
      if (dir === 'next' && !(S.session.scroll[i] > 0)) window.scrollTo(0, 0); else restoreScroll(i);
    } else if (h === '#/done') renderDone();
    else { renderHome(); window.scrollTo(0, 0); }
  }
  window.addEventListener('hashchange', route);

  document.addEventListener('keydown', e => {
    if (pageIdx < 0 || !$('#sheet').hidden || !$('#modal').hidden || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { const b = $('#nextBtn'); if (b) b.click(); }
    else if (e.key === 'ArrowRight') turn('prev');
    else if (e.key === ' ' && Q.length && S.prefs.mode === 'listen') { e.preventDefault(); toggle(); }
  });
  let scrollT;
  window.addEventListener('scroll', () => { if (pageIdx < 0) return; clearTimeout(scrollT); scrollT = setTimeout(saveScroll, 250); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    lastTick = Date.now();
    if (document.visibilityState === 'hidden') { saveScroll(); save(true); }
    else { requestWake(); if (pageIdx < 0 && DATA && location.hash !== '#/done') renderHome(); }
  });
  window.addEventListener('pagehide', () => { saveScroll(); save(true); });

  /* ---------- boot ---------- */
  applyPrefs();
  initSheet();
  fetch('data/ruqyah.json').then(r => r.json()).then(d => {
    DATA = d;
    if (S.session && S.session.page >= DATA.pages.length) S.session.page = 0;
    const h = location.hash;
    if ((!h || h === '#/' || h === '#') && S.session) history.replaceState(null, '', '#/p/' + (S.session.page + 1));   // resume where you stopped
    route();
    if (isIOS && !standalone() && !S.installSeen) { S.installSeen = Date.now(); save(); setTimeout(iosInstallSheet, 900); }
  }).catch(() => { app.innerHTML = '<p class="note" style="margin-top:40vh">تعذّر تحميل المحتوى. أعد تحميل الصفحة.</p>'; });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {   // a new version took over → show it once
      if (hadController && !reloaded) { reloaded = true; saveScroll(); save(true); location.reload(); }
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
