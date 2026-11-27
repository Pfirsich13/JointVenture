/* =========================================================================
   Air-Hockey – JointVenture
   -------------------------------------------------------------------------
   Modi: online (2 Handys), gegen Bot, zu zweit auf einem Handy.
   Koordinaten: Tisch ist W x H Einheiten. "b" = unten (Gastgeber),
   "t" = oben (Gast). Jeder sieht sein eigenes Tor unten.

   Online-Prinzip: Wer die Scheibe auf seiner Hälfte hat, berechnet sie
   ("Besitzer"). So fühlt sich jeder Schlag sofort an. Beim Überqueren der
   Mittellinie wird der Besitz übergeben. Tore erkennt der Besitzer.
   ========================================================================= */
(function () {
  /* ===== Werteliste: hier lässt sich das Spielgefühl einstellen ===== */
  const CFG = {
    W: 1, H: 1.7,            // Tischgröße
    puckR: 0.042,            // Scheibe
    padR: 0.075,             // Schläger
    goalW: 0.34,             // Torbreite
    maxSpeed: 3.6,           // Höchsttempo der Scheibe
    padMaxSpeed: 8,          // Höchsttempo der Schläger
    friction: 0.22,          // Bremsen der Scheibe pro Sekunde
    wallBounce: 0.88,        // Abprall an der Bande
    hitBounce: 0.92,         // Abprall am Schläger
    winScore: 7,             // Tore zum Sieg
    sendHz: 30,              // Nachrichten pro Sekunde (Claude-Raum)
    sendHzP2P: 45,           // Nachrichten pro Sekunde (direkt Handy zu Handy)
    goalPause: 1.4,          // Pause nach einem Tor (Sekunden)
    countdown: 3,            // Countdown vor dem Anpfiff
    fingerOffset: 0.035,     // Schläger sitzt etwas über dem Finger
    botSpeed: 1.9            // Tempo des Bots (höher = schwerer)
  };
  const W = CFG.W, H = CFG.H;

  let root, hub, canvas, ctx, dpr = 1, raf = 0, alive = false;
  let ui = {};
  let mode = null;            // 'online' | 'bot' | 'local'
  let myRole = 'b';
  let conn = null, oppName = 'Gegner', sendAcc = 0, testSteer = null;
  let now = 0, lastT = 0;

  /* ---------- Spielzustand ---------- */
  let puck, pads, score, phase, phaseUntil, owner;
  let gs = 0, rm = 0, recorded = -1;
  // Online-Scheibe: "Epoche" zählt jeden Besitzerwechsel, q nummeriert die Nachrichten darin
  let epoch = 0, q = 0, lastQ = 0, handoffUntil = 0;
  let latency = 0.05, lastRxT = 0, lastRxLocal = 0;     // gemessene Verzögerung (eine Richtung, Sekunden)
  // Puffer mit echten Positionen vom anderen Handy (für ruckelfreie Anzeige auf seiner Hälfte)
  const snaps = []; let clockOff = null;
  const RENDER_DELAY = 0.07;                              // so weit (s) zeigen wir die gegnerische Seite "in der Vergangenheit"
  let rPuck = { x: 0.5, y: H / 2 };     // gezeichnete (geglättete) Scheibe
  const trail = [], rings = [];
  let shake = 0, flash = null, lastHitSnd = 0;
  const pointers = new Map();

  function freshPad(side) { return { x: W / 2, y: side === 'b' ? H - 0.2 : 0.2, vx: 0, vy: 0, tx: W / 2, ty: side === 'b' ? H - 0.2 : 0.2, side }; }
  function servePuck(side) { puck = { x: W / 2, y: side === 'b' ? H * 0.66 : H * 0.34, vx: 0, vy: 0 }; owner = side; rPuck.x = puck.x; rPuck.y = puck.y; trail.length = 0; }
  function resetMatch() {
    score = { b: 0, t: 0 };
    pads = { b: freshPad('b'), t: freshPad('t') };
    servePuck('b');
    epoch = 0; q = 0; lastQ = 0; handoffUntil = 0; snaps.length = 0;
    phase = 'count'; phaseUntil = now + CFG.countdown;
  }
  const other = (s) => (s === 'b' ? 't' : 'b');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ctrlSides = () => (mode === 'local' ? ['b', 't'] : [myRole]);

  /* ---------- Ton und Vibration ---------- */
  let ac = null;
  function unlockAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  }
  function snd(freq, dur = 0.06, type = 'square', vol = 0.07, slide = 0) {
    if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { }
  }
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };

  /* ---------- Physik ---------- */
  function limitSpeed(p) {
    const s = Math.hypot(p.vx, p.vy);
    if (s > CFG.maxSpeed) { p.vx *= CFG.maxSpeed / s; p.vy *= CFG.maxSpeed / s; }
  }
  function hitPad(p, pad) {
    const R = CFG.puckR + CFG.padR;
    let dx = p.x - pad.x, dy = p.y - pad.y, d = Math.hypot(dx, dy);
    if (d >= R) return false;
    if (d < 1e-6) { dx = 0; dy = pad.side === 'b' ? -1 : 1; d = 1; }
    const nx = dx / d, ny = dy / d;
    p.x = pad.x + nx * R; p.y = pad.y + ny * R;
    const rvx = p.vx - pad.vx, rvy = p.vy - pad.vy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      p.vx -= (1 + CFG.hitBounce) * vn * nx; p.vy -= (1 + CFG.hitBounce) * vn * ny;
      limitSpeed(p);
      const strength = Math.min(1, -vn / CFG.maxSpeed);
      if (now - lastHitSnd > 0.05) { lastHitSnd = now; snd(320 + strength * 500, 0.05, 'triangle', 0.08 + strength * 0.08); if (ctrlSides().includes(pad.side)) buzz(10 + strength * 20); }
      rings.push({ x: p.x, y: p.y, t: now, c: pad.side === myRole || (mode === 'local' && pad.side === 'b') ? '#4c7dff' : '#ff4d5e', big: strength });
      if (strength > 0.6) shake = Math.max(shake, 4 * strength);
    }
    return true;
  }
  function hitPost(p, px, py) {
    const r = CFG.puckR, dx = p.x - px, dy = p.y - py, d = Math.hypot(dx, dy);
    if (d >= r || d < 1e-6) return;
    const nx = dx / d, ny = dy / d; p.x = px + nx * r; p.y = py + ny * r;
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) { p.vx -= (1 + CFG.wallBounce) * vn * nx; p.vy -= (1 + CFG.wallBounce) * vn * ny; }
  }
  /* Bewegt die Scheibe. withPads: mit Schlägern rechnen. canGoal: Tore zählen.
     Gibt die Seite zurück, die ein Tor kassiert hat, sonst null. */
  function stepPuck(p, dt, withPads, canGoal) {
    const sp = Math.hypot(p.vx, p.vy);
    const n = clamp(Math.ceil((sp * dt) / (CFG.puckR * 0.5)), 1, 16), h = dt / n, r = CFG.puckR;
    const g0 = W / 2 - CFG.goalW / 2, g1 = W / 2 + CFG.goalW / 2;
    for (let i = 0; i < n; i++) {
      p.x += p.vx * h; p.y += p.vy * h;
      const inMouth = p.x > g0 && p.x < g1;
      if (p.y < r || p.y > H - r) {
        if (inMouth) {
          if (p.x < g0 + r) { p.x = g0 + r; p.vx = Math.abs(p.vx) * CFG.wallBounce; }
          if (p.x > g1 - r) { p.x = g1 - r; p.vx = -Math.abs(p.vx) * CFG.wallBounce; }
          if (p.y < -r) { if (canGoal) return 't'; p.y = -r; p.vx = p.vy = 0; }
          if (p.y > H + r) { if (canGoal) return 'b'; p.y = H + r; p.vx = p.vy = 0; }
        } else {
          if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy) * CFG.wallBounce; wallSnd(p); }
          if (p.y > H - r) { p.y = H - r; p.vy = -Math.abs(p.vy) * CFG.wallBounce; wallSnd(p); }
        }
      }
      if (p.y > -r && p.y < H + r) {
        if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx) * CFG.wallBounce; wallSnd(p); }
        if (p.x > W - r) { p.x = W - r; p.vx = -Math.abs(p.vx) * CFG.wallBounce; wallSnd(p); }
      }
      hitPost(p, g0, 0); hitPost(p, g1, 0); hitPost(p, g0, H); hitPost(p, g1, H);
      if (withPads) { hitPad(p, pads.b); hitPad(p, pads.t); }
    }
    const f = Math.exp(-CFG.friction * dt); p.vx *= f; p.vy *= f;
    if (Math.abs(p.vx) < 1e-4) p.vx = 0; if (Math.abs(p.vy) < 1e-4) p.vy = 0;
    keepInside(p);
    if (withPads) { yieldPad(p, pads.b); yieldPad(p, pads.t); }
    return null;
  }
  /* Scheibe darf nie aus dem Tisch gedrückt werden (außer ins Tor) */
  function keepInside(p) {
    const r = CFG.puckR, g0 = W / 2 - CFG.goalW / 2, g1 = W / 2 + CFG.goalW / 2;
    p.x = clamp(p.x, r, W - r);
    if (!(p.x > g0 && p.x < g1)) p.y = clamp(p.y, r, H - r);
  }
  /* Wird die Scheibe gegen die Bande gequetscht, weicht der Schläger aus */
  function yieldPad(p, pad) {
    const R = CFG.puckR + CFG.padR, dx = pad.x - p.x, dy = pad.y - p.y, d = Math.hypot(dx, dy);
    if (d >= R - 1e-4) return;
    const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : (pad.side === 'b' ? 1 : -1);
    pad.x = p.x + nx * R; pad.y = p.y + ny * R;
  }
  let lastWallSnd = 0;
  function wallSnd(p) { if (now - lastWallSnd > 0.07 && Math.hypot(p.vx, p.vy) > 0.4) { lastWallSnd = now; snd(180, 0.04, 'square', 0.04); } }

  /* ---------- Schläger ---------- */
  function clampPad(pad, x, y) {
    const R = CFG.padR;
    x = clamp(x, R, W - R);
    y = pad.side === 'b' ? clamp(y, H / 2 + R * 0.4, H - R) : clamp(y, R, H / 2 - R * 0.4);
    return [x, y];
  }
  function movePad(pad, dt, maxSpeed) {
    const [tx, ty] = clampPad(pad, pad.tx, pad.ty);
    let dx = tx - pad.x, dy = ty - pad.y; const d = Math.hypot(dx, dy), m = maxSpeed * dt;
    if (d > m) { dx *= m / d; dy *= m / d; }
    const nvx = dx / Math.max(dt, 1e-3), nvy = dy / Math.max(dt, 1e-3);
    pad.vx = pad.vx * 0.4 + nvx * 0.6; pad.vy = pad.vy * 0.4 + nvy * 0.6;
    pad.x += dx; pad.y += dy;
  }

  /* ---------- Bot ---------- */
  const bot = { aimX: 0.5, strikeUntil: 0, lastHalf: false };
  function botThink() {
    const p = pads.t, k = puck, R = CFG.padR + CFG.puckR;
    const onMyHalf = k.y < H / 2 + 0.02;
    if (onMyHalf && !bot.lastHalf) {
      // neues Ziel wählen: direkt aufs Tor oder über die Bande
      const r = Math.random();
      bot.aimX = r < 0.45 ? W / 2 + (Math.random() - 0.5) * CFG.goalW * 0.6 : (r < 0.72 ? -W * 0.55 : W * 1.55);
    }
    bot.lastHalf = onMyHalf;
    if (onMyHalf && !(k.vy > 1.4 && k.y > p.y)) {
      // Linie vom Ziel durch die Scheibe: dahinter stellen, dann durchziehen
      let dx = k.x - bot.aimX, dy = k.y - H; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const bx = k.x + dx * R * 1.1, by = k.y + dy * R * 1.1;
      if (now < bot.strikeUntil) { p.tx = k.x - dx * 0.18; p.ty = k.y - dy * 0.18; }
      else if (Math.hypot(p.x - bx, p.y - by) < 0.035 || by < CFG.padR) { bot.strikeUntil = now + 0.22; }
      else if (p.y > k.y - 0.01) { p.tx = k.x + (k.x < p.x ? 0.14 : -0.14); p.ty = k.y - 0.14; }  // um die Scheibe herum
      else { p.tx = bx; p.ty = by; }
    } else {
      let ix = k.x;                                     // Weg der Scheibe vorhersagen und verteidigen
      if (k.vy < -0.2) { const t = (k.y - 0.2) / -k.vy; ix = k.x + k.vx * t; for (let i = 0; i < 4 && (ix < 0 || ix > W); i++) ix = ix < 0 ? -ix : 2 * W - ix; }
      p.tx = W / 2 + (ix - W / 2) * 0.55; p.ty = 0.17;
    }
  }

  /* ---------- Online ---------- */
  function buildMsg() {
    const me = pads[myRole], tms = Math.round(performance.now());
    const m = { n: hub.getName(), pd: [r3(me.x), r3(me.y), r3(me.vx), r3(me.vy)], sc: [score.b, score.t], gs, rm, ph: phase,
      t: tms, et: lastRxT, eh: lastRxT ? Math.round(tms - lastRxLocal) : 0 };
    if (owner === myRole) q++;
    if (owner === myRole || now < handoffUntil) m.pk = { x: r3(puck.x), y: r3(puck.y), vx: r3(puck.vx), vy: r3(puck.vy), o: owner, e: epoch, q };
    return m;
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  function sendNow() { if (conn && (conn.status === 'connected' || conn.status === 'stalled')) conn.send(buildMsg()); }
  // Scheibe um die Laufzeit der Nachricht nach vorne rechnen
  function catchUp(p, secs) {
    let left = Math.min(0.25, Math.max(0, secs));
    while (left > 0) { const h = Math.min(0.016, left); stepPuck(p, h, false, false); left -= h; }
  }
  function adoptPuck(pk) {
    puck.x = num(pk.x, puck.x); puck.y = num(pk.y, puck.y); puck.vx = num(pk.vx); puck.vy = num(pk.vy);
    catchUp(puck, latency);
  }

  function onMessage(m) {
    if (!m || typeof m !== 'object') return;
    if (typeof m.n === 'string' && m.n.trim()) oppName = m.n.trim().slice(0, 16);
    // Verzögerung messen: unsere Zeitmarke kommt zurück
    const nowMs = performance.now();
    if (num(m.t)) {
      lastRxT = num(m.t); lastRxLocal = nowMs;
      // Uhrenabgleich: kleinste beobachtete Differenz = Uhrversatz + schnellste Laufzeit
      const off = nowMs - num(m.t);
      clockOff = clockOff === null ? off : Math.min(clockOff + 0.02, off);
    }
    if (num(m.et) > 0) {
      const rtt = (nowMs - num(m.et) - num(m.eh)) / 1000;
      if (rtt > 0 && rtt < 2) latency = latency * 0.85 + (rtt / 2) * 0.15;
    }
    const opp = pads[other(myRole)];
    if (Array.isArray(m.pd)) {
      opp.tx = num(m.pd[0], opp.tx); opp.ty = num(m.pd[1], opp.ty);
      opp.vx = num(m.pd[2]); opp.vy = num(m.pd[3]);
      // Gegner-Schläger ebenfalls um die Laufzeit vorausschätzen
      opp.tx += opp.vx * latency * 0.5; opp.ty += opp.vy * latency * 0.5;
    }
    const mrm = num(m.rm);
    if (mrm > rm) { rm = mrm; resetMatch(); hidePanel(); }
    if (mrm < rm) return;                                     // Nachricht aus alter Runde
    const mgs = num(m.gs);
    if (mgs > gs && Array.isArray(m.sc)) {
      gs = mgs; score.b = num(m.sc[0]); score.t = num(m.sc[1]);
      afterGoal(m.pk && (m.pk.o === 'b' || m.pk.o === 't') ? m.pk.o : other(myRole), false);
    }
    const pk = m.pk;
    if (pk && (pk.o === 'b' || pk.o === 't')) {
      const e = num(pk.e), mq = num(pk.q);
      if (e > epoch) {
        // neuer Besitzer
        const iAlreadyOwn = owner === myRole && pk.o === myRole;   // ich hatte sie schon selbst übernommen
        epoch = e; lastQ = mq; owner = pk.o;
        if (!iAlreadyOwn) adoptPuck(pk);
      } else if (e === epoch && pk.o !== myRole && owner !== myRole && mq > lastQ) {
        lastQ = mq; adoptPuck(pk);                                // laufende Updates vom Besitzer
      }
      if (pk.o !== myRole && e >= epoch && clockOff !== null && num(m.t)) {
        // echte Position mit Zeitstempel merken (Zeit in unserer Uhr)
        const t = (num(m.t) + clockOff) / 1000;
        if (!snaps.length || t > snaps[snaps.length - 1].t) {
          snaps.push({ t, x: num(pk.x), y: num(pk.y), vx: num(pk.vx), vy: num(pk.vy), e });
          if (snaps.length > 40) snaps.shift();
        }
      }
    }
    if (m.ph === 'play' && phase === 'count' && now < phaseUntil - 0.3) phaseUntil = now + 0.3; // Countdown angleichen
  }

  function onStatus(s, info) {
    if (!alive) return;
    if (s === 'connected') {
      ui.net.hidden = false; ui.net.classList.remove('bad'); ui.net.textContent = 'Verbunden';
      if (ui.panelState === 'host' || ui.panelState === 'join-wait') { rm = 0; gs = 0; recorded = -1; resetMatch(); hidePanel(); snd(660, 0.1, 'triangle', 0.08); }
    } else if (s === 'stalled') {
      ui.net.hidden = false; ui.net.classList.add('bad'); ui.net.textContent = 'Verbindung hängt …';
    } else if (s === 'lost') {
      ui.net.classList.add('bad'); ui.net.textContent = 'Getrennt';
      showPanel('lost');
    } else if (s === 'error') {
      showPanel(ui.panelState === 'host' ? 'menu' : 'join', info || 'Verbindung fehlgeschlagen.');
    }
  }

  async function startHost() {
    const code = Net.newCode();
    mode = 'online'; myRole = 'b';
    showPanel('host', '', code);
    if (hub.roomOpened) hub.roomOpened('airhockey', code);                 // Herausforderung: Einladung geht als Nachricht raus
    try { conn = await Net.host('airhockey', code, { onMessage, onStatus }); }
    catch (e) { showPanel('menu', 'Online-Verbindung konnte nicht starten: ' + e.message); }
  }
  async function startJoin(raw) {
    const code = Net.cleanCode(raw);
    if (code.length !== 4) { showPanel('join', 'Bitte den 4-stelligen Code eingeben.'); return; }
    mode = 'online'; myRole = 't';
    showPanel('join-wait', '', code);
    try { conn = await Net.join('airhockey', code, { onMessage, onStatus }); }
    catch (e) { showPanel('join', 'Online-Verbindung konnte nicht starten: ' + e.message); }
  }
  function startOffline(m) { closeConn(); bot.lastHalf = false; bot.strikeUntil = 0; mode = m; myRole = 'b'; oppName = m === 'bot' ? 'Bot' : 'Oben'; rm = 0; gs = 0; recorded = -1; resetMatch(); hidePanel(); ui.net.hidden = true; }
  function closeConn() { if (conn) { conn.close(); conn = null; } }

  /* ---------- Tore und Spielende ---------- */
  function afterGoal(conceder, mine) {
    phase = 'goal'; phaseUntil = now + CFG.goalPause;
    const scorer = other(conceder);
    const iScored = mode === 'local' ? null : scorer === myRole;
    const blueSide = mode === 'local' ? 'b' : myRole;
    flash = { t: now, c: scorer === blueSide ? '#4c7dff' : '#ff4d5e', txt: 'TOR!' };
    shake = 10;
    if (iScored === false) { snd(300, 0.35, 'sawtooth', 0.06, -200); buzz(60); }
    else { snd(520, 0.1, 'square', 0.07); setTimeout(() => snd(780, 0.18, 'square', 0.07), 90); }
    if (score.b >= CFG.winScore || score.t >= CFG.winScore) {
      phase = 'over'; phaseUntil = Infinity;
      setTimeout(() => { if (alive && phase === 'over') showPanel('over'); }, 900);
      if (recorded !== rm && mode !== 'local') {
        recorded = rm;
        hub.recordResult('airhockey', mode === 'online' ? 'online' : 'bot', score[myRole] > score[other(myRole)], mode === 'online' ? oppName : 'Bot', score[myRole] + ':' + score[other(myRole)]);
      }
    }
  }
  function goalBy(conceder) {
    score[other(conceder)]++; gs++;
    servePuck(conceder); epoch++; q = 0;
    afterGoal(conceder, true);
    if (mode === 'online') sendNow();
  }
  function rematch() {
    if (mode === 'online') { rm++; recorded = -1; resetMatch(); hidePanel(); sendNow(); }
    else startOffline(mode);
  }

  /* Position der Scheibe zum Zeitpunkt "jetzt minus Puffer" aus den echten Daten */
  function interpolated() {
    if (snaps.length === 0) return null;
    const t = now - RENDER_DELAY;
    while (snaps.length > 2 && snaps[1].t <= t) snaps.shift();
    const a = snaps[0], b = snaps[1];
    if (a.e < epoch && owner !== myRole && snaps.length === 1) return null;
    if (!b || t >= b.t) {                                     // nichts Neueres: kurz weiterrechnen
      const last = b || a, dt = Math.min(0.12, Math.max(0, t - last.t));
      return [last.x + last.vx * dt, last.y + last.vy * dt];
    }
    if (t <= a.t) return [a.x, a.y];
    const k = (t - a.t) / (b.t - a.t);
    return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k];
  }

  /* ---------- Hauptschleife ---------- */
  function loop(t) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const tt = t / 1000; const dt = Math.min(0.033, Math.max(0.001, tt - lastT || 0.016)); lastT = tt; now = tt;
    if (mode && pads) update(dt);
    draw();
  }
  function update(dt) {
    if (phase === 'count' && now >= phaseUntil) { phase = 'play'; snd(880, 0.12, 'square', 0.07); }
    if (phase === 'goal' && now >= phaseUntil) phase = 'play';

    if (testSteer) { const t = testSteer({ x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy }, myRole); if (t) { pads[myRole].tx = t[0]; pads[myRole].ty = t[1]; } }
    for (const s of ctrlSides()) movePad(pads[s], dt, CFG.padMaxSpeed);
    if (mode === 'bot') { botThink(); movePad(pads.t, dt, CFG.botSpeed); }
    if (mode === 'online') {                                     // Gegner weich nachziehen
      const o = pads[other(myRole)], k = 1 - Math.exp(-dt * 18);
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
    }

    if (phase === 'play') {
      if (mode !== 'online') {
        const c = stepPuck(puck, dt, true, true);
        if (c) goalBy(c);
      } else if (owner === myRole) {
        const c = stepPuck(puck, dt, true, true);
        if (c) goalBy(c);
        else {
          const side = puck.y > H / 2 ? 'b' : 't';
          if (side !== myRole) { owner = side; epoch++; q = 0; handoffUntil = now + 0.6; sendNow(); }
        }
      } else {
        stepPuck(puck, dt, false, false);                       // nur vorhersagen
        // Kommt die Scheibe deutlich auf meine Seite, übernehme ich sofort (wartet nicht aufs Netz)
        const deep = myRole === 'b' ? puck.y > H / 2 + 0.04 : puck.y < H / 2 - 0.04;
        if (deep) { owner = myRole; epoch++; q = 0; sendNow(); }
      }
    }
    // gezeichnete Scheibe glätten
    let tx = puck.x, ty = puck.y;
    if (mode === 'online' && owner !== myRole) { const ip = interpolated(); if (ip) { tx = ip[0]; ty = ip[1]; } }
    const jump = Math.hypot(tx - rPuck.x, ty - rPuck.y);
    if (mode !== 'online' || jump > 0.35) { rPuck.x = tx; rPuck.y = ty; }
    else { const k = 1 - Math.exp(-dt * (owner === myRole ? 28 : 40)); rPuck.x += (tx - rPuck.x) * k; rPuck.y += (ty - rPuck.y) * k; }
    trail.push({ x: rPuck.x, y: rPuck.y }); if (trail.length > 10) trail.shift();

    if (mode === 'online') {
      sendAcc += dt;
      const hz = conn && conn.transport === 'p2p' ? CFG.sendHzP2P : CFG.sendHz;
      if (sendAcc >= 1 / hz) { sendAcc = 0; sendNow(); }
    }
  }

  /* ---------- Zeichnen ---------- */
  // Der Tisch wird immer "hochkant" gezeichnet. Im Querformat dreht ihn eine
  // Transformation um 90°, sodass das eigene Tor links liegt.
  let view = { ox: 0, oy: 0, s: 100, flip: false, rot: false }, cw = 0, ch = 0, felt = null;
  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = root.clientWidth; ch = root.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    view.rot = cw > ch * 1.05;
    const top = view.rot ? 52 : 58, bot = view.rot ? 10 : 18, side = view.rot ? 70 : 14;
    const tw = view.rot ? H : W, th = view.rot ? W : H;
    const s = Math.min((cw - side * 2) / (tw + 0.1), (ch - top - bot) / (th + 0.1));
    view.s = s; view.ox = (cw - tw * s) / 2; view.oy = top + (ch - top - bot - th * s) / 2;
    felt = null;
  }
  // Spielfeld-Koordinaten -> Pixel im (hochkant gedachten) Tisch
  function toTable(x, y) {
    if (view.flip) { x = W - x; y = H - y; }
    return [x * view.s, y * view.s];
  }
  // Tisch-Pixel -> Bildschirm (mit Drehung im Querformat)
  function tableTransform() {
    if (!view.rot) ctx.setTransform(dpr, 0, 0, dpr, dpr * view.ox, dpr * view.oy);
    else ctx.setTransform(0, dpr, -dpr, 0, dpr * (view.ox + H * view.s), dpr * view.oy);
  }
  // Bildschirm -> Tisch-Einheiten aus Sicht des Spielers (eigenes Tor "unten")
  function screenToLocal(px, py) {
    if (!view.rot) return [(px - view.ox) / view.s, (py - view.oy) / view.s];
    return [(py - view.oy) / view.s, H - (px - view.ox) / view.s];
  }
  const localToCanon = (x, y) => (view.flip ? [W - x, H - y] : [x, y]);
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function buildFelt() {
    // Tisch einmal vorzeichnen (schneller)
    const s = view.s, rim = 0.045 * s, pad = rim + 4;
    const w = W * s + pad * 2, h = H * s + pad * 2;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.translate(pad, pad);
    const ink = 'rgba(235,240,255,.28)';
    g.fillStyle = '#06070a'; rr(g, -rim, -rim, W * s + rim * 2, H * s + rim * 2, rim * 2.2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.5; rr(g, -rim + 1, -rim + 1, W * s + rim * 2 - 2, H * s + rim * 2 - 2, rim * 2.2); g.stroke();
    const sf = g.createLinearGradient(0, 0, 0, H * s); sf.addColorStop(0, '#151925'); sf.addColorStop(0.5, '#11141d'); sf.addColorStop(1, '#151925');
    g.fillStyle = sf; rr(g, 0, 0, W * s, H * s, rim * 1.3); g.fill();
    g.save(); rr(g, 0, 0, W * s, H * s, rim * 1.3); g.clip();
    g.fillStyle = 'rgba(255,255,255,.045)';
    const step = 0.05 * s;
    for (let y = step / 2; y < H * s; y += step) for (let x = step / 2; x < W * s; x += step) { g.beginPath(); g.arc(x, y, Math.max(1, s * 0.0035), 0, 7); g.fill(); }
    const lw = Math.max(2, s * 0.008);
    // Torräume
    const topC = '#ff4d5e', botC = '#4c7dff';   // oben immer Gegner (rot), unten immer ich (blau)
    g.lineWidth = lw * 1.4;
    g.fillStyle = topC + '1f'; g.strokeStyle = topC + 'cc'; g.beginPath(); g.arc(W * s / 2, 0, 0.2 * s, 0, Math.PI); g.fill(); g.stroke();
    g.fillStyle = botC + '1f'; g.strokeStyle = botC + 'cc'; g.beginPath(); g.arc(W * s / 2, H * s, 0.2 * s, Math.PI, 0); g.fill(); g.stroke();
    // Hälften leicht einfärben
    g.fillStyle = topC + '0a'; g.fillRect(0, 0, W * s, H * s / 2);
    g.fillStyle = botC + '0a'; g.fillRect(0, H * s / 2, W * s, H * s / 2);
    // Mittellinie und Kreis
    g.strokeStyle = ink; g.lineWidth = lw; g.setLineDash([lw * 3, lw * 2.2]);
    g.beginPath(); g.moveTo(0, H * s / 2); g.lineTo(W * s, H * s / 2); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(W * s / 2, H * s / 2, 0.16 * s, 0, 7); g.stroke();
    g.fillStyle = ink; g.beginPath(); g.arc(W * s / 2, H * s / 2, lw * 1.6, 0, 7); g.fill();
    g.restore();
    // Tore als Lücken in der Bande
    const gw = CFG.goalW * s;
    g.fillStyle = topC + '99'; rr(g, W * s / 2 - gw / 2, -rim * 0.55, gw, rim * 0.45, 3); g.fill();
    g.fillStyle = botC + '99'; rr(g, W * s / 2 - gw / 2, H * s + rim * 0.1, gw, rim * 0.45, 3); g.fill();
    felt = { c, pad, w, h };
  }
  function drawPad(x, y, col, dark) {
    const [sx, sy] = toTable(x, y), R = CFG.padR * view.s;
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = R * 0.9;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, R, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1.5, R * 0.06);
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(sx, sy, R * 0.68, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, R * 0.42, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(sx - R * 0.14, sy - R * 0.16, R * 0.14, 0, 7); ctx.fill();
  }
  // Text im Tisch, aber immer aufrecht lesbar (auch im Querformat)
  function uprightText(x, y, upsideDown, fn) {
    ctx.save(); ctx.translate(x, y);
    if (view.rot) ctx.rotate(-Math.PI / 2);
    if (upsideDown) ctx.rotate(Math.PI);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fn(); ctx.restore();
  }
  function drawScore(side, y, upsideDown) {
    uprightText(W * view.s / 2, y, upsideDown, () => {
      ctx.font = `800 ${Math.round(view.s * 0.2)}px Sora, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillText(String(score[side]), 0, 0);
    });
  }
  function bigText(t, col, k) {
    const size = view.s * 0.28 * (0.8 + 0.2 * Math.min(1, k));
    uprightText(W * view.s / 2, H * view.s / 2, false, () => {
      ctx.font = `800 ${Math.round(size)}px Sora, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(4, size * 0.09); ctx.strokeStyle = 'rgba(8,9,12,.85)'; ctx.strokeText(t, 0, 0);
      ctx.fillStyle = col; ctx.fillText(t, 0, 0);
    });
  }
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(cw / 2, ch * 0.45, 0, cw / 2, ch * 0.45, Math.max(cw, ch) * 0.75); bg.addColorStop(0, '#161a2a'); bg.addColorStop(1, '#0b0c10');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    if (!pads) return;
    view.flip = mode === 'online' && myRole === 't';
    if (!felt || felt.flip !== view.flip) { buildFelt(); felt.flip = view.flip; }
    const s = view.s;

    tableTransform();
    if (shake > 0.2) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.86; } else shake = 0;
    ctx.drawImage(felt.c, -felt.pad, -felt.pad, felt.w, felt.h);

    // Spielstand im Tisch: auf der eigenen Hälfte der eigene
    const bottomSide = view.flip ? 't' : 'b';
    drawScore(other(bottomSide), H * s * 0.25, mode === 'local' && !view.rot);
    drawScore(bottomSide, H * s * 0.75, false);

    // Treffer-Ringe
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], a = (now - r.t) / 0.35; if (a >= 1) { rings.splice(i, 1); continue; }
      const [sx, sy] = toTable(r.x, r.y);
      ctx.strokeStyle = r.c; ctx.globalAlpha = 1 - a; ctx.lineWidth = 3 + r.big * 4;
      ctx.beginPath(); ctx.arc(sx, sy, (CFG.puckR + a * (0.08 + r.big * 0.1)) * s, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // Spur der Scheibe
    const pr = CFG.puckR * s;
    for (let i = 0; i < trail.length; i++) {
      const [sx, sy] = toTable(trail[i].x, trail[i].y);
      ctx.fillStyle = `rgba(242,244,250,${(i / trail.length) * 0.14})`; ctx.beginPath(); ctx.arc(sx, sy, pr * (0.5 + i / trail.length / 2), 0, 7); ctx.fill();
    }
    // Scheibe
    const [px, py] = toTable(rPuck.x, rPuck.y);
    ctx.save(); ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = pr * 0.9;
    ctx.fillStyle = '#f2f4fa'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(13,14,18,.35)'; ctx.lineWidth = Math.max(1.5, pr * 0.16); ctx.beginPath(); ctx.arc(px, py, pr * 0.55, 0, 7); ctx.stroke();

    // Schläger: ich blau, Gegner rot
    const blueSide = mode === 'local' ? 'b' : myRole;
    drawPad(pads[other(blueSide)].x, pads[other(blueSide)].y, '#ff4d5e', '#b8293a');
    drawPad(pads[blueSide].x, pads[blueSide].y, '#4c7dff', '#2a49b8');

    // Countdown und Tor
    if (phase === 'count') {
      const n = Math.ceil(phaseUntil - now);
      bigText(n > 0 ? String(n) : 'LOS!', '#eef0f6', 1 - ((phaseUntil - now) % 1));
    }
    if (flash) {
      const a = (now - flash.t) / 1.2;
      if (a >= 1) flash = null;
      else {
        ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = flash.c; ctx.globalAlpha = Math.max(0, 0.35 * (1 - a * 2)); ctx.fillRect(0, 0, cw, ch);
        ctx.restore();
        bigText(flash.txt, flash.c, Math.min(1, a * 4));
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mode === 'online' && conn && conn.status !== 'connected' && ui.panelState === null && phase !== 'over') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 15px Inter, sans-serif'; ctx.fillStyle = '#9aa0b3';
      ctx.fillText('Warte auf Verbindung …', cw / 2, view.rot ? ch - 14 : view.oy - 18);
    }
  }

  /* ---------- Eingabe ---------- */
  function sideForPointer(px, py) {
    if (mode !== 'local') return myRole;
    return screenToLocal(px, py)[1] > H / 2 ? 'b' : 't';
  }
  function setTarget(side, px, py) {
    // Schläger sitzt etwas vor dem Finger (Richtung Gegner), damit man ihn sieht
    let [lx, ly] = screenToLocal(px, py);
    ly += CFG.fingerOffset * (mode === 'local' && side === 't' ? 1 : -1);
    const [x, y] = localToCanon(lx, ly);
    const pad = pads[side]; pad.tx = x; pad.ty = y;
  }
  function onDown(e) {
    unlockAudio();
    if (!mode || !pads || ui.panelState) return;
    e.preventDefault();
    const side = sideForPointer(e.clientX, e.clientY);
    for (const [id, s] of pointers) if (s === side) pointers.delete(id);   // ein Finger pro Schläger
    pointers.set(e.pointerId, side);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    setTarget(side, e.clientX, e.clientY);
  }
  function onMove(e) {
    const side = pointers.get(e.pointerId); if (!side || !pads) return;
    e.preventDefault();
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    const last = list && list.length ? list[list.length - 1] : e;
    setTarget(side, last.clientX, last.clientY);
  }
  function onUp(e) { pointers.delete(e.pointerId); }

  /* ---------- Menü-Tafeln ---------- */
  function showPanel(state, err = '', code = '') {
    ui.panelState = state;
    const p = ui.panel; p.hidden = false;
    const e = err ? `<p class="err">${escapeHtml(err)}</p>` : '<p class="err"></p>';
    if (state === 'menu') {
      p.innerHTML = `<div class="box"><h2>Air-Hockey</h2><p>Wer zuerst ${CFG.winScore} Tore hat, gewinnt.</p>
        <div class="stack">
          <button class="btn blue" data-a="host">Online: Raum erstellen</button>
          <button class="btn" data-a="join">Online: Mit Code beitreten</button>
          <div class="row"><button class="btn" data-a="bot">Gegen Bot</button><button class="btn" data-a="local">Zu zweit, 1 Handy</button></div>
          <button class="btn main" data-a="back">Zurück zur Übersicht</button>
        </div>${e}<p class="hint">Online verbinden sich eure Handys direkt. Beide brauchen Internet.</p></div>`;
    } else if (state === 'host') {
      p.innerHTML = `<div class="box"><h2>Dein Raum</h2><p>Sag diesen Code deinem Gegner:</p>
        <div class="code-big">${escapeHtml(code)}</div><div class="wait"><i></i><i></i><i></i></div><p>Warte auf Gegner …</p>
        <div class="stack">${hub.invite ? `<button class="btn blue" data-a="invite" data-code="${escapeHtml(code)}">Freund einladen (WhatsApp)</button><button class="btn" data-a="copylink" data-code="${escapeHtml(code)}">Einladungs-Link kopieren</button>` : `<button class="btn" data-a="copy" data-code="${escapeHtml(code)}">Code kopieren</button>`}<button class="btn main" data-a="menu">Abbrechen</button></div>${e}</div>`;
    } else if (state === 'join') {
      p.innerHTML = `<div class="box"><h2>Beitreten</h2><p>Code von deinem Gegner eingeben:</p>
        <form class="stack" data-form="join"><input class="field code-in" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="CODE" aria-label="Raum-Code">
        <button class="btn blue" type="submit">Beitreten</button><button class="btn main" type="button" data-a="menu">Zurück</button></form>${e}</div>`;
      setTimeout(() => { const i = p.querySelector('input'); i && i.focus(); }, 60);
    } else if (state === 'join-wait') {
      p.innerHTML = `<div class="box"><h2>Verbinde …</h2><div class="code-big">${escapeHtml(code)}</div><div class="wait"><i></i><i></i><i></i></div>
        <div class="stack"><button class="btn main" data-a="menu">Abbrechen</button></div>${e}</div>`;
    } else if (state === 'over') {
      const mine = mode === 'local' ? score.b : score[myRole], theirs = mode === 'local' ? score.t : score[other(myRole)];
      const title = mode === 'local' ? (mine > theirs ? 'Unten gewinnt!' : 'Oben gewinnt!') : (mine > theirs ? 'Gewonnen!' : 'Verloren!');
      const sub = mode === 'online' ? (mine > theirs ? `${escapeHtml(oppName)} ist geschlagen.` : `${escapeHtml(oppName)} war diesmal besser.`) : '';
      p.innerHTML = `<div class="box"><h2>${title}</h2><div class="code-big">${mine} : ${theirs}</div><p>${sub}</p>
        <div class="stack"><button class="btn blue" data-a="rematch">Revanche</button><button class="btn main" data-a="menu">Menü</button></div></div>`;
    } else if (state === 'lost') {
      p.innerHTML = `<div class="box"><h2>Getrennt</h2><p>Die Verbindung zu ${escapeHtml(oppName)} ist weg.</p>
        <div class="stack"><button class="btn main" data-a="menu">Zum Menü</button></div></div>`;
    }
  }
  function hidePanel() { ui.panelState = null; ui.panel.hidden = true; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function onPanelClick(e) {
    unlockAudio();
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'host') startHost();
    else if (a === 'join') { closeConn(); showPanel('join'); }
    else if (a === 'bot' || a === 'local') startOffline(a);
    else if (a === 'back') hub.back();
    else if (a === 'menu') { closeConn(); mode = null; pads = null; ui.net.hidden = true; showPanel('menu'); }
    else if (a === 'rematch') rematch();
    else if (a === 'invite' || a === 'copylink') {
      const label = b.textContent;
      hub.invite('airhockey', b.dataset.code, a === 'copylink' ? 'copy' : '').then((r) => {
        if (r === 'abgebrochen') return;
        b.textContent = r === 'kopiert' ? 'Link kopiert!' : 'Einladung verschickt!';
        setTimeout(() => { b.textContent = label; }, 2500);
      });
    }
    else if (a === 'copy') {
      const c = b.dataset.code;
      const done = () => { b.textContent = 'Kopiert!'; };
      try { navigator.clipboard.writeText(c).then(done, () => { b.textContent = c; }); } catch (err) { b.textContent = c; }
    }
  }
  function onPanelSubmit(e) {
    e.preventDefault();
    if (e.target.dataset.form === 'join') startJoin(e.target.querySelector('input').value);
  }
  function onBack() {
    if (mode && ui.panelState === null) { closeConn(); mode = null; pads = null; ui.net.hidden = true; showPanel('menu'); }
    else hub.back();
  }
  const blockScroll = (e) => { if (!ui.panelState) e.preventDefault(); };

  /* ---------- Start / Stopp (von der Startseite aufgerufen) ---------- */
  function start(el, h) {
    root = el; hub = h; alive = true;
    root.innerHTML = `<canvas></canvas>
      <div class="g-top"><button class="g-back" type="button">Zurück</button><span class="g-net" hidden></span></div>
      <div class="g-panel" hidden></div>`;
    canvas = root.querySelector('canvas'); ctx = canvas.getContext('2d');
    ui = { panel: root.querySelector('.g-panel'), net: root.querySelector('.g-net'), back: root.querySelector('.g-back'), panelState: null };
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
    ui.panel.addEventListener('click', onPanelClick);
    ui.panel.addEventListener('submit', onPanelSubmit);
    ui.back.addEventListener('click', onBack);
    root.addEventListener('touchmove', blockScroll, { passive: false });
    addEventListener('resize', resize);
    addEventListener('pagehide', closeConn);
    mode = null; pads = null; resize();
    showPanel('menu');
    if (hub.intent === 'bot') startOffline('bot');
    else if (hub.intent === 'host') startHost();                           // „Herausfordern“ aus der Freundesliste
    else if (hub.intent && hub.intent.join) startJoin(hub.intent.join);   // über einen Einladungs-Link gekommen
    lastT = performance.now() / 1000;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    alive = false; cancelAnimationFrame(raf); closeConn();
    removeEventListener('resize', resize);
    removeEventListener('pagehide', closeConn);
    if (root) root.removeEventListener('touchmove', blockScroll);
    pointers.clear(); mode = null; pads = null; canvas = ctx = null;
  }

  window.Games = window.Games || {};
  window.Games.airhockey = { start, stop, CFG, _steer: (fn) => { testSteer = fn; }, _debug: () => ({ rp: { x: rPuck.x, y: rPuck.y }, latency, epoch, mode, myRole, phase, owner, score: score && { ...score }, gs, rm, puck: puck && { ...puck }, conn: conn && conn.status }) };
})();
