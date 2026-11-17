(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mobile = matchMedia('(max-width:760px)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

const desk = $('#desk'), dock = $('#dock'), mascot = $('#mascot');
const wins = $$('.win');
const DEFAULT_OPEN = ['w-paint', 'w-clone', 'w-devlog', 'w-games'];
let z = 10;

/* ---------- Dil (TR varsayılan HTML; EN sözlükten) ---------- */
// Dil seçimi <head> içindeki satır içi betikte yapılır (?lang=, kayıtlı tercih, tarayıcı dili).
const I18N = window.GZ_I18N || { tr: {}, en: {} };
const root = document.documentElement;
let lang = root.lang === 'en' ? 'en' : 'tr';
const t = k => { const d = I18N[lang] || {}; return k in d ? d[k] : (I18N.tr || {})[k]; };
const orig = new WeakMap(); // öğe -> özgün Türkçe metin/öznitelikler
const attrPairs = el => (el.dataset.i18nAttr || '').split(',').map(p => p.split(':').map(s => s.trim())).filter(p => p[0] && p[1]);
function translateDom() {
  const dict = lang === 'tr' ? {} : (I18N[lang] || {});
  const pick = (k, fallback) => (k in dict ? dict[k] : fallback);
  $$('[data-i18n],[data-i18n-html],[data-i18n-attr]').forEach(el => {
    let o = orig.get(el);
    if (!o) {
      o = { text: el.textContent, html: el.innerHTML, attrs: {} };
      attrPairs(el).forEach(([a]) => { o.attrs[a] = el.getAttribute(a); });
      orig.set(el, o);
    }
    if (el.dataset.i18n) el.textContent = pick(el.dataset.i18n, o.text);
    else if (el.dataset.i18nHtml) el.innerHTML = pick(el.dataset.i18nHtml, o.html);
    attrPairs(el).forEach(([a, k]) => { const v = pick(k, o.attrs[a]); if (v != null) el.setAttribute(a, v); });
  });
}
function labelControls() {
  $$('.win').forEach(w => {
    const mn = $('.ctl [data-min]', w), mx = $('.ctl [data-max]', w), cl = $('.ctl [data-close]', w);
    if (mn) mn.setAttribute('aria-label', t('win.min'));
    if (mx) mx.setAttribute('aria-label', t(w.classList.contains('max') ? 'win.restore' : 'win.max'));
    if (cl) cl.setAttribute('aria-label', t('win.close'));
  });
}
function applyLangStatic() {
  root.lang = lang;
  translateDom(); labelControls();
  document.title = t('meta.title');
  const md = $('meta[name="description"]'); if (md) md.content = t('meta.desc');
  $$('.lang [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  root.classList.remove('l10n-wait');
}
applyLangStatic();

/* ---------- Açılış ekranı: oturum başına bir kez ---------- */
const boot = $('#boot');
function endBoot() { boot.classList.add('off'); setTimeout(() => boot.remove(), 400); greet(); }
let seen = false;
try { seen = sessionStorage.getItem('gz-boot') === '1'; sessionStorage.setItem('gz-boot', '1'); } catch (e) {}
if (seen || calm.matches) endBoot();
else {
  const lines = t('boot');
  const bar = $('#boot-bar'), line = $('#boot-line');
  let i = 0;
  const tm = setInterval(() => {
    i++; bar.style.width = (i / lines.length * 100) + '%';
    line.textContent = lines[Math.min(i, lines.length - 1)];
    if (i >= lines.length) { clearInterval(tm); setTimeout(endBoot, 250); }
  }, 380);
  boot.addEventListener('click', () => { clearInterval(tm); endBoot(); }, { once: true });
}

/* ---------- Saat ---------- */
const clock = $('#clock');
const tick = () => { const d = new Date(); clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
tick(); setInterval(tick, 15000);

/* ---------- Tema (gece / gündüz) ---------- */
const themeBtn = $('#theme');
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  themeBtn.setAttribute('aria-label', t(th === 'day' ? 'theme.toNight' : 'theme.toDay'));
  const m = $('meta[name="theme-color"]'); if (m) m.content = th === 'day' ? '#efe9ff' : '#1a1036';
}
function toggleTheme() {
  const th = document.documentElement.dataset.theme === 'day' ? 'night' : 'day';
  applyTheme(th); store.set('gz-theme', th);
}
applyTheme(document.documentElement.dataset.theme === 'day' ? 'day' : 'night');
themeBtn.addEventListener('click', toggleTheme);

/* ---------- Pencere yerleşimi ---------- */
const EXTRA_W = { 'w-press': 380, 'w-about': 400, 'w-contact': 380, 'w-locked': 340, 'w-trash': 360 };
function setBox(w, x, y, width, maxH) {
  w.style.left = Math.round(x) + 'px'; w.style.top = Math.round(y) + 'px';
  w.style.width = Math.round(width) + 'px'; w.style.maxHeight = Math.round(Math.max(160, maxH)) + 'px';
}
// Dar masaüstünde (W<1000) devlog görev çubuğuna küçültülür; üst üste binmesin. Eşik geçişinde bir kez uygulanır.
let wasNarrow = null;
function fitDefaults(W) {
  const narrow = W < 1000, dl = $('#w-devlog');
  if (narrow === wasNarrow) return;
  wasNarrow = narrow;
  if (narrow && !dl.hidden && !dl.dataset.moved && !dl.classList.contains('max')) { dl.hidden = true; dl.classList.add('minimized', 'auto'); dl.classList.remove('active'); sync(); }
  else if (!narrow && dl.classList.contains('auto') && dl.classList.contains('minimized')) { dl.hidden = false; dl.classList.remove('minimized'); dl.classList.remove('auto'); sync(); }
}
function layout() {
  if (mobile.matches) return;
  const W = desk.clientWidth, H = desk.clientHeight, g = 14;
  fitDefaults(W);
  const d = desk.getBoundingClientRect(), m = mascot.getBoundingClientRect();
  const mL = Math.min(W, m.left - d.left), mT = Math.min(H, m.top - d.top);
  const box = {};
  if (W >= 1000) {
    const pw = W * 0.355, ph = H * 0.56, cx = pw + g, cw = Math.max(300, mL - g - cx), dx = cx + cw + g;
    box['w-paint'] = [0, 0, pw, ph];
    box['w-games'] = [W * 0.02, ph + g, W * 0.33, H - ph - g];
    box['w-clone'] = [cx, 0, cw, H];
    box['w-devlog'] = [dx, 0, W - dx, mT - g];
  } else {
    const half = (W - g) / 2, ph = H * 0.58;
    box['w-paint'] = [0, 0, half, ph];
    box['w-games'] = [0, ph + g, half, H - ph - g];
    box['w-clone'] = [half + g, 0, half, mT - g];
    box['w-devlog'] = [half + g + 30, 40, half - 30, mT - g - 40];
  }
  let k = 0;
  wins.forEach(w => {
    if (w.classList.contains('max')) return;
    if (w.dataset.moved) { clamp(w); return; }
    if (box[w.id]) { setBox(w, ...box[w.id]); return; }
    const ww = Math.min(EXTRA_W[w.id] || 380, W - 40), off = (k++ % 5) * 26;
    const x = (W - ww) / 2 - 60 + off, y = 40 + off;
    setBox(w, x, y, ww, H - y);
  });
}
function clamp(w) {
  const W = desk.clientWidth, H = desk.clientHeight;
  w.style.left = Math.max(-w.offsetWidth + 80, Math.min(W - 80, w.offsetLeft)) + 'px';
  w.style.top = Math.max(0, Math.min(H - 44, w.offsetTop)) + 'px';
}

/* ---------- Pencere yönetimi ---------- */
const titleOf = w => w.dataset.task || w.getAttribute('aria-label');
const tileHTML = (ic, c) => `<span class="tile" style="--c:${c}"><svg aria-hidden="true"><use href="#${ic}"/></svg></span>`;

function activate(w) {
  wins.forEach(o => o.classList.toggle('active', o === w));
  w.style.zIndex = ++z;
  sync();
}
function open(id, opts = {}) {
  const w = document.getElementById(id); if (!w) return;
  w.hidden = false; w.classList.remove('minimized', 'auto');
  activate(w);
  if (mobile.matches) w.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' });
  if (opts.focus) w.focus({ preventScroll: true });
  if (!opts.noHash && id !== 'w-locked' && history.replaceState) history.replaceState(null, '', '#' + id.slice(2));
}
function close(w) {
  w.hidden = true; w.classList.remove('max', 'minimized', 'active');
  if (location.hash === '#' + w.id.slice(2) && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  sync();
}
function minimize(w) { w.hidden = true; w.classList.add('minimized'); w.classList.remove('active'); sync(); }
function home() {
  wins.forEach(w => {
    delete w.dataset.moved; w.classList.remove('max', 'minimized');
    w.hidden = !DEFAULT_OPEN.includes(w.id);
  });
  wasNarrow = null; layout();
  DEFAULT_OPEN.slice().reverse().map(id => document.getElementById(id)).filter(w => !w.hidden).forEach(activate);
  if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  if (mobile.matches) scrollTo({ top: 0, behavior: calm.matches ? 'auto' : 'smooth' });
}

function sync() {
  // görev çubuğu
  dock.innerHTML = '';
  wins.forEach(w => {
    if (w.hidden && !w.classList.contains('minimized')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = tileHTML(w.dataset.ic, w.style.getPropertyValue('--c')) + '<span></span>';
    b.lastChild.textContent = titleOf(w);
    const on = w.classList.contains('active') && !w.hidden;
    if (on) b.className = 'on';
    if (w.classList.contains('minimized')) { b.className = 'min'; b.title = t('dock.min'); }
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', () => { if (!w.hidden && w.classList.contains('active')) minimize(w); else open(w.id, { noHash: true }); });
    dock.appendChild(b);
  });
  // yan dock: açık pencere göstergesi
  $$('.side [data-open]').forEach(b => {
    const w = document.getElementById(b.dataset.open);
    b.classList.toggle('open', !!w && (!w.hidden || w.classList.contains('minimized')));
  });
}

/* ---------- Tıklamayla açma ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-open]');
  if (t) { closePops(); open(t.dataset.open, { focus: true }); return; }
  if (e.target.closest('[data-home]')) home();
});

/* ---------- Pencere kontrolleri ve sürükleme ---------- */
wins.forEach(w => {
  w.tabIndex = -1;
  w.addEventListener('pointerdown', () => { if (!w.classList.contains('active')) activate(w); });
  $$('[data-close]', w).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); close(w); }));
  const mn = $('[data-min]', w); if (mn) mn.addEventListener('click', e => { e.stopPropagation(); minimize(w); });
  const mx = $('[data-max]', w);
  const toggleMax = () => {
    const on = w.classList.toggle('max');
    if (mx) mx.setAttribute('aria-label', t(on ? 'win.restore' : 'win.max'));
  };
  if (mx) mx.addEventListener('click', e => { e.stopPropagation(); toggleMax(); });
  const tb = $('.tb', w);
  tb.addEventListener('dblclick', e => { if (!e.target.closest('button') && !mobile.matches && mx) toggleMax(); });
  tb.addEventListener('pointerdown', e => {
    if (mobile.matches || e.button !== 0 || e.target.closest('button') || w.classList.contains('max')) return;
    const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop;
    tb.setPointerCapture(e.pointerId);
    const mv = ev => {
      w.dataset.moved = '1';
      w.style.left = Math.max(-w.offsetWidth + 80, Math.min(desk.clientWidth - 80, ev.clientX - sx)) + 'px';
      w.style.top = Math.max(0, Math.min(desk.clientHeight - 44, ev.clientY - sy)) + 'px';
    };
    const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); tb.removeEventListener('pointercancel', up); };
    tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up); tb.addEventListener('pointercancel', up);
  });
});

