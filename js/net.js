/* =========================================================================
   net.js – gemeinsame Echtzeit-Verbindung für alle Spiele
   -------------------------------------------------------------------------
   Zwei Wege, die Spiele merken davon nichts:
   1. "p2p"  : Handy zu Handy direkt über WebRTC (PeerJS). Kein eigener Server.
   2. "room" : wenn die Seite als Claude-Artifact läuft (Claude-Raum).

   Benutzung in einem Spiel:
     const conn = await Net.host('airhockey', 'AB12', {onMessage, onStatus});
     const conn = await Net.join('airhockey', 'AB12', {onMessage, onStatus});
     conn.send({...});   // am besten ca. 30x pro Sekunde den ganzen Zustand
     conn.close();
   Status-Werte: 'waiting' | 'connected' | 'stalled' | 'lost' | 'error'
   ========================================================================= */
(function () {
  const PREFIX = 'duellhalle-v1-';           // macht unsere Raum-Namen weltweit eindeutig
  const STALL_MS = 2500;                      // so lange ohne Nachricht = "hängt"
  const LOST_MS = 10000;                      // so lange ohne Nachricht = "getrennt"
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  let roomPromise = null;
  function getRoom() {
    if (!roomPromise) {
      roomPromise = (async () => {
        try {
          if (window.claude && typeof window.claude.use === 'function') return await window.claude.use('room');
        } catch (e) { /* nicht in Claude */ }
        return null;
      })();
    }
    return roomPromise;
  }

  /* Welcher Weg wird genutzt? */
  async function mode() { return (await getRoom()) ? 'room' : 'p2p'; }

  function newCode() {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }
  function cleanCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); }

  /* ---------- gemeinsame Hülle: Status, Herzschlag ---------- */
  function makeConn(role, handlers) {
    const conn = {
      role, status: 'init', lastRx: 0, closed: false, transport: '',
      _send: () => {}, _close: () => {},
      send(obj) { if (!conn.closed) { try { conn._send(obj); } catch (e) { } } },
      close() { if (conn.closed) return; conn.closed = true; clearInterval(conn._hb); try { conn._close(); } catch (e) { } },
      setStatus(s, info) {
        if (conn.closed || conn.status === s) return;
        conn.status = s;
        handlers.onStatus && handlers.onStatus(s, info);
      },
      receive(msg) {
        if (conn.closed) return;
        conn.lastRx = performance.now();
        if (conn.status !== 'connected') conn.setStatus('connected');
        handlers.onMessage && handlers.onMessage(msg);
      }
    };
    conn._hb = setInterval(() => {
      const quiet = performance.now() - conn.lastRx;
      if (conn.status === 'connected' && quiet > STALL_MS) conn.setStatus('stalled');
      else if (conn.status === 'stalled' && quiet > LOST_MS) conn.setStatus('lost');
    }, 500);
    return conn;
  }

  /* ---------- Weg 1: Peer-to-Peer mit PeerJS ---------- */
  let peerLib = null;
  function loadPeerJS() {
    if (window.Peer) return Promise.resolve();
    if (!peerLib) {
      peerLib = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
        s.onload = res; s.onerror = () => rej(new Error('PeerJS konnte nicht geladen werden'));
        document.head.appendChild(s);
      });
    }
    return peerLib;
  }
  function peerOptions() {
    const o = {
      debug: 0,
      config: { iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ] }
    };
    // Nur zum Testen: ?peerhost=localhost:9000 nutzt einen eigenen PeerJS-Server
    const h = new URLSearchParams(location.search).get('peerhost');
    if (h) { const [host, port] = h.split(':'); Object.assign(o, { host, port: Number(port) || 9000, path: '/', secure: false }); }
    return o;
  }
  function wireData(conn, dc) {
    dc.on('data', (d) => { if (d && typeof d === 'object') conn.receive(d); });
    dc.on('close', () => conn.setStatus('lost'));
    dc.on('error', () => conn.setStatus('lost'));
    conn._send = (obj) => { if (dc.open) dc.send(obj); };
  }
  async function p2pHost(game, code, handlers) {
    await loadPeerJS();
    const conn = makeConn('host', handlers); conn.transport = 'p2p';
    const peer = new window.Peer(PREFIX + game + '-' + code, peerOptions());
    let dc = null;
    conn._close = () => { try { dc && dc.close(); } catch (e) { } peer.destroy(); };
    peer.on('open', () => conn.setStatus('waiting'));
    peer.on('connection', (c) => {
      if (dc && dc.open) { c.on('open', () => c.close()); return; }   // Raum ist voll
      dc = c;
      c.on('open', () => { wireData(conn, c); conn.lastRx = performance.now(); conn.setStatus('connected'); });
    });
    peer.on('disconnected', () => { if (!conn.closed) try { peer.reconnect(); } catch (e) { } });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') conn.setStatus('error', 'Dieser Code ist gerade schon vergeben. Bitte nochmal neu erstellen.');
      else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') conn.setStatus('error', 'Keine Verbindung zum Vermittlungsdienst. Internet prüfen.');
      else if (conn.status !== 'connected') conn.setStatus('error', 'Verbindungsfehler: ' + e.type);
    });
    return conn;
  }
  async function p2pJoin(game, code, handlers) {
    await loadPeerJS();
    const conn = makeConn('guest', handlers); conn.transport = 'p2p';
    const peer = new window.Peer(peerOptions());
    let dc = null, timer = 0;
    conn._close = () => { clearTimeout(timer); try { dc && dc.close(); } catch (e) { } peer.destroy(); };
    peer.on('open', () => {
      conn.setStatus('waiting');
      dc = peer.connect(PREFIX + game + '-' + code, { serialization: 'json', reliable: false });
      dc.on('open', () => { clearTimeout(timer); wireData(conn, dc); conn.lastRx = performance.now(); conn.setStatus('connected'); });
      timer = setTimeout(() => { if (conn.status !== 'connected') conn.setStatus('error', 'Keine Antwort. Stimmt der Code und ist dein Gegner im Raum?'); }, 15000);
    });
    peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') conn.setStatus('error', 'Kein Raum mit diesem Code gefunden.');
      else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') conn.setStatus('error', 'Keine Verbindung zum Vermittlungsdienst. Internet prüfen.');
      else if (conn.status !== 'connected') conn.setStatus('error', 'Verbindungsfehler: ' + e.type);
    });
    return conn;
  }

  /* ---------- Weg 2: Claude-Raum (wenn die Seite in Claude läuft) ---------- */
  async function roomConnect(role, game, code, handlers) {
    const ns = await getRoom();
    const conn = makeConn(role, handlers); conn.transport = 'room';
    let r = ns;
    try { r = await ns.join((game + '-' + code).toLowerCase()); } catch (e) { r = ns; }
    const tag = { g: game, c: code, role };
    let lastSeen = null, otherPeer = null;
    const pick = (peers) => peers.find((p) => !p.sameTab && p.presence && p.presence.g === game && p.presence.c === code && p.presence.role !== role);
    const unsub = r.onPeers((ch) => {
      const o = pick(ch.peers);
      if (!o) { if (otherPeer) { otherPeer = null; conn.setStatus('lost'); } return; }
      otherPeer = o.peer;
      if (conn.status !== 'connected') { conn.lastRx = performance.now(); conn.setStatus('connected'); }
      if (o.presence !== lastSeen) { lastSeen = o.presence; if (o.presence.m) conn.receive(o.presence.m); }
    });
    conn._send = (obj) => { r.presence(Object.assign({}, tag, { m: obj })).catch(() => { }); };
    conn._close = () => { try { unsub(); } catch (e) { } if (r !== ns && r.leave) r.leave().catch(() => { }); else r.presence({ g: null, m: null }).catch(() => { }); };
    r.presence(tag).catch(() => { });
    conn.setStatus('waiting');
    return conn;
  }

  async function host(game, code, handlers) {
    return (await mode()) === 'room' ? roomConnect('host', game, code, handlers) : p2pHost(game, code, handlers);
  }
  async function join(game, code, handlers) {
    return (await mode()) === 'room' ? roomConnect('guest', game, code, handlers) : p2pJoin(game, code, handlers);
  }

  window.Net = { host, join, mode, newCode, cleanCode };
})();
