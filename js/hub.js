/* =========================================================================
   hub.js – SouthGames Startseite
   Intro, Spiele-Mosaik, Duell-Bilanz, Verlauf, Name, Umschalten ins Spiel.
   Neues Spiel hinzufügen: unten in GAMES eintragen und ein Modul
   window.Games.<id> mit start(el, hub) und stop() bereitstellen.
   ========================================================================= */
(function () {
  const SITE_NAME = 'SouthGames';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FILTERS = [
    { id: 'alle', name: 'Alle' },
    { id: 'echtzeit', name: 'Echtzeit-Duell' },
    { id: 'reaktion', name: 'Reaktion' },
    { id: 'taktik', name: 'Taktik' },
    { id: 'solo', name: 'Solo' }
  ];

  /* Vorschaubilder der Spiele (eigene Zeichnungen) */
  const ART = {
    airhockey: '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#2453ff"/><rect x="30" y="26" width="260" height="148" rx="26" fill="#16130f"/><rect x="42" y="38" width="236" height="124" rx="18" fill="#f3f6ff"/><line x1="160" y1="38" x2="160" y2="162" stroke="#16130f" stroke-width="4" stroke-dasharray="10 8"/><circle cx="160" cy="100" r="26" fill="none" stroke="#16130f" stroke-width="4"/><circle cx="84" cy="104" r="20" fill="#2453ff" stroke="#16130f" stroke-width="4"/><circle cx="238" cy="88" r="20" fill="#ff3a2a" stroke="#16130f" stroke-width="4"/><circle cx="132" cy="84" r="10" fill="#16130f"/></svg>',
    reaction: '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#ff3a2a"/><g fill="none" stroke="#ffd23f" stroke-width="8" stroke-linecap="round"><path d="M70 60l-30-14M64 100H30M70 140l-30 14M250 60l30-14M256 100h34M250 140l30 14"/></g><rect x="118" y="30" width="84" height="140" rx="22" fill="#16130f"/><circle cx="160" cy="66" r="20" fill="#5a1a14" stroke="#fffaf0" stroke-width="3"/><circle cx="160" cy="134" r="22" fill="#3fe07a" stroke="#fffaf0" stroke-width="4"/><path d="M152 118l14-6-6 14 10-2-16 22 4-16-10 2z" fill="#fffaf0"/></svg>',
    bomber: '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#ff4fa3"/><g fill="#fffaf0" stroke="#16130f" stroke-width="4"><rect x="20" y="20" width="44" height="44"/><rect x="92" y="20" width="44" height="44"/><rect x="236" y="20" width="44" height="44"/><rect x="20" y="136" width="44" height="44"/><rect x="236" y="136" width="44" height="44"/></g><g fill="#c2802d" stroke="#16130f" stroke-width="4"><rect x="164" y="20" width="44" height="44"/><rect x="92" y="136" width="44" height="44"/></g><circle cx="168" cy="118" r="28" fill="#16130f"/><path d="M182 94q12-22 28-14" fill="none" stroke="#16130f" stroke-width="5"/><path d="M214 72l6 8 10-4-4 10 8 6-10 2-2 10-6-8-10 4 4-10-8-6 10-2z" fill="#ffd23f" stroke="#16130f" stroke-width="2"/><rect x="70" y="86" width="30" height="34" rx="8" fill="#2453ff" stroke="#16130f" stroke-width="4"/><rect x="244" y="96" width="30" height="34" rx="8" fill="#ff3a2a" stroke="#16130f" stroke-width="4"/></svg>',
    arena: '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#16130f"/><g fill="#5a4838"><rect y="40" width="320" height="18"/><rect y="20" width="320" height="16" fill="#463829"/></g><g fill="#ffd23f"><circle cx="30" cy="30" r="5"/><circle cx="80" cy="28" r="5"/><circle cx="130" cy="32" r="5"/><circle cx="190" cy="28" r="5"/><circle cx="250" cy="30" r="5"/><circle cx="300" cy="28" r="5"/></g><ellipse cx="160" cy="150" rx="150" ry="44" fill="#d8b277" stroke="#ffd23f" stroke-width="4"/><rect x="92" y="92" width="44" height="56" rx="6" fill="#2453ff" stroke="#ffd23f" stroke-width="4"/><rect x="184" y="92" width="44" height="56" rx="6" fill="#ff3a2a" stroke="#ffd23f" stroke-width="4"/><path d="M140 104l38-20" stroke="#fffaf0" stroke-width="7" stroke-linecap="round"/><path d="M180 112l-32 22" stroke="#cfd6e0" stroke-width="7" stroke-linecap="round"/></svg>',
    zombie: '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#26301c"/><circle cx="262" cy="46" r="24" fill="#fffaf0" stroke="#16130f" stroke-width="4"/><path d="M0 160q80-20 160 0t160 0V200H0z" fill="#3a4a24" stroke="#16130f" stroke-width="4"/><g stroke="#16130f" stroke-width="4"><rect x="180" y="86" width="34" height="38" rx="8" fill="#9bc25a"/><rect x="184" y="122" width="26" height="38" rx="6" fill="#5c4b7a"/><path d="M180 104h-24M214 104h22" stroke-linecap="round"/><rect x="246" y="98" width="30" height="34" rx="8" fill="#9bc25a"/><rect x="250" y="130" width="22" height="32" rx="6" fill="#5c4b7a"/></g><circle cx="191" cy="101" r="4" fill="#ff3a2a"/><circle cx="204" cy="101" r="4" fill="#ff3a2a"/><circle cx="256" cy="112" r="3.5" fill="#ff3a2a"/><circle cx="267" cy="112" r="3.5" fill="#ff3a2a"/><rect x="40" y="96" width="34" height="40" rx="8" fill="#2453ff" stroke="#16130f" stroke-width="4"/><rect x="72" y="110" width="30" height="10" rx="3" fill="#16130f"/><path d="M108 115l22-6v12z" fill="#ffd23f" stroke="#16130f" stroke-width="3"/><path d="M134 115h30" stroke="#ffd23f" stroke-width="4" stroke-dasharray="6 6"/></svg>'
  };

  const GAMES = [
    { id: 'airhockey', title: 'Air-Hockey', live: true, c: '#2453ff', cats: ['echtzeit', 'solo'], info: '1 gegen 1 · Bot · 2 auf 1 Handy' },
    { id: 'reaction', title: 'Reaktionsduell', c: '#ff3a2a', cats: ['reaktion', 'echtzeit'], info: '1 gegen 1' },
    { id: 'bomber', title: 'Mini-Bomber', c: '#ff4fa3', cats: ['echtzeit', 'taktik'], info: '1 gegen 1' },
    { id: 'arena', title: 'Arena-PvP', c: '#16130f', cats: ['echtzeit'], info: '3D · vom Bruder' },
    { id: 'zombie', title: 'Zombie-Shooter', c: '#26301c', cats: ['solo'], info: 'PvE · Wellen' }
  ];

  /* ---------- Speicher auf diesem Gerät ---------- */
  const KEY = 'duellhalle_v1';                 // Name bleibt, damit alte Siege erhalten bleiben
  let store = { name: '', opp: '', stats: {}, history: [] };
  try { const raw = localStorage.getItem(KEY); if (raw) store = Object.assign(store, JSON.parse(raw)); } catch (e) { }
  if (!Array.isArray(store.history)) store.history = [];
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } }

  const hub = {
    intent: null,                                 // z.B. 'bot': Spiel startet direkt im Bot-Modus
    getName: () => store.name || 'Spieler',
    recordResult(game, kind, won, oppName, scoreText) {
      const g = store.stats[game] || (store.stats[game] = {});
      const k = g[kind] || (g[kind] = { w: 0, l: 0 });
      won ? k.w++ : k.l++;
      if (kind === 'online' && oppName) store.opp = String(oppName).slice(0, 20);
      store.history.unshift({ g: game, k: kind, w: !!won, o: String(oppName || (kind === 'bot' ? 'Bot' : '')).slice(0, 20), s: String(scoreText || '').slice(0, 9), t: Date.now() });
      store.history = store.history.slice(0, 20);
      save();
    },
    statsFor(game) { return store.stats[game] || {}; },
    back() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); route(); }
  };
  window.Hub = hub;

  /* ---------- Mosaik ---------- */
  let filter = 'alle';
  function renderFilters() {
    $('#filters').innerHTML = FILTERS.map((f) => `<button class="chip" type="button" data-f="${f.id}" aria-pressed="${f.id === filter}">${f.name}</button>`).join('');
  }
  function renderTiles() {
    const list = GAMES.filter((g) => filter === 'alle' || g.cats.includes(filter));
    $('#grid').innerHTML = list.map((g, i) => {
      const big = g.live && i === 0;
      return `<button class="tile ${big ? 'big' : ''} ${g.live ? '' : 'soon'}" type="button" data-id="${g.id}" style="--c:${g.c};--d:${(i * 0.7).toFixed(1)}s" aria-label="${esc(g.title)}${g.live ? '' : ' (in Arbeit)'}">
        <span class="art" aria-hidden="true">${ART[g.id] || ''}</span>
        ${big ? '<canvas class="demo" aria-hidden="true"></canvas><span class="live"><i></i>Live-Vorschau</span><span class="play">Spielen</span>' : `<span class="badge ${g.live ? 'ok' : ''}">${g.live ? 'Spielbar' : 'Bald'}</span>`}
        <span class="name"><b>${esc(g.title)}</b><span>${esc(g.info)}</span></span>
      </button>`;
    }).join('');
    demo.attach($('#grid canvas.demo'));
  }

  /* ---------- Bilanz und Verlauf ---------- */
  function totals() {
    let w = 0, l = 0;
    for (const g of Object.values(store.stats)) if (g.online) { w += g.online.w; l += g.online.l; }
    return { w, l };
  }
  function initial(n) { return (String(n || '?').trim()[0] || '?').toUpperCase(); }
  function renderScore() {
    const { w, l } = totals();
    $('#myName').textContent = hub.getName();
    $('#myAv').textContent = initial(hub.getName());
    $('#fMeName').textContent = hub.getName();
    $('#fOpName').textContent = store.opp || 'Gegner';
    $('#fMeW').textContent = w; $('#fOpW').textContent = l;
    const sub = $('#heroSub');
    if (!w && !l) sub.textContent = 'Blau gegen Rot. Jedes Duell zählt.';
    else if (w > l) sub.textContent = `${hub.getName()} führt mit ${w - l} ${w - l === 1 ? 'Sieg' : 'Siegen'} Vorsprung.`;
    else if (l > w) sub.textContent = `${store.opp || 'Der Gegner'} führt. Zeit für Rache!`;
    else sub.textContent = 'Gleichstand! Das nächste Duell entscheidet.';
  }
  const GAME_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#fffaf0" stroke="#16130f" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#16130f"/></svg>';
  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'gerade eben'; if (m < 60) return `vor ${m} Min.`;
    const h = Math.round(m / 60); if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24); return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  }
  function renderHistory() {
    const list = store.history.slice(0, 8);
    if (!list.length) { $('#hist').innerHTML = '<li class="empty">Noch keine Duelle. Fordere deinen Bruder heraus!</li>'; return; }
    $('#hist').innerHTML = list.map((h) => {
      const g = GAMES.find((x) => x.id === h.g);
      return `<li><span class="gi" aria-hidden="true">${GAME_ICON}</span>
        <span class="t"><b>${esc(g ? g.title : h.g)} gegen ${esc(h.o || 'Gegner')}</b><small>${h.k === 'online' ? 'Online' : 'Training'} · ${ago(h.t)}</small></span>
        <span class="sc">${esc(h.s)}</span><span class="res ${h.w ? 'w' : 'l'}">${h.w ? 'Sieg' : 'Niederlage'}</span></li>`;
    }).join('');
  }
  function renderAll() { renderScore(); renderHistory(); }

  /* ---------- Live-Vorschau: zwei Bots spielen Air-Hockey ---------- */
  const demo = (() => {
    let cv = null, cx = null, raf = 0, on = false, io = null;
    const T = { w: 1.7, h: 1 }, pr = 0.045, Rp = 0.08;
    let puck = { x: 0.85, y: 0.5, vx: 1.1, vy: 0.6 }, A = { x: 0.2, y: 0.5 }, B = { x: 1.5, y: 0.5 }, last = 0;
    function step(dt) {
      puck.x += puck.vx * dt; puck.y += puck.vy * dt;
      if (puck.y < pr || puck.y > T.h - pr) { puck.vy *= -1; puck.y = Math.max(pr, Math.min(T.h - pr, puck.y)); }
      if (puck.x < pr || puck.x > T.w - pr) {
        if (Math.abs(puck.y - 0.5) < 0.17) { puck = { x: T.w / 2, y: 0.5, vx: (Math.random() < 0.5 ? -1 : 1) * 0.9, vy: (Math.random() - 0.5) * 1.2 }; return; }
        puck.vx *= -1; puck.x = Math.max(pr, Math.min(T.w - pr, puck.x));
      }
      for (const [p, home, dir] of [[A, 0.18, 1], [B, T.w - 0.18, -1]]) {
        const mine = dir > 0 ? puck.x < T.w / 2 : puck.x > T.w / 2;
        const tx = mine ? puck.x - dir * 0.07 : home, ty = mine ? puck.y : 0.5 + (puck.y - 0.5) * 0.5;
        p.x += Math.max(-1.3 * dt, Math.min(1.3 * dt, tx - p.x)); p.y += Math.max(-1.3 * dt, Math.min(1.3 * dt, ty - p.y));
        const dx = puck.x - p.x, dy = puck.y - p.y, d = Math.hypot(dx, dy);
        if (d < pr + Rp && d > 0) { const nx = dx / d, ny = dy / d; puck.x = p.x + nx * (pr + Rp); puck.y = p.y + ny * (pr + Rp); const sp = 1.6 + Math.random() * 0.8; puck.vx = nx * sp + dir * 0.4; puck.vy = ny * sp; }
      }
      puck.vx *= 0.999; puck.vy *= 0.999;
    }
    function draw() {
      const W = cv.clientWidth, H = cv.clientHeight, d = Math.min(devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(W * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      cx.setTransform(d, 0, 0, d, 0, 0); cx.fillStyle = '#2453ff'; cx.fillRect(0, 0, W, H);
      const s = Math.min((W - 30) / T.w, (H - 30) / T.h), ox = (W - T.w * s) / 2, oy = (H - T.h * s) / 2 - H * 0.04;
      cx.fillStyle = '#16130f'; rr(ox - 10, oy - 10, T.w * s + 20, T.h * s + 20, 24); cx.fill();
      cx.fillStyle = '#f3f6ff'; rr(ox, oy, T.w * s, T.h * s, 16); cx.fill();
      cx.strokeStyle = '#16130f'; cx.lineWidth = 3; cx.setLineDash([9, 7]); cx.beginPath(); cx.moveTo(ox + T.w * s / 2, oy); cx.lineTo(ox + T.w * s / 2, oy + T.h * s); cx.stroke(); cx.setLineDash([]);
      cx.beginPath(); cx.arc(ox + T.w * s / 2, oy + T.h * s / 2, 0.15 * s, 0, 7); cx.stroke();
      cx.fillStyle = '#2a2520'; cx.fillRect(ox - 10, oy + (0.5 - 0.17) * s, 8, 0.34 * s); cx.fillRect(ox + T.w * s + 2, oy + (0.5 - 0.17) * s, 8, 0.34 * s);
      const pad = (p, c) => { cx.fillStyle = c; cx.strokeStyle = '#16130f'; cx.lineWidth = 3; cx.beginPath(); cx.arc(ox + p.x * s, oy + p.y * s, Rp * s, 0, 7); cx.fill(); cx.stroke(); cx.beginPath(); cx.arc(ox + p.x * s, oy + p.y * s, Rp * s * 0.45, 0, 7); cx.stroke(); };
      pad(A, '#2453ff'); pad(B, '#ff3a2a');
      cx.fillStyle = '#16130f'; cx.beginPath(); cx.arc(ox + puck.x * s, oy + puck.y * s, pr * s, 0, 7); cx.fill();
      cx.strokeStyle = '#fffaf0'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(ox + puck.x * s, oy + puck.y * s, pr * s * 0.55, 0, 7); cx.stroke();
    }
    function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
    function loop(t) { if (!on) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.033, (t - last) / 1000 || 0.016); last = t; step(dt); draw(); }
    function setOn(v) { if (v === on) return; on = v; cancelAnimationFrame(raf); if (on) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    return {
      attach(c) {
        setOn(false); if (io) io.disconnect(); cv = c; if (!cv) return; cx = cv.getContext('2d');
        if (reduced) { requestAnimationFrame(draw); return; }
        io = new IntersectionObserver((e) => setOn(e[0].isIntersecting && !$('#hub').hidden)); io.observe(cv);
      },
      pause() { setOn(false); },
      resume() { if (cv && !reduced) setOn(true); }
    };
  })();

  /* ---------- Schneefall ---------- */
  function snow(g, n, w, h, r0) {
    if (!g || reduced) return;
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, r = r0 * (0.6 + Math.random() * 0.8), dur = 6 + Math.random() * 8, del = -Math.random() * dur;
      s += `<circle class="flake" cx="${x.toFixed(1)}" cy="${(-r).toFixed(1)}" r="${r.toFixed(1)}" style="animation-duration:${dur.toFixed(1)}s;animation-delay:${del.toFixed(1)}s"/>`;
    }
    g.innerHTML = s;
  }

  /* ---------- Titelbild an schmale Handys anpassen ---------- */
  function fitScenes() {
    const narrow = innerWidth < 600 && innerHeight > innerWidth;
    const hero = document.querySelector('.hero .scene');
    if (hero) {
      hero.setAttribute('viewBox', narrow ? '270 40 660 460' : '0 0 1200 500');
      hero.setAttribute('preserveAspectRatio', narrow ? 'xMidYMax meet' : 'xMidYMax slice');
    }
    const intro = document.querySelector('.intro-scene');
    if (intro) intro.setAttribute('preserveAspectRatio', narrow ? 'xMidYMid meet' : 'xMidYMid slice');
  }
  addEventListener('resize', fitScenes);
  fitScenes();

  /* ---------- Schnee über der ganzen Seite ---------- */
  const snowfall = (() => {
    const cv = $('#snowfall'); if (!cv || reduced) return { pause() { }, resume() { } };
    const cx = cv.getContext('2d'); let flakes = [], raf = 0, on = false, last = 0, W = 0, H = 0, d = 1;
    function size() {
      d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      const n = Math.round(Math.min(90, W * H / 14000));
      flakes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1.2 + Math.random() * 2.8, s: 18 + Math.random() * 40, w: Math.random() * 6.28 }));
    }
    function loop(t) {
      if (!on) return; raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      cx.setTransform(d, 0, 0, d, 0, 0); cx.clearRect(0, 0, W, H);
      cx.fillStyle = 'rgba(255,255,255,.9)'; cx.strokeStyle = 'rgba(22,19,15,.35)'; cx.lineWidth = 1;
      for (const f of flakes) {
        f.y += f.s * dt; f.w += dt; f.x += Math.sin(f.w) * 12 * dt;
        if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
        cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 6.29); cx.fill(); cx.stroke();
      }
    }
    addEventListener('resize', size); size();
    return {
      pause() { on = false; cancelAnimationFrame(raf); cx.clearRect(0, 0, cv.width, cv.height); },
      resume() { if (on) return; on = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    };
  })();

  /* ---------- Frosti, der Schneemann: redet mit euch ---------- */
  const frosti = (() => {
    const el = $('#frosti'), bub = $('#bubble'), txt = $('#bubbleTxt');
    let hideT = 0, talkT = 0, idleT = 0, muted = false, lastLine = '';
    try { muted = localStorage.getItem('sg_frosti_mini') === '1'; } catch (e) { }
    const pick = (a) => { let l; do { l = a[Math.floor(Math.random() * a.length)]; } while (a.length > 1 && l === lastLine); lastLine = l; return l; };
    const name = () => hub.getName(), opp = () => store.opp || 'dein Bruder';
    const LINES = {
      hello: () => [`Na, ${name()}! Bereit, ${opp()} fertigzumachen?`, `Hey ${name()}! Ich bin Frosti. Mir ist kalt, also zock schnell was.`, `${name()} ist da! Die Halle zittert schon.`],
      tap: () => ['Hör auf, mich zu pieksen, ich schmelze sonst!', 'Wusstest du? Schneemänner können keine Tore schießen. Ich hab keine Beine.', 'Mein Lieblingsspiel? Schneeballschlacht. Kommt bald. Vielleicht.', `Wetten, ${opp()} hat heimlich geübt?`, 'Ich bin nicht dick, ich bin nur aus drei Kugeln gebaut.', 'Wer verliert, muss mir eine neue Karotte kaufen.', 'Brrr. Spielt endlich was, mir frieren die Knöpfe ab!'],
      idle: () => ['Hallo? Ist hier jemand? Air-Hockey wartet!', 'Langweilig … Tippt doch mal auf das große Spiel.', `${opp()} hat gesagt, du traust dich nicht. Nur so.`, 'Ich zähl schon mal die Tore. 1 … 2 …'],
      airhockey: ['Air-Hockey! Schnell, laut, gemein. Mein Favorit.', 'Tipp: Über die Bande spielen. Das hasst jeder.'],
      reaction: ['Reaktionsduell kommt bald. Ich bin jetzt schon zu langsam.'],
      bomber: ['Mini-Bomber? Bitte nicht in meiner Nähe, ich bin aus Schnee!'],
      arena: ['Arena-PvP baut dein Bruder. Ich hab gehört, es wird brutal.'],
      zombie: ['Zombies? Die fressen nur Gehirne. Ich hab keins. Glück gehabt.'],
      win: (h) => [`Sauber! ${h.s} gegen ${h.o}. Die Halle tobt!`, `Gewonnen! ${h.o} braucht jetzt erstmal eine Decke.`],
      loss: (h) => [`Autsch, ${h.s}. ${h.o} feiert gerade. Revanche?`, `Verloren … Ich hab nichts gesehen. Nochmal?`],
      lead: (w, l) => [`${w} zu ${l} für dich. ${opp()} sollte langsam nervös werden.`],
      behind: (w, l) => [`${w} zu ${l}. Hmm. Vielleicht mal üben gegen den Bot?`]
    };
    function say(line, ms = 4800) {
      if (!line || el.hidden) return;
      if (muted) { muted = false; el.classList.remove('mini'); try { localStorage.removeItem('sg_frosti_mini'); } catch (e) { } }
      txt.textContent = line; bub.classList.add('show'); el.classList.add('talk');
      clearTimeout(hideT); clearTimeout(talkT);
      talkT = setTimeout(() => el.classList.remove('talk'), Math.min(2600, 60 * line.length));
      hideT = setTimeout(() => bub.classList.remove('show'), ms);
      armIdle();
    }
    function armIdle() { clearTimeout(idleT); idleT = setTimeout(() => { if (!muted && !$('#hub').hidden) say(pick(LINES.idle())); }, 28000); }
    function mini(v) { muted = v; el.classList.toggle('mini', v); bub.classList.remove('show'); try { v ? localStorage.setItem('sg_frosti_mini', '1') : localStorage.removeItem('sg_frosti_mini'); } catch (e) { } }
    $('#frostiBtn').addEventListener('click', () => say(pick(LINES.tap())));
    $('#bubbleX').addEventListener('click', () => mini(true));
    let hoverT = 0, lastHover = '';
    $('#grid').addEventListener('pointerover', (e) => {
      const t = e.target.closest('.tile'); if (!t || t.dataset.id === lastHover || muted) return;
      lastHover = t.dataset.id; clearTimeout(hoverT);
      hoverT = setTimeout(() => { const l = LINES[t.dataset.id]; if (l) say(pick(l)); }, 350);
    });
    let seenHist = store.history.length ? store.history[0].t : 0;
    return {
      start() {
        el.hidden = false; if (muted) el.classList.add('mini');
        setTimeout(() => { if (!muted) say(pick(LINES.hello())); }, 700);
      },
      back() {
        if (el.hidden) { this.start(); return; }
        const h = store.history[0];
        if (h && h.t !== seenHist) { seenHist = h.t; setTimeout(() => say(pick(h.w ? LINES.win(h) : LINES.loss(h)), 6000), 500); return; }
        const { w, l } = totals();
        if (w + l > 0 && Math.random() < 0.5) setTimeout(() => say(pick(w >= l ? LINES.lead(w, l) : LINES.behind(w, l))), 600);
      }
    };
  })();

  /* ---------- Intro ---------- */
  let ac = null;
  function boom() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.4);
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.5);
      const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.type = 'square';
      o2.frequency.setValueAtTime(660, t + 0.12); o2.frequency.setValueAtTime(880, t + 0.22);
      g2.gain.setValueAtTime(0.0001, t); g2.gain.setValueAtTime(0.08, t + 0.12); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o2.connect(g2).connect(ac.destination); o2.start(t); o2.stop(t + 0.5);
    } catch (e) { }
    try { navigator.vibrate && navigator.vibrate(80); } catch (e) { }
  }
  function showIntro() {
    let seen = false;
    try { seen = sessionStorage.getItem('sg_intro') === '1'; } catch (e) { }
    if (seen || location.hash) return;
    const el = $('#intro'); el.hidden = false;
    snow(el.querySelector('.snow'), 40, 400, 300, 2.2);
    const btn = $('#buzzer');
    setTimeout(() => btn.focus({ preventScroll: true }), reduced ? 0 : 2800);
    btn.addEventListener('click', () => {
      try { sessionStorage.setItem('sg_intro', '1'); } catch (e) { }
      boom(); el.classList.add('go');
      setTimeout(() => el.classList.add('out'), reduced ? 0 : 380);
      setTimeout(() => { el.hidden = true; if (!store.name) askName(true); else frosti.start(); }, reduced ? 50 : 850);
    }, { once: true });
    return true;
  }

  /* ---------- Name ändern ---------- */
  function askName(first) {
    const el = document.createElement('div');
    el.className = 'sheet';
    el.innerHTML = `<form class="box"><h3>${first ? 'Wie heißt du?' : 'Name ändern'}</h3>
      <input class="field" id="nameIn" maxlength="16" autocomplete="nickname" placeholder="Dein Name">
      <div class="row">${first ? '' : '<button class="btn" type="button" data-x>Abbrechen</button>'}<button class="btn main" type="submit">Speichern</button></div></form>`;
    document.body.appendChild(el);
    const inp = el.querySelector('#nameIn');
    inp.value = store.name;
    setTimeout(() => inp.focus(), 50);
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = inp.value.trim().slice(0, 16);
      if (!v) { inp.focus(); return; }
      store.name = v; save(); el.remove(); renderAll();
      if (first) frosti.start();
    });
    const x = el.querySelector('[data-x]'); if (x) x.onclick = () => el.remove();
  }

  /* ---------- Umschalten zwischen Startseite und Spiel ---------- */
  let current = null;
  function route() {
    const id = location.hash.slice(1);
    const game = GAMES.find((g) => g.id === id && g.live);
    const mod = game && window.Games && window.Games[id];
    if (current && (!mod || current !== mod)) { try { current.stop(); } catch (e) { console.error(e); } current = null; $('#game').innerHTML = ''; }
    if (mod) {
      $('#hub').hidden = true; $('#game').hidden = false; demo.pause(); snowfall.pause();
      if (!current) { current = mod; mod.start($('#game'), hub); hub.intent = null; }
    } else {
      const wasGame = !$('#game').hidden;
      $('#game').hidden = true; $('#hub').hidden = false; renderAll(); demo.resume(); snowfall.resume();
      if (wasGame) frosti.back();
    }
  }
  function open(id, intent) { hub.intent = intent || null; location.hash = id; }

  let toastT = 0;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'g-net'; t.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;font-size:15px;padding:8px 16px'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1800);
  }

  /* ---------- Start ---------- */
  document.title = SITE_NAME;
  renderFilters(); renderTiles(); renderAll();
  snow(document.querySelector('.hero-snow'), 46, 1200, 500, 4);
  $('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; renderFilters(); renderTiles(); });
  $('#grid').addEventListener('click', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    const g = GAMES.find((x) => x.id === t.dataset.id);
    if (g && g.live) open(g.id); else toast(`${g ? g.title : 'Das Spiel'} ist noch in Arbeit.`);
  });
  $('#quickPlay').onclick = () => open('airhockey');
  $('#quickBot').onclick = () => open('airhockey', 'bot');
  $('#editName').onclick = () => askName(false);
  addEventListener('hashchange', route);
  route();
  const introShown = showIntro();
  if (!introShown) { if (!store.name) askName(true); else if (!location.hash) frosti.start(); }
})();