/* ---------- Oyun filtresi ---------- */
$$('.filters button').forEach(b => b.addEventListener('click', () => {
  $$('.filters button').forEach(o => { o.classList.toggle('on', o === b); o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
  $$('.list li').forEach(li => { li.hidden = b.dataset.f !== 'all' && li.dataset.p !== b.dataset.f; });
}));

/* ---------- Eksik görseller: yer tutucu ---------- */
$$('.hero img, .gal img').forEach(img => {
  const box = img.parentElement;
  const miss = () => box.classList.add('missing');
  img.addEventListener('error', miss);
  img.addEventListener('load', () => box.classList.remove('missing'));
  if (img.complete && img.naturalWidth === 0 && img.getAttribute('loading') !== 'lazy') miss();
});

/* ---------- Görsel büyütme (galeri gezinme) ---------- */
const lb = $('#lb'), lbi = $('img', lb), lbCap = $('#lb-cap'), lbN = $('#lb-n');
let lbList = [], lbIdx = 0, lbReturn = null;
function lbShow(i) {
  lbIdx = (i + lbList.length) % lbList.length;
  const a = lbList[lbIdx], im = $('img', a);
  lbi.src = a.href; lbi.alt = im ? im.alt : '';
  lbCap.textContent = lbi.alt;
  lbN.textContent = lbList.length > 1 ? (lbIdx + 1) + ' / ' + lbList.length : '';
}
function lbOpen(a) {
  lbList = $$('[data-lb]', a.closest('.win') || document);
  lbReturn = a;
  const multi = lbList.length > 1;
  $('.lb-prev', lb).hidden = !multi; $('.lb-next', lb).hidden = !multi;
  lbShow(lbList.indexOf(a));
  lb.hidden = false;
  $('.lb-close', lb).focus();
}
function lbClose() { lb.hidden = true; lbi.removeAttribute('src'); if (lbReturn) lbReturn.focus(); }
$$('[data-lb]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); lbOpen(a); }));
$('.lb-prev', lb).addEventListener('click', () => lbShow(lbIdx - 1));
$('.lb-next', lb).addEventListener('click', () => lbShow(lbIdx + 1));
$('.lb-close', lb).addEventListener('click', lbClose);
lb.addEventListener('click', e => { if (e.target === lb || e.target.tagName === 'FIGURE') lbClose(); });
lb.addEventListener('keydown', e => { // odak tuzağı
  if (e.key !== 'Tab') return;
  const f = $$('button:not([hidden])', lb), i = f.indexOf(document.activeElement);
  e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
});

/* ---------- Arama ---------- */
const q = $('#q'), qList = $('#q-list');
const norm = s => s.toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[âî]/g, m => m === 'â' ? 'a' : 'i');
let entries = [];
function buildEntries() { // etkin dilde aranır
  const cmd = (k, ic, run) => ({ title: t('cmd.' + k), sub: t('cmd.' + k + '.sub'), ic, c: 'var(--accent)', keys: norm(t('cmd.' + k) + ' ' + t('cmd.' + k + '.keys')), run });
  entries = wins.map(w => ({
    title: w.getAttribute('aria-label'), sub: titleOf(w), ic: w.dataset.ic, c: w.style.getPropertyValue('--c'),
    keys: norm(w.getAttribute('aria-label') + ' ' + titleOf(w) + ' ' + ((lang === 'tr' ? w.dataset.keys : t('keys.' + w.id)) || '')),
    run: () => open(w.id, { focus: true })
  })).concat([
    cmd('theme', 'i-sun', toggleTheme),
    cmd('paint', 'i-roller', () => setPaint(true)),
    cmd('home', 'i-home', home),
    cmd('lang', 'i-globe', () => setLang(lang === 'tr' ? 'en' : 'tr', true))
  ]);
}
buildEntries();
let qRes = [], qIdx = 0;
function qRender() {
  const words = norm(q.value.trim()).split(/\s+/).filter(Boolean);
  qRes = entries.filter(en => words.every(w => en.keys.includes(w))).slice(0, 8);
  qIdx = 0;
  qList.innerHTML = '';
  if (!qRes.length) {
    const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('q.none');
    qList.appendChild(li);
  }
  qRes.forEach((en, i) => {
    const li = document.createElement('li');
    li.id = 'q-' + i; li.setAttribute('role', 'option');
    li.innerHTML = tileHTML(en.ic, en.c) + '<span class="t"><b></b><small></small></span>';
    $('b', li).textContent = en.title; $('small', li).textContent = en.sub;
    li.addEventListener('pointerdown', e => e.preventDefault());
    li.addEventListener('click', () => qRun(i));
    li.addEventListener('pointerenter', () => qMark(i));
    qList.appendChild(li);
  });
  qMark(0);
  qList.hidden = false; q.setAttribute('aria-expanded', 'true');
}
function qMark(i) {
  qIdx = i;
  $$('[role=option]', qList).forEach((li, j) => li.setAttribute('aria-selected', j === i ? 'true' : 'false'));
  if (qRes.length) { q.setAttribute('aria-activedescendant', 'q-' + i); const el = $('#q-' + i); if (el) el.scrollIntoView({ block: 'nearest' }); }
  else q.removeAttribute('aria-activedescendant');
}
function qHide() { qList.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); }
function qRun(i) { const en = qRes[i]; if (!en) return; qHide(); q.value = ''; q.blur(); en.run(); }
q.addEventListener('input', qRender);
q.addEventListener('focus', () => { closePops(); qRender(); });
q.addEventListener('blur', () => setTimeout(qHide, 120));
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' && qRes.length) { e.preventDefault(); qMark((qIdx + 1) % qRes.length); }
  else if (e.key === 'ArrowUp' && qRes.length) { e.preventDefault(); qMark((qIdx - 1 + qRes.length) % qRes.length); }
  else if (e.key === 'Enter') { e.preventDefault(); qRun(qIdx); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (q.value) { q.value = ''; qRender(); } else { qHide(); q.blur(); } }
});

