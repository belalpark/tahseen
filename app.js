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
  const pad3 = n => String(n).padStart(3, '0');
  const arDigits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const ayahWord = n => n === 1 ? 'آية واحدة' : n === 2 ? 'آيتان' : n <= 10 ? n + ' آيات' : n + ' آية';

  /* ---------- state ---------- */
  const KEY = 'tahseen.v1';
  let S = { prefs: { fs: 1, theme: 'dark', mode: 'read', reciter: RECITERS[0].id, repeat: 1, auto: true }, date: dayKey(), done: [], last: 0 };
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j) S = Object.assign({}, S, j, { prefs: Object.assign({}, S.prefs, j.prefs || {}) });
  } catch (e) { /* storage unavailable */ }
  if (S.date !== dayKey()) { S.date = dayKey(); S.done = []; }
  if (!RECITERS.some(r => r.id === S.prefs.reciter)) S.prefs.reciter = RECITERS[0].id;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const markDone = id => { if (!S.done.includes(id)) { S.done.push(id); save(); } };

  let DATA = null;

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
    skipB: '<svg viewBox="0 0 24 24"><path d="M19 5v14L9 12z"/><rect x="5" y="5" width="3" height="14" rx="1"/></svg>'
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
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ---------- audio engine ---------- */
  const audio = new Audio(); audio.preload = 'auto';
  const pre = new Audio(); pre.preload = 'auto';
  let Q = [], qi = -1, rep = 0, pageIdx = -1, autoStart = false;
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
      if (r.top < 90 || r.bottom > vh - 140) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  function playAt(k) {
    if (!Q[k]) return;
    qi = k;
    highlight(k);
    audio.src = urlFor(Q[k]);
    const pr = audio.play();
    if (pr) pr.catch(err => { if (err && err.name !== 'AbortError') { toast('تعذّر تشغيل التلاوة. تحقّق من الاتصال بالإنترنت.'); } ui(); });
    if (Q[k + 1]) pre.src = urlFor(Q[k + 1]);
    mediaMeta(); ui();
  }
  function toggle() {
    if (!Q.length) return;
    if (audio.paused) { if (qi < 0 || !audio.src) playAt(0); else { audio.play().catch(() => {}); } }
    else audio.pause();
    ui();
  }
  function stopAudio() { audio.pause(); audio.removeAttribute('src'); audio.load(); qi = -1; rep = 0; ui(); }
  function onPageEnd() {
    rep++;
    if (rep < S.prefs.repeat) { playAt(0); return; }
    rep = 0;
    markDone(DATA.pages[pageIdx].id);
    const last = pageIdx + 1 >= DATA.pages.length;
    if (last) { location.hash = '#/done'; return; }
    if (S.prefs.auto) {
      autoStart = DATA.pages[pageIdx + 1].kind === 'quran';
      location.hash = '#/p/' + (pageIdx + 2);
    } else { qi = -1; ui(); toast('انتهت تلاوة هذه الصفحة'); }
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
    const it = Q[qi], p = DATA.pages[pageIdx];
    const now = $('#pNow');
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

  /* ---------- views ---------- */
  function meta(p) {
    if (p.kind === 'dhikr') return 'ذِكر';
    const n = p.parts.reduce((a, pt) => a + pt.ayahs.length, 0);
    return p.sub ? p.sub : ayahWord(n);
  }

  function renderHome() {
    pageIdx = -1; Q = []; stopAudio();
    const P = DATA.pages, done = new Set(S.done), n = P.filter(p => done.has(p.id)).length;
    const resume = S.last > 0 && S.last < P.length && n < P.length ? S.last : 0;
    const listen = S.prefs.mode === 'listen';
    app.innerHTML = `
      <header class="hero">
        <img src="icons/logo-mark.png" alt="شعار تحصين" width="132" height="132">
        <h1 class="goldtxt">تحصين</h1>
        <p>الرقية الشرعية · مرتّبة صفحةً صفحة</p>
        <div class="orn" aria-hidden="true"><i></i><b></b><i></i></div>
      </header>
      <div class="modes" role="group" aria-label="طريقة الاستخدام">
        <button class="mode" data-mode="read" aria-pressed="${!listen}"><span class="tag">الأساسي</span>${I.book}<h3>القراءة</h3><p>اقرأ الرقية بخط مصحف المدينة، صفحةً بعد صفحة.</p></button>
        <button class="mode" data-mode="listen" aria-pressed="${listen}">${I.head}<h3>الاستماع</h3><p>استمع للتلاوة مع تظليل الآية التي تُتلى.</p></button>
      </div>
      <div class="cta"><a class="btn gold block" href="#/p/${resume + 1}">${resume ? 'أكمل من «' + P[resume].short + '»' : (listen ? 'ابدأ الاستماع' : 'ابدأ القراءة')}</a></div>
      <div class="today">
        <div class="ring" style="--p:${Math.round(n / P.length * 100)}"><span>${n}/${P.length}</span></div>
        <div style="flex:1"><h4>تقدّم اليوم</h4><p>${n === P.length ? 'أتممت الرقية اليوم، تقبّل الله منك.' : 'يُحفظ تقدّمك تلقائياً ويبدأ من جديد كل يوم.'}</p></div>
        <button class="icon-btn" id="gear" aria-label="الإعدادات">${I.gear}</button>
      </div>
      <ol class="index">${P.map((p, i) => `<li class="${done.has(p.id) ? 'done' : ''}"><a href="#/p/${i + 1}">${star(i + 1)}<span class="tt"><b>${p.short}</b><small>${meta(p)}</small></span><span class="chk">${I.check}</span></a></li>`).join('')}</ol>
      <p class="foot">${DATA.source}<br>التلاوات الصوتية من موقع <a href="https://everyayah.com" target="_blank" rel="noopener">EveryAyah</a>.</p>`;
    app.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { S.prefs.mode = b.dataset.mode; save(); renderHome(); }));
    $('#gear').addEventListener('click', openSheet);
  }

  function renderPage(i) {
    const P = DATA.pages, p = P[i];
    const keepPlaying = autoStart; autoStart = false;
    if (pageIdx !== i) { audio.pause(); qi = -1; rep = 0; }
    pageIdx = i; S.last = i; save();
    const listen = S.prefs.mode === 'listen';
    Q = buildQueue(p);
    const done = new Set(S.done);
    let body, qk = 0;
    if (p.kind === 'dhikr') {
      body = `<article class="card">
        <div class="dhikr-head">${star(i + 1)}<h2 class="goldtxt">${p.title}</h2></div>
        <p class="dhikr"><span class="p">(</span> ${p.text} <span class="p">)</span></p>
        ${listen ? '<p class="note">هذا الذكر يُقرأ بصوتك، ثم انتقل إلى الصفحة التالية لتبدأ التلاوة.</p>' : ''}
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
    app.innerHTML = `
      <div class="topbar">
        <div class="row">
          <a class="icon-btn" href="#/" aria-label="الرئيسية">${I.home}</a>
          <div class="ttl"><b>${p.title}</b><small>الصفحة ${i + 1} من ${P.length}</small></div>
          <button class="icon-btn" id="modeBtn" aria-label="${listen ? 'التبديل إلى القراءة' : 'التبديل إلى الاستماع'}">${listen ? I.book : I.head}</button>
          <button class="icon-btn" id="gear" aria-label="الإعدادات">${I.gear}</button>
        </div>
        <div class="bar"><i style="width:${(i + 1) / P.length * 100}%"></i></div>
        <nav class="dots" aria-label="الصفحات">${P.map((q, k) => `<a href="#/p/${k + 1}" class="${k === i ? 'on' : done.has(q.id) ? 'ok' : ''}" aria-label="${q.short}"></a>`).join('')}</nav>
      </div>
      <main class="${listen ? 'listen' : ''}">${body}</main>
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
      <div class="pager">
        ${i > 0 ? `<a class="btn ghost" href="#/p/${i}">${I.prev} السابق</a>` : '<a class="btn ghost" href="#/">' + I.prev + ' الرئيسية</a>'}
        <button class="btn gold" id="nextBtn">${isLast ? 'إتمام الرقية ' + I.check : 'التالي ' + I.next}</button>
      </div>`;

    $('#nextBtn').addEventListener('click', () => {
      markDone(p.id);
      if (!audio.paused) audio.pause();
      location.hash = isLast ? '#/done' : '#/p/' + (i + 2);
    });
    $('#gear').addEventListener('click', openSheet);
    $('#modeBtn').addEventListener('click', () => { S.prefs.mode = listen ? 'read' : 'listen'; save(); audio.pause(); renderPage(i); });
    if (listen && Q.length) {
      $('#pPlay').addEventListener('click', toggle);
      $('#pF').addEventListener('click', () => playAt(Math.min((qi < 0 ? -1 : qi) + 1, Q.length - 1)));
      $('#pB').addEventListener('click', () => playAt(Math.max(qi - 1, 0)));
      $('#pRep').addEventListener('click', () => { const o = [1, 3, 7]; S.prefs.repeat = o[(o.indexOf(S.prefs.repeat) + 1) % o.length]; save(); ui(); toast(S.prefs.repeat > 1 ? `تكرار الصفحة ${S.prefs.repeat} مرات` : 'بلا تكرار'); });
      app.querySelector('main').addEventListener('click', e => { const el = e.target.closest('[data-q]'); if (el) { rep = 0; playAt(+el.dataset.q); } });
      ui();
      if (keepPlaying) playAt(0);
      else if (qi >= 0) highlight(qi, false);
    }
  }

  function renderDone() {
    pageIdx = -1; Q = []; stopAudio();
    app.innerHTML = `<article class="card finish" style="margin-top:40px">
      <img src="icons/logo-mark.png" alt="" width="110" height="110">
      <h3 class="goldtxt">تقبّل الله منك</h3>
      <p style="font-size:19px;color:var(--ink2);margin:0 0 18px">أتممت الرقية كاملة · ${DATA.pages.length} صفحات</p>
      <a class="btn gold block" href="#/">العودة إلى الرئيسية</a>
      <a class="btn ghost block" style="margin-top:10px" href="#/p/1">البدء من جديد</a>
    </article>`;
  }

  /* ---------- settings sheet ---------- */
  function syncSheet() {
    $('#fsRange').value = S.prefs.fs;
    document.querySelectorAll('#themeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === S.prefs.theme));
    document.querySelectorAll('#repeatSeg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.rep === S.prefs.repeat));
    $('#reciterSel').value = S.prefs.reciter;
    $('#autoChk').checked = !!S.prefs.auto;
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
    $('#reciterSel').addEventListener('change', e => {
      S.prefs.reciter = e.target.value; save(); ui();
      if (!audio.paused && qi >= 0) playAt(qi);
    });
    $('#autoChk').addEventListener('change', e => { S.prefs.auto = e.target.checked; save(); });
    $('#resetBtn').addEventListener('click', () => { S.done = []; S.last = 0; save(); closeSheet(); toast('تم تصفير تقدّم اليوم'); route(); });
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#sheetBackdrop').addEventListener('click', closeSheet);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  }

  /* ---------- router & gestures ---------- */
  function route() {
    if (!DATA) return;
    const h = location.hash || '#/';
    const m = h.match(/^#\/p\/(\d+)/);
    if (m) renderPage(Math.min(Math.max(+m[1] - 1, 0), DATA.pages.length - 1));
    else if (h === '#/done') renderDone();
    else renderHome();
    if (!(m && Q.length && autoStart)) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  document.addEventListener('keydown', e => {
    if (pageIdx < 0 || !$('#sheet').hidden || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { const b = $('#nextBtn'); if (b) b.click(); }
    else if (e.key === 'ArrowRight' && pageIdx > 0) location.hash = '#/p/' + pageIdx;
    else if (e.key === ' ' && Q.length && S.prefs.mode === 'listen') { e.preventDefault(); toggle(); }
  });
  let tx = 0, ty = 0, tt = 0;
  document.addEventListener('touchstart', e => { const t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); }, { passive: true });
  document.addEventListener('touchend', e => {
    if (pageIdx < 0 || !$('#sheet').hidden) return;
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Date.now() - tt > 600 || Math.abs(dx) < 80 || Math.abs(dy) > 50) return;
    if (dx < 0) { const b = $('#nextBtn'); if (b) b.click(); }          // swipe left → next (RTL)
    else if (pageIdx > 0) location.hash = '#/p/' + pageIdx;            // swipe right → previous
  }, { passive: true });

  /* ---------- boot ---------- */
  applyPrefs();
  initSheet();
  fetch('data/ruqyah.json').then(r => r.json()).then(d => { DATA = d; route(); })
    .catch(() => { app.innerHTML = '<p class="note" style="margin-top:40vh">تعذّر تحميل المحتوى. أعد تحميل الصفحة.</p>'; });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {   // a new version took over → show it once
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