/* ---------- Bildirimler ---------- */
const bell = $('#bell'), notes = $('#notes'), notesList = $('#notes-list'), dot = $('.dot', bell);
const logs = $$('#w-devlog p[data-d]');
const latest = logs.length ? logs[0].dataset.d : '';
const seenNote = store.get('gz-seen-note');
function buildNotes() {
  notesList.innerHTML = '';
  logs.slice(0, 4).forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<b></b><span></span>';
    $('b', li).textContent = $('b', p).textContent; $('span', li).textContent = $('span', p).textContent;
    if (i === 0 && seenNote !== latest) li.className = 'new';
    notesList.appendChild(li);
  });
}
buildNotes();
dot.hidden = !latest || seenNote === latest;
function closePops() { notes.hidden = true; bell.setAttribute('aria-expanded', 'false'); }
bell.addEventListener('click', e => {
  e.stopPropagation();
  const show = notes.hidden;
  notes.hidden = !show; bell.setAttribute('aria-expanded', String(show));
  if (show) { dot.hidden = true; store.set('gz-seen-note', latest); }
});
document.addEventListener('pointerdown', e => { if (!notes.hidden && !e.target.closest('.pop-wrap')) closePops(); });

/* ---------- Maskot: piksel yüzler, göz kırpma, sözler ---------- */
const FACES = {
  smile: ['.........', '..#...#..', '..#...#..', '.........', '#.......#', '.#.....#.', '..#####..'],
  blink: ['.........', '.........', '.##...##.', '.........', '#.......#', '.#.....#.', '..#####..'],
  wink:  ['.........', '..#......', '..#...##.', '.........', '#.......#', '.#.....#.', '..#####..'],
  wow:   ['.........', '..#...#..', '..#...#..', '.........', '...###...', '...#.#...', '...###...'],
  happy: ['.........', '..#...#..', '.#.#.#.#.', '.........', '.#######.', '..#...#..', '...###...'],
  love:  ['.#.#.#.#.', '#########', '.###.###.', '..#...#..', '.........', '..#####..', '.........'],
  sleepy:['.........', '.......##', '.###...#.', '......##.', '.........', '..#####..', '.........']
};
const ORDER = ['smile', 'wink', 'happy', 'wow', 'love'];
const quips = () => t('quips'); // i18n.js
const face = $('#face'), bubble = $('#bubble'), mon = $('#mon');
let faceName = 'smile', faceI = 0, quipI = 0, bubbleT = 0;
function draw(name) {
  face.innerHTML = FACES[name].map((row, y) => [...row].map((ch, x) => ch === '.' ? '' : `<rect x="${x * 10}" y="${y * 10}" width="9" height="9" rx="1"/>`).join('')).join('');
}
function setFace(name) { faceName = name; draw(name); }
function say(text, ms = 3600) {
  bubble.textContent = text; bubble.classList.add('show');
  clearTimeout(bubbleT); bubbleT = setTimeout(() => bubble.classList.remove('show'), ms);
}
setFace('smile');
function greet() { setTimeout(() => say(quips()[0], 4200), 500); }
mon.addEventListener('click', () => {
  faceI = (faceI + 1) % ORDER.length; setFace(ORDER[faceI]);
  const qs = quips(); quipI = quipI % (qs.length - 1) + 1; say(qs[quipI]);
});
(function blinkLoop() {
  setTimeout(() => {
    if (!calm.matches && !document.hidden && (faceName === 'smile' || faceName === 'happy' || faceName === 'wow')) {
      const back = faceName; draw('blink'); setTimeout(() => draw(back), 150);
    }
    blinkLoop();
  }, 2600 + Math.random() * 3800);
})();
// uzun süre hareketsizlikte uyuklar
let idleT = 0;
const wake = () => { if (faceName === 'sleepy') setFace(ORDER[faceI]); clearTimeout(idleT); idleT = setTimeout(() => setFace('sleepy'), 60000); };
['pointermove', 'keydown', 'pointerdown'].forEach(ev => addEventListener(ev, wake, { passive: true }));
wake();

/* ---------- Easter egg: masaüstünü rulo ile boya ---------- */
const cv = $('#paint'), ctx = cv.getContext('2d'), roller = $('#roller'), pbar = $('#paintbar');
let color = '#ffcf4a', painting = false, last = null;
function fitCanvas() {
  const r = devicePixelRatio || 1, w = innerWidth, h = innerHeight;
  if (cv.width === Math.round(w * r) && cv.height === Math.round(h * r)) return;
  const old = document.createElement('canvas'); old.width = cv.width; old.height = cv.height;
  if (cv.width) old.getContext('2d').drawImage(cv, 0, 0);
  cv.width = Math.round(w * r); cv.height = Math.round(h * r);
  ctx.setTransform(r, 0, 0, r, 0, 0);
  if (old.width) ctx.drawImage(old, 0, 0, old.width / r, old.height / r);
}
function setPaint(on) {
  painting = on;
  document.body.classList.toggle('painting', on);
  pbar.hidden = !on; roller.setAttribute('aria-pressed', String(on));
  if (on) { fitCanvas(); setFace('happy'); say(t('paint.on')); $('.sw.on', pbar).focus(); }
  else { setFace(ORDER[faceI]); }
}
roller.addEventListener('click', () => setPaint(!painting));
$('#pb-done').addEventListener('click', () => { setPaint(false); roller.focus(); });
$('#pb-clear').addEventListener('click', () => { ctx.clearRect(0, 0, cv.width, cv.height); say(t('paint.clear'), 2200); });
$$('.sw', pbar).forEach(s => s.addEventListener('click', () => {
  color = s.dataset.c;
  $$('.sw', pbar).forEach(o => { o.classList.toggle('on', o === s); o.setAttribute('aria-pressed', String(o === s)); });
}));
function stroke(a, b) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = 28;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.globalAlpha = 0.18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;   // rulo izi
  ctx.beginPath(); ctx.moveTo(a.x - 6, a.y - 6); ctx.lineTo(b.x - 6, b.y - 6); ctx.stroke();
  ctx.globalAlpha = 1;
}
cv.addEventListener('pointerdown', e => {
  if (!painting) return;
  cv.setPointerCapture(e.pointerId); last = { x: e.clientX, y: e.clientY }; stroke(last, { x: last.x + .1, y: last.y });
});
cv.addEventListener('pointermove', e => { if (!last) return; const p = { x: e.clientX, y: e.clientY }; stroke(last, p); last = p; });
['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { last = null; }));

/* ---------- Klavye kısayolları ---------- */
document.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input,textarea,[contenteditable]');
  if (!lb.hidden) {
    if (e.key === 'Escape') lbClose();
    else if (e.key === 'ArrowLeft' && lbList.length > 1) lbShow(lbIdx - 1);
    else if (e.key === 'ArrowRight' && lbList.length > 1) lbShow(lbIdx + 1);
    return;
  }
  if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); q.focus(); q.select(); return; }
  if (e.key === '/' && !typing) { e.preventDefault(); q.focus(); return; }
  if (e.key !== 'Escape' || typing) return;
  if (!notes.hidden) { closePops(); bell.focus(); return; }
  if (painting) { setPaint(false); return; }
  const a = $('.win.active:not([hidden])'); if (a) close(a);
});

/* ---------- Dil değiştirme: anında, sayfa yenilemeden ---------- */
function setLang(l, save) {
  if (l !== 'tr' && l !== 'en') return;
  if (save) {
    store.set('gz-lang', l);
    // ?lang= varsa adresi de güncelle (hash korunur)
    if (/[?&]lang=/.test(location.search) && history.replaceState) {
      const u = new URL(location.href); u.searchParams.set('lang', l);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  }
  if (l === lang) return;
  lang = l;
  applyLangStatic();
  applyTheme(document.documentElement.dataset.theme === 'day' ? 'day' : 'night');
  buildEntries(); buildNotes(); sync();
  clearTimeout(bubbleT); bubble.classList.remove('show'); bubble.textContent = '';
}
$$('.lang [data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang, true)));

/* ---------- Adres çubuğundaki #pencere ile aç (paylaşılabilir bağlantı) ---------- */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
function fromHash() {
  const h = location.hash.slice(1);
  if (h && document.getElementById('w-' + h)) { open('w-' + h, { noHash: true }); return true; }
  return false;
}
layout();
if (!fromHash()) activate(document.getElementById('w-paint'));
addEventListener('hashchange', fromHash);

/* ---------- Yeniden boyutlandırma ---------- */
let rt = 0;
addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { layout(); if (painting) fitCanvas(); }); });
mobile.addEventListener('change', () => { if (!mobile.matches) layout(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
