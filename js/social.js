/* =========================================================================
   social.js – Freunde, Chat (privat und Lobby) und Online-Status
   -------------------------------------------------------------------------
   Social.open(tab)        -> Fenster öffnen: 'friends', 'lobby' oder 'chat:<id>'
                              (am PC unten rechts wie ein Messenger, am Handy Vollbild)
   Social.avatar(p, cls)   -> Profilbild als HTML (mit data-uid für den Status-Punkt)
   Social.sendInvite(id, t)-> Einladung als Chat-Nachricht an einen Freund
   Daten (alle mit RLS):
     friendships, blocks       – nur die Beteiligten sehen sie
     messages                  – nur Absender und Empfänger; schreiben nur an Freunde
     lobby_messages            – alle Angemeldeten; Admins löschen und schalten stumm
     search_players (RPC)      – liefert nur id, Name, Bild
   Nachrichten werden immer als reiner Text angezeigt (escaped). Nur Einladungs-Links
   zu dieser Seite werden anklickbar.
   Online-Status: Realtime Presence auf dem Kanal "online" ({ user_id, status }),
   dazu profiles.last_seen_at etwa jede Minute. Jedes Profilbild mit data-uid bekommt
   automatisch den Punkt (grün online, gelb abwesend, rot offline).
   Social.setMode('auto'|'invisible'), Social.mode(), Social.statusLabel(id)
   ========================================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = () => Auth.client();
  const me = () => (window.Auth && Auth.user() ? Auth.user().id : null);
  const isAdmin = () => !!(window.Auth && Auth.isAdmin());
  const toast = (m) => { if (window.Hub && Hub.toast) Hub.toast(m); };
  const PAGE = 30, LOBBY_PAGE = 50;
  const MSG_COLS = 'id,sender,recipient,body,created_at,read_at';

  const state = { uid: null, friendships: [], blocks: [], profiles: {}, unread: {}, loaded: false };
  const chat = { with: null, msgs: [], more: true, busy: false };
  const lobby = { msgs: [], more: true, busy: false, ch: null };
  let dock = null, tab = 'friends', channel = null, pollT = 0, searchT = 0, lastQuery = '';

  /* ---------- Hilfen ---------- */
  function avatar(p, cls) {
    p = p || {};
    const url = p.avatar_path && Auth.avatarUrl ? Auth.avatarUrl(p.avatar_path) : '';
    const letter = ((p.name || '?')[0] || '?').toUpperCase();
    return `<span class="av ${cls || 'sm'}"${p.id ? ` data-uid="${esc(p.id)}"` : ''}>${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : esc(letter)}</span>`;
  }
  const other = (f) => (f.requester === state.uid ? f.addressee : f.requester);
  const prof = (id) => state.profiles[id] || { id, name: 'Spieler' };
  const incoming = () => state.friendships.filter((f) => f.status === 'pending' && f.addressee === state.uid);
  const outgoing = () => state.friendships.filter((f) => f.status === 'pending' && f.requester === state.uid);
  const unreadOf = (id) => state.unread[id] || 0;
  const RANK = { online: 0, abwesend: 1 };
  const rankOf = (id) => (id in pres.map ? RANK[pres.map[id]] : 2);
  const friends = () => state.friendships.filter((f) => f.status === 'accepted')
    .sort((a, b) => (unreadOf(other(b)) - unreadOf(other(a))) || (rankOf(other(a)) - rankOf(other(b))) || prof(other(a)).name.localeCompare(prof(other(b)).name, 'de'));
  const isFriend = (id) => state.friendships.some((f) => f.status === 'accepted' && other(f) === id);
  const relation = (id) => {
    if (state.blocks.some((b) => b.blocked === id)) return { kind: 'blocked' };
    const f = state.friendships.find((x) => other(x) === id);
    if (!f) return { kind: 'none' };
    if (f.status === 'accepted') return { kind: 'friend', f };
    return { kind: f.requester === state.uid ? 'out' : 'in', f };
  };
  function deErr(e, where) {
    const m = (e && (e.message || e.details)) || String(e);
    if (e && e.code === '23505') return 'Zwischen euch gibt es schon eine Anfrage.';
    if (/zu schnell|Zu viele/i.test(m)) return m;
    if (/row-level security|violates row/i.test(m)) {
      if (where === 'lobby') return 'Du kannst gerade nicht in der Lobby schreiben (stummgeschaltet).';
      if (where === 'chat') return 'Die Nachricht ging nicht raus. Seid ihr noch Freunde?';
      return 'Das geht leider nicht (vielleicht wurdest du blockiert).';
    }
    if (/check constraint/i.test(m)) return 'Die Nachricht ist zu lang.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Keine Verbindung. Prüfe dein Internet.';
    return m;
  }
  function since(t) {
    const d = new Date(t);
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  const hhmm = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  function dayLabel(t) {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return diff === 0 ? 'Heute' : diff === 1 ? 'Gestern' : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  }
  // Text sicher anzeigen; nur Einladungs-Links zu dieser Seite (…/#spiel/CODE) werden anklickbar
  function textHtml(s) {
    const base = esc(location.origin + location.pathname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return esc(s).replace(new RegExp(base + '#([a-z0-9-]{2,40})\\/([A-Za-z0-9]{4})(?![A-Za-z0-9])', 'g'),
      (m, g, c) => `<a href="#${g}/${c}" class="so-join">Beitreten (${c})</a>`);
  }

  /* ---------- Daten: Freunde ---------- */
  async function loadProfiles(ids) {
    ids = [...new Set(ids)].filter(Boolean);
    if (!ids.length) return;
    const { data, error } = await db().from('profiles').select('id,name,avatar_path,last_seen_at').in('id', ids);
    if (error) throw error;
    (data || []).forEach((p) => { state.profiles[p.id] = Object.assign(state.profiles[p.id] || {}, p); });
  }
  async function loadUnread() {
    const { data, error } = await db().from('messages').select('sender').eq('recipient', state.uid).is('read_at', null).limit(1000);
    if (error) return;
    const u = {}; (data || []).forEach((m) => { u[m.sender] = (u[m.sender] || 0) + 1; });
    if (chat.with && dockOpen() && tab === 'chat') u[chat.with] = 0;
    state.unread = u;
  }
  async function load() {
    const uid = me(); if (!uid) return;
    const [fr, bl] = await Promise.all([
      db().from('friendships').select('id,requester,addressee,status,created_at,accepted_at').order('created_at', { ascending: false }),
      db().from('blocks').select('blocked,created_at')
    ]);
    if (fr.error) throw fr.error;
    if (uid !== me()) return;                                   // inzwischen abgemeldet
    state.uid = uid; state.friendships = fr.data || []; state.blocks = bl.data || [];
    await Promise.all([loadProfiles([...state.friendships.map(other), ...state.blocks.map((b) => b.blocked)]), loadUnread()]);
    state.loaded = true; updateBadge();
    if (dock && tab === 'friends') renderFriends();
    if (dock && tab === 'chat') { if (!isFriend(chat.with)) { toast('Ihr seid keine Freunde mehr.'); show('friends'); } else renderChatHead(); }
  }
  let loadT = 0;
  const reload = () => { clearTimeout(loadT); loadT = setTimeout(() => load().catch((e) => console.warn(e)), 250); };

  /* ---------- Zahl am Freunde-Knopf: neue Anfragen + ungelesene Nachrichten ---------- */
  const unreadTotal = () => Object.keys(state.unread).filter(isFriend).reduce((n, id) => n + unreadOf(id), 0);
  function updateBadge() {
    const n = state.uid ? incoming().length + unreadTotal() : 0;
    const b = $('#friendsBtn .cnt'); if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; }
    const btn = $('#friendsBtn'); if (btn) btn.setAttribute('aria-label', n ? `Freunde und Chat, ${n} neu` : 'Freunde und Chat');
    const t = dock && $('[data-stab=friends] .cnt', dock); if (t) { t.textContent = String(n); t.hidden = !n; }
  }

  /* ---------- Fenster ---------- */
  const dockOpen = () => !!dock && !document.hidden;
  function open(which) {
    if (!me()) { if (window.Hub && Hub.login) Hub.login(); return; }
    which = which || (tab === 'chat' ? 'friends' : tab) || 'friends';
    if (!dock) {
      dock = document.createElement('aside');
      dock.className = 'social'; dock.setAttribute('role', 'dialog'); dock.setAttribute('aria-label', 'Freunde und Chat');
      dock.innerHTML = `<div class="so-head"><div class="so-tabs" role="tablist">
          <button type="button" role="tab" data-stab="friends">Freunde <span class="cnt" hidden></span></button>
          <button type="button" role="tab" data-stab="lobby">Lobby</button>
        </div><button class="so-x" type="button" aria-label="Schließen" title="Schließen">×</button></div>
        <div class="so-body"></div><div class="so-foot" hidden></div>`;
      document.body.appendChild(dock);
      dock.querySelector('.so-x').onclick = close;
      dock.querySelector('.so-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-stab]'); if (b) show(b.dataset.stab); });
      dock.addEventListener('click', onClick);
      dock.addEventListener('submit', onSubmit);
      dock.addEventListener('input', onInput);
      dock.addEventListener('keydown', onKey);
      dock.querySelector('.so-body').addEventListener('scroll', onScroll, { passive: true });
      document.body.classList.add('so-open');
    }
    if (which.startsWith('chat:')) openChat(which.slice(5)); else show(which);
    if (!state.loaded) load().catch((e) => { const body = dock && $('.so-body', dock); if (body && tab === 'friends') body.innerHTML = `<p class="empty">${esc(deErr(e))}</p>`; });
  }
  function close() {
    if (!dock) return;
    dock.remove(); dock = null; document.body.classList.remove('so-open');
    if (tab === 'chat') { tab = 'friends'; chat.with = null; }
    leaveLobby();
  }
  function show(which) {
    if (which !== 'lobby') leaveLobby();
    if (which !== 'chat') chat.with = null;
    tab = which;
    dock.querySelectorAll('[data-stab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.stab === tab || (tab === 'chat' && b.dataset.stab === 'friends'))));
    const head = $('.so-chathead', dock); if (head && tab !== 'chat') head.remove();
    const foot = $('.so-foot', dock); foot.hidden = true; foot.innerHTML = '';
    dock.classList.toggle('chatting', tab === 'chat' || tab === 'lobby');
    if (tab === 'friends') renderFriends();
    else if (tab === 'lobby') enterLobby();
    updateBadge();
  }

  /* ---------- Reiter „Freunde“ ---------- */
  const ICON = {
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5h-1A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h4M8 7v4M15 9.5h.01M18 8h.01M7.5 5h9a4.5 4.5 0 0 1 4.4 5.4l-1 5a3 3 0 0 1-5.3 1.3L13.5 15h-3l-1.1 1.7a3 3 0 0 1-5.3-1.3l-1-5A4.5 4.5 0 0 1 7.5 5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l15-7-5 15-2.5-6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };
  function row(p, sub, actions, extra) {
    return `<div class="so-row" data-uid="${esc(p.id)}">${avatar(p)}<div class="so-who"><b>${esc(p.name)}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="so-act">${actions}</div>${extra || ''}</div>`;
  }
  function renderFriends() {
    const body = $('.so-body', dock); if (!body) return;
    const keepQ = (body.querySelector('[name=q]') || {}).value || '';
    const inc = incoming(), out = outgoing(), fr = friends();
    body.innerHTML = `<form class="so-search" role="search"><input class="field" name="q" type="search" placeholder="Spieler suchen (Name)" maxlength="30" autocomplete="off" value="${esc(keepQ)}" aria-label="Spieler suchen"></form>
      <div class="so-results" aria-live="polite"></div>
      ${!state.loaded ? '<p class="empty">Lädt …</p>' : ''}
      ${inc.length ? `<h4>Anfragen <span class="cnt">${inc.length}</span></h4>${inc.map((f) => row(prof(other(f)), 'möchte dein Freund sein',
        `<button class="sbtn pri" type="button" data-accept="${f.id}">Annehmen</button><button class="sbtn" type="button" data-decline="${f.id}">Ablehnen</button>`)).join('')}` : ''}
      ${state.loaded ? `<h4>Deine Freunde${fr.length ? ` · ${fr.length}` : ''}</h4>
      ${fr.length ? fr.map((f) => { const p = prof(other(f)), u = unreadOf(p.id); return row(p, u ? `<span class="so-new">${u === 1 ? '1 neue Nachricht' : `${u} neue Nachrichten`}</span>` : `<span class="so-st">${esc(statusLabel(p.id))}</span>`,
        `<button class="ibtn" type="button" data-chat="${esc(p.id)}" title="Chatten" aria-label="Mit ${esc(p.name)} chatten${u ? `, ${u} ungelesen` : ''}">${ICON.chat}${u ? `<b class="cnt">${u > 99 ? '99+' : u}</b>` : ''}</button>
         <button class="ibtn" type="button" data-challenge="${esc(p.id)}" title="Herausfordern" aria-label="${esc(p.name)} herausfordern">${ICON.play}</button>
         <button class="ibtn" type="button" data-more="${esc(p.id)}" title="Mehr" aria-label="Mehr zu ${esc(p.name)}" aria-expanded="false">${ICON.more}</button>`,
        `<div class="so-menu" hidden><button class="sbtn" type="button" data-remove="${f.id}">Entfernen</button><button class="sbtn bad" type="button" data-block="${esc(p.id)}">Blockieren</button></div>`); }).join('')
        : '<p class="empty">Noch keine Freunde. Such oben nach einem Namen und schick eine Anfrage.</p>'}` : ''}
      ${out.length ? `<h4>Gesendet</h4>${out.map((f) => row(prof(other(f)), 'wartet auf Antwort', `<button class="sbtn" type="button" data-decline="${f.id}">Zurückziehen</button>`)).join('')}` : ''}
      ${state.blocks.length ? `<details class="so-blocked"><summary>Blockiert · ${state.blocks.length}</summary>${state.blocks.map((b) => row(prof(b.blocked), '', `<button class="sbtn" type="button" data-unblock="${esc(b.blocked)}">Freigeben</button>`)).join('')}</details>` : ''}`;
    if (keepQ) search(keepQ, true);
  }

  async function search(q, quiet) {
    const box = dock && $('.so-results', dock); if (!box) return;
    q = q.trim(); lastQuery = q;
    if (!q) { box.innerHTML = ''; return; }
    if (!quiet) box.innerHTML = '<p class="empty">Sucht …</p>';
    const { data, error } = await db().rpc('search_players', { q });
    if (q !== lastQuery || !dock || tab !== 'friends') return;
    if (error) { box.innerHTML = `<p class="empty">${esc(deErr(error))}</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="empty">Niemand mit „${esc(q)}“ gefunden.</p>`; return; }
    data.forEach((p) => { state.profiles[p.id] = Object.assign(state.profiles[p.id] || {}, p); });
    box.innerHTML = `<div class="so-list">${data.map((p) => {
      const r = relation(p.id);
      const act = r.kind === 'friend' ? `<button class="sbtn" type="button" data-chat="${esc(p.id)}">Chatten</button>`
        : r.kind === 'out' ? '<span class="so-tag">Angefragt</span>'
        : r.kind === 'in' ? `<button class="sbtn pri" type="button" data-accept="${r.f.id}">Annehmen</button>`
        : r.kind === 'blocked' ? `<button class="sbtn" type="button" data-unblock="${esc(p.id)}">Freigeben</button>`
        : `<button class="sbtn pri" type="button" data-add="${esc(p.id)}">Anfrage senden</button>`;
      return row(p, '', act);
    }).join('')}</div>`;
  }

  /* ---------- Privat-Chat ---------- */
  function composer(where, ph) {
    return `<form class="so-compose" data-compose="${where}"><textarea class="field" name="t" rows="1" maxlength="${where === 'lobby' ? 500 : 1000}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" enterkeyhint="send"></textarea>
      <button class="ibtn pri" type="submit" title="Senden" aria-label="Senden">${ICON.send}</button></form><p class="so-err" aria-live="polite"></p>`;
  }
  function openChat(id) {
    if (state.loaded && !isFriend(id)) { toast('Ihr seid keine Freunde mehr.'); show('friends'); return; }
    show('chat');
    chat.with = id; chat.msgs = []; chat.more = true; chat.busy = false;
    const body = $('.so-body', dock), foot = $('.so-foot', dock);
    body.innerHTML = '<div class="so-msgs" aria-live="polite"><p class="empty">Lädt …</p></div>';
    foot.innerHTML = composer('chat', 'Nachricht schreiben'); foot.hidden = false;
    renderChatHead();
    loadChat(false).then(() => { const t = dock && foot.querySelector('textarea'); if (t && matchMedia('(pointer:fine)').matches) t.focus(); });
  }
  function renderChatHead() {
    if (!dock || tab !== 'chat' || !chat.with) return;
    const p = prof(chat.with), body = $('.so-body', dock);
    let head = $('.so-chathead', dock);
    if (!head) { head = document.createElement('div'); head.className = 'so-chathead'; body.before(head); }
    head.innerHTML = `<button class="ibtn" type="button" data-back="1" title="Zurück" aria-label="Zurück zur Freundesliste">${ICON.back}</button>${avatar(p)}<div class="so-who"><b>${esc(p.name)}</b><small class="so-stat">${esc(statusLabel(p.id))}</small></div>
      <button class="ibtn" type="button" data-challenge="${esc(p.id)}" title="Herausfordern" aria-label="${esc(p.name)} herausfordern">${ICON.play}</button>`;
  }
  async function loadChat(older) {
    if (chat.busy || (older && !chat.more)) return;
    chat.busy = true;
    const id = chat.with, uid = state.uid || me();
    let q = db().from('messages').select(MSG_COLS)
      .or(`and(sender.eq.${uid},recipient.eq.${id}),and(sender.eq.${id},recipient.eq.${uid})`)
      .order('created_at', { ascending: false }).limit(PAGE);
    if (older && chat.msgs.length) q = q.lt('created_at', chat.msgs[0].created_at);
    const { data, error } = await q;
    chat.busy = false;
    if (id !== chat.with || tab !== 'chat' || !dock) return;
    if (error) { const box = $('.so-msgs', dock); if (box) box.innerHTML = `<p class="empty">${esc(deErr(error))}</p>`; return; }
    const got = (data || []).reverse(), seen = new Set(chat.msgs.map((m) => m.id));
    chat.msgs = older ? got.filter((m) => !seen.has(m.id)).concat(chat.msgs) : got;
    chat.more = got.length === PAGE;
    renderMsgs(older ? 'keep' : 'bottom');
    if (!older) markRead();
  }
  async function markRead() {
    const id = chat.with; if (!id || !dockOpen() || tab !== 'chat') return;
    const unreadHere = chat.msgs.some((m) => m.sender === id && !m.read_at);
    if (!unreadHere && !unreadOf(id)) return;
    state.unread[id] = 0; updateBadge();
    const t = new Date().toISOString();
    chat.msgs.forEach((m) => { if (m.sender === id && !m.read_at) m.read_at = t; });
    await db().from('messages').update({ read_at: t }).eq('sender', id).eq('recipient', state.uid).is('read_at', null);
  }

  /* ---------- Nachrichten anzeigen (Privat und Lobby) ---------- */
  function msgHtml(m, kind) {
    const mine = m.sender === state.uid, p = prof(m.sender);
    const name = kind === 'lobby' ? (m.sender_name || p.name || 'Spieler') : p.name;
    const tick = mine && kind === 'chat' ? `<span class="tick${m.read_at ? ' read' : ''}" title="${m.read_at ? 'Gelesen' : 'Gesendet'}" aria-label="${m.read_at ? 'Gelesen' : 'Gesendet'}">${m.read_at ? '✓✓' : '✓'}</span>` : '';
    const acts = [];
    if (!mine) acts.push(`<button class="sbtn" type="button" data-mreport="${m.id}">Melden</button>`);
    if (kind === 'lobby' && (mine || isAdmin())) acts.push(`<button class="sbtn bad" type="button" data-ldel="${m.id}">Löschen</button>`);
    if (kind === 'lobby' && isAdmin() && !mine) acts.push(`<button class="sbtn" type="button" data-mute="${esc(m.sender)}">Stummschalten</button>`);
    return `<div class="msg-row${mine ? ' mine' : ''}" data-mid="${m.id}">
      ${kind === 'lobby' && !mine ? avatar({ id: m.sender, name, avatar_path: p.avatar_path }) : ''}
      <div class="msg-col">${kind === 'lobby' && !mine ? `<span class="msg-name">${esc(name)}</span>` : ''}
        <div class="bubble"${acts.length ? ' data-bubble="1" role="button" tabindex="0" aria-expanded="false" title="Antippen für Melden"' : ''}><span class="msg-t">${textHtml(m.body)}</span><span class="msg-meta">${hhmm(m.created_at)}${tick}</span></div>
        ${acts.length ? `<div class="msg-act" hidden>${acts.join('')}</div>` : ''}</div></div>`;
  }
  function renderMsgs(scroll) {
    if (!dock) return;
    const kind = tab === 'lobby' ? 'lobby' : 'chat', list = kind === 'lobby' ? lobby.msgs : chat.msgs, more = kind === 'lobby' ? lobby.more : chat.more;
    const body = $('.so-body', dock), box = $('.so-msgs', dock); if (!box) return;
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80, oldH = body.scrollHeight, oldTop = body.scrollTop;
    let html = more && list.length ? '<p class="so-older">Hochscrollen lädt ältere Nachrichten</p>' : '', day = '';
    if (!list.length) html = `<p class="empty so-hello">${kind === 'lobby' ? 'Noch ist es ruhig in der Lobby. Sag Hallo!' : `Schreib ${esc(prof(chat.with).name)} die erste Nachricht.`}</p>`;
    list.forEach((m) => { const d = dayLabel(m.created_at); if (d !== day) { day = d; html += `<p class="so-day"><span>${d}</span></p>`; } html += msgHtml(m, kind); });
    box.innerHTML = html;
    if (scroll === 'bottom' || (scroll === 'auto' && atBottom)) body.scrollTop = body.scrollHeight;
    else if (scroll === 'keep') body.scrollTop = oldTop + (body.scrollHeight - oldH);
  }
  function onScroll(e) {
    if (e.target.scrollTop > 60) return;
    if (tab === 'chat' && chat.msgs.length) loadChat(true); else if (tab === 'lobby' && lobby.msgs.length) loadLobby(true);
  }

  async function sendChat(text) {
    const id = chat.with;
    const { data, error } = await db().from('messages').insert({ recipient: id, body: text }).select(MSG_COLS).single();
    if (error) throw new Error(deErr(error, 'chat'));
    if (id === chat.with && data && !chat.msgs.some((m) => m.id === data.id)) { chat.msgs.push(data); renderMsgs('bottom'); }
  }
  /** Einladung (Herausforderung) als Chat-Nachricht schicken */
  async function sendInvite(id, text) {
    const { error } = await db().from('messages').insert({ recipient: id, body: String(text).slice(0, 1000) });
    if (error) throw new Error(deErr(error, 'chat'));
    if (dock && tab === 'chat' && chat.with === id) loadChat(false);
  }

  /* ---------- Lobby ---------- */
  function enterLobby() {
    const body = $('.so-body', dock), foot = $('.so-foot', dock);
    lobby.msgs = []; lobby.more = true; lobby.busy = false;
    body.innerHTML = '<p class="so-note so-lobbyinfo">Alle Angemeldeten lesen mit. Bleib fair. Unpassendes kannst du melden: Nachricht antippen.</p><div class="so-msgs" aria-live="polite"><p class="empty">Lädt …</p></div>';
    foot.innerHTML = composer('lobby', 'In die Lobby schreiben'); foot.hidden = false;
    loadLobby(false);
    if (!lobby.ch && db().channel) {
      lobby.ch = db().channel('lobby')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_messages' }, (p) => {
          const m = p.new; if (!m || lobby.msgs.some((x) => x.id === m.id)) return;
          loadProfiles(state.profiles[m.sender] ? [] : [m.sender]).catch(() => { }).then(() => {
            if (lobby.msgs.some((x) => x.id === m.id)) return;
            lobby.msgs.push(m); if (tab === 'lobby') renderMsgs('auto');
          });
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobby_messages' }, (p) => {
          const id = (p.old || {}).id; if (!lobby.msgs.some((x) => x.id === id)) return;
          lobby.msgs = lobby.msgs.filter((x) => x.id !== id); if (tab === 'lobby') renderMsgs('auto');
        })
        .subscribe();
    }
  }
  function leaveLobby() { if (lobby.ch) { try { db().removeChannel(lobby.ch); } catch (e) { } lobby.ch = null; } }
  async function loadLobby(older) {
    if (lobby.busy || (older && !lobby.more)) return;
    lobby.busy = true;
    let q = db().from('lobby_messages').select('id,sender,sender_name,body,created_at').order('created_at', { ascending: false }).limit(LOBBY_PAGE);
    if (older && lobby.msgs.length) q = q.lt('created_at', lobby.msgs[0].created_at);
    const { data, error } = await q;
    if (tab !== 'lobby' || !dock) { lobby.busy = false; return; }
    if (error) { lobby.busy = false; const box = $('.so-msgs', dock); if (box) box.innerHTML = `<p class="empty">${esc(deErr(error))}</p>`; return; }
    const got = (data || []).reverse();
    await loadProfiles(got.map((m) => m.sender).filter((id) => !state.profiles[id])).catch(() => { });
    lobby.busy = false;
    if (tab !== 'lobby' || !dock) return;
    const seen = new Set(lobby.msgs.map((m) => m.id));
    lobby.msgs = older ? got.filter((m) => !seen.has(m.id)).concat(lobby.msgs) : got.concat(lobby.msgs.filter((m) => !got.some((x) => x.id === m.id)));
    lobby.more = got.length === LOBBY_PAGE;
    renderMsgs(older ? 'keep' : 'bottom');
  }
  async function sendLobby(text) {
    const { data, error } = await db().from('lobby_messages').insert({ body: text }).select('id,sender,sender_name,body,created_at').single();
    if (error) throw new Error(deErr(error, 'lobby'));
    if (data && !lobby.msgs.some((m) => m.id === data.id)) { lobby.msgs.push(data); renderMsgs('bottom'); }
  }

  /* ---------- Nachricht melden ---------- */
  function reportForm(btn) {
    const act = btn.closest('.msg-act');
    act.innerHTML = `<form class="so-report" data-report-form="${esc(btn.dataset.mreport)}"><input class="field" name="why" maxlength="300" placeholder="Warum? (freiwillig)" aria-label="Grund der Meldung"><button class="sbtn pri" type="submit">Melden</button></form>`;
    act.querySelector('input').focus();
  }
  async function sendReport(form) {
    const id = Number(form.dataset.reportForm), kind = tab === 'lobby' ? 'lobby' : 'chat';
    const m = (kind === 'lobby' ? lobby.msgs : chat.msgs).find((x) => x.id === id); if (!m) return;
    const who = kind === 'lobby' ? (m.sender_name || prof(m.sender).name) : prof(m.sender).name, why = form.elements.why.value.trim();
    form.querySelector('button').disabled = true;
    try {
      await Auth.report({
        game: 'chat', title: `Chat-Nachricht gemeldet (${kind === 'lobby' ? 'Lobby' : 'Privat'})`,
        description: `Gemeldete Nachricht von ${who}, ${new Date(m.created_at).toLocaleString('de-DE')}:\n„${m.body}“` + (why ? `\n\nGrund: ${why}` : ''),
        context: { chat: kind, nachricht_id: m.id, absender_id: m.sender, absender: who, gesendet: m.created_at, text: m.body }
      });
      toast('Danke! Die Admins sehen sich das an.');
      form.closest('.msg-act').hidden = true;
    } catch (e) { toast(e.message); form.querySelector('button').disabled = false; }
  }

  /* ---------- Eingaben ---------- */
  async function run(btn, fn, okMsg) {
    btn.disabled = true;
    try { await fn(); if (okMsg) toast(okMsg); await load(); }
    catch (e) { toast(deErr(e)); btn.disabled = false; }
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }
  function onInput(e) {
    if (e.target.name === 'q') { clearTimeout(searchT); const v = e.target.value; searchT = setTimeout(() => search(v), 300); }
    if (e.target.name === 't') grow(e.target);
  }
  function onKey(e) {
    // Enter sendet, Umschalt+Enter macht eine neue Zeile
    if (e.target.name === 't' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); }
    if (e.target.dataset && e.target.dataset.bubble && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); }
  }
  async function onSubmit(e) {
    const f = e.target; e.preventDefault();
    if (f.classList.contains('so-search')) { clearTimeout(searchT); search(f.elements.q.value); return; }
    if (f.dataset.reportForm) { sendReport(f); return; }
    if (!f.dataset.compose) return;
    const t = f.elements.t, text = t.value.trim(), err = f.parentElement.querySelector('.so-err'), btn = f.querySelector('button');
    if (!text || btn.disabled) return;
    err.textContent = ''; btn.disabled = true;
    try { await (f.dataset.compose === 'lobby' ? sendLobby(text) : sendChat(text)); t.value = ''; grow(t); }
    catch (ex) { err.textContent = ex.message; }
    btn.disabled = false; if (dock) t.focus();
  }
  function onClick(e) {
    if (!dock) return;                                              // gerade geschlossen
    const link = e.target.closest('a.so-join');
    if (link) { if (matchMedia('(max-width:620px)').matches) close(); return; }    // Einladung annehmen: die Seite springt ins Spiel
    const bub = e.target.closest('[data-bubble]');
    if (bub) {
      const act = bub.parentElement.querySelector('.msg-act'), on = act.hidden;
      dock.querySelectorAll('.msg-act').forEach((x) => { x.hidden = true; });
      dock.querySelectorAll('[data-bubble]').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      act.hidden = !on; bub.setAttribute('aria-expanded', String(on));
      if (on) act.scrollIntoView({ block: 'nearest' });
      return;
    }
    const b = e.target.closest('button'); if (!b || !dock.contains(b)) return;
    const d = b.dataset, name = (id) => prof(id).name;
    if (d.more) {
      const menu = b.closest('.so-row').querySelector('.so-menu'), on = menu.hidden;
      dock.querySelectorAll('.so-menu').forEach((m) => { m.hidden = true; });
      dock.querySelectorAll('[data-more]').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      menu.hidden = !on; b.setAttribute('aria-expanded', String(on));
    } else if (d.chat) {
      openChat(d.chat);
    } else if (d.back) {
      show('friends');
    } else if (d.add) {
      run(b, async () => { const { error } = await db().from('friendships').insert({ addressee: d.add }); if (error) throw error; }, `Anfrage an ${name(d.add)} gesendet`);
    } else if (d.accept) {
      const f = state.friendships.find((x) => x.id === Number(d.accept));
      run(b, async () => { const { error } = await db().from('friendships').update({ status: 'accepted' }).eq('id', Number(d.accept)); if (error) throw error; }, f ? `Du bist jetzt mit ${name(other(f))} befreundet` : 'Angenommen');
    } else if (d.decline) {
      run(b, async () => { const { error } = await db().from('friendships').delete().eq('id', Number(d.decline)); if (error) throw error; });
    } else if (d.remove) {
      const f = state.friendships.find((x) => x.id === Number(d.remove)); if (!f) return;
      if (!confirm(`${name(other(f))} als Freund entfernen?`)) return;
      run(b, async () => { const { error } = await db().from('friendships').delete().eq('id', f.id); if (error) throw error; }, 'Freund entfernt');
    } else if (d.block) {
      const n = name(d.block);
      if (!confirm(`${n} blockieren? Ihr seid dann keine Freunde mehr, und ${n} kann dir keine Anfragen und Nachrichten mehr schicken.`)) return;
      run(b, async () => { const { error } = await db().from('blocks').insert({ blocked: d.block }); if (error) throw error; }, `${n} ist blockiert`);
    } else if (d.unblock) {
      run(b, async () => { const { error } = await db().from('blocks').delete().eq('blocked', d.unblock); if (error) throw error; }, `${name(d.unblock)} ist wieder freigegeben`);
    } else if (d.challenge) {
      challenge(d.challenge);
    } else if (d.pickGame) {
      const p = prof(d.pickFor);
      close(); Hub.startChallenge({ id: p.id, name: p.name }, d.pickGame);
    } else if (d.pickCancel) {
      if (d.pickCancel !== '1') openChat(d.pickCancel); else show('friends');
    } else if (d.mreport) {
      reportForm(b);
    } else if (d.ldel) {
      if (!confirm('Diese Lobby-Nachricht löschen?')) return;
      b.disabled = true;
      db().from('lobby_messages').delete().eq('id', Number(d.ldel)).then(({ error }) => {
        if (error) { toast(deErr(error)); b.disabled = false; return; }
        lobby.msgs = lobby.msgs.filter((x) => x.id !== Number(d.ldel)); renderMsgs('keep');
      });
    } else if (d.mute) {
      const m = lobby.msgs.find((x) => x.sender === d.mute), n = (m && m.sender_name) || name(d.mute);
      const min = prompt(`${n} in der Lobby stummschalten. Wie viele Minuten? (0 hebt es auf)`, '60');
      if (min === null) return;
      const v = Math.max(0, Math.min(525600, parseInt(min, 10) || 0));
      db().rpc('set_chat_mute', { target: d.mute, minutes: v }).then(({ error }) => toast(error ? deErr(error) : v ? `${n} ist ${v} Minuten stumm` : `${n} darf wieder schreiben`));
    }
  }

  /* ---------- Herausfordern: Spiel wählen, Raum öffnen, Einladung als Nachricht ---------- */
  function challenge(id) {
    const p = prof(id), games = window.Hub && Hub.onlineGames ? Hub.onlineGames() : [];
    const from = tab === 'chat' ? id : '1';
    const head = $('.so-chathead', dock); if (head) head.remove();
    $('.so-foot', dock).hidden = true;
    $('.so-body', dock).innerHTML = `<h4>${esc(p.name)} herausfordern</h4>
      ${games.length ? `<p class="so-note">Wähle ein Spiel. Es öffnet sich ein Raum, und ${esc(p.name)} bekommt die Einladung als Nachricht.</p>
        <div class="so-games">${games.map((g) => `<button class="btn" type="button" data-pick-game="${esc(g.id)}" data-pick-for="${esc(p.id)}">${esc(g.title)}</button>`).join('')}</div>`
        : '<p class="empty">Gerade gibt es kein Online-Spiel.</p>'}
      <button class="sbtn so-back" type="button" data-pick-cancel="${esc(from)}">Zurück</button>`;
  }

  /* ---------- Online-Status ---------- */
  const AWAY_AFTER = 5 * 60e3, SEEN_EVERY = 60e3;
  const pres = { ch: null, joined: false, tracking: false, map: {}, mine: 'online', mode: 'auto', lastInput: Date.now(), seenAt: 0, timer: 0 };
  const DOT = { online: 'on', abwesend: 'away', offline: 'off', invisible: 'off' };
  function ago(t) {
    const s = Math.max(0, (Date.now() - new Date(t)) / 1000);
    if (s < 3600) return `vor ${Math.max(1, Math.floor(s / 60))} Min.`;
    if (s < 86400) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `vor ${h} Std.${m && h < 6 ? ` ${m} Min.` : ''}`; }
    const d = Math.round(s / 86400);
    return d < 30 ? (d === 1 ? 'vor 1 Tag' : `vor ${d} Tagen`) : 'am ' + new Date(t).toLocaleDateString('de-DE');
  }
  function statusOf(id) {
    if (id && id === state.uid) return pres.mode === 'invisible' ? 'invisible' : pres.mine;
    return pres.map[id] || 'offline';
  }
  function statusLabel(id) {
    const s = statusOf(id);
    if (s === 'online') return 'Online';
    if (s === 'abwesend') return 'Abwesend';
    if (s === 'invisible') return 'Unsichtbar: andere sehen dich offline';
    const seen = state.profiles[id] && state.profiles[id].last_seen_at;
    return seen ? `Offline, zuletzt ${ago(seen)}` : 'Offline';
  }
  // Punkt an ein Profilbild (span.av mit data-uid) hängen oder aktualisieren
  function paintOne(av) {
    const id = av.dataset.uid, old = av.querySelector(':scope > .dot');
    if (!id || !state.uid) { if (old) old.remove(); return; }
    const s = statusOf(id), cls = 'dot ' + DOT[s], label = statusLabel(id);
    const d = old || av.appendChild(document.createElement('i'));
    if (d.className !== cls) d.className = cls;
    if (av.title !== label) av.title = label;
    if (!av.closest('[aria-hidden=true]') && av.getAttribute('aria-label') !== label) { av.setAttribute('role', 'img'); av.setAttribute('aria-label', label); }
    if (s === 'offline' && !(state.profiles[id] && 'last_seen_at' in state.profiles[id])) needSeen(id);
  }
  function paint() {
    document.querySelectorAll('.av[data-uid]').forEach(paintOne);
    document.querySelectorAll('[data-stat]').forEach((el) => { const t = statusLabel(el.dataset.stat); if (el.textContent !== t) el.textContent = t; });
    if (dock) {
      dock.querySelectorAll('.so-row[data-uid] .so-st').forEach((el) => { const t = statusLabel(el.closest('.so-row').dataset.uid); if (el.textContent !== t) el.textContent = t; });
      const st = $('.so-stat', dock); if (st && chat.with) st.textContent = statusLabel(chat.with);
    }
  }
  // „zuletzt online“ für Spieler nachladen, die noch nicht im Speicher sind (Rangliste, Admin)
  const seenWanted = new Set(); let seenT = 0;
  function needSeen(id) {
    if (seenWanted.has(id)) return;
    seenWanted.add(id); clearTimeout(seenT);
    seenT = setTimeout(() => { const ids = [...seenWanted]; loadProfiles(ids).then(paint).catch(() => { }); }, 300);
  }
  function readPresence() {
    const raw = pres.ch ? pres.ch.presenceState() : {}, map = {};
    Object.keys(raw).forEach((k) => (raw[k] || []).forEach((m) => {
      const id = m.user_id || k; if (map[id] === 'online') return;
      map[id] = m.status === 'abwesend' ? 'abwesend' : 'online';
    }));
    delete map[state.uid];
    // Wer gerade offline gegangen ist: „zuletzt online“ neu laden
    const gone = Object.keys(pres.map).filter((id) => !map[id]);
    pres.map = map; paint();
    if (gone.length) { gone.forEach((id) => { if (state.profiles[id]) delete state.profiles[id].last_seen_at; }); loadProfiles(gone).then(paint).catch(() => { }); }
  }
  const computeMine = () => (document.hidden || Date.now() - pres.lastInput > AWAY_AFTER ? 'abwesend' : 'online');
  function pushStatus(force) {
    if (!state.uid) return;
    const s = computeMine(), changed = s !== pres.mine;
    pres.mine = s;
    if (pres.ch && pres.joined) {
      if (pres.mode === 'invisible') { if (pres.tracking) { pres.ch.untrack(); pres.tracking = false; } }
      else if (force || changed || !pres.tracking) { pres.ch.track({ user_id: state.uid, status: s }); pres.tracking = true; }
    }
    if (changed || force) paint();
    if (pres.mode !== 'invisible' && Date.now() - pres.seenAt > SEEN_EVERY - 3000) touchSeen();
  }
  function touchSeen() {
    pres.seenAt = Date.now();
    db().from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', state.uid).then(() => { }, () => { });
  }
  async function startPresence(uid) {
    stopPresence();
    const c = db(); if (!c || !c.channel) return;
    const tok = pres.tok;
    try {
      const { data } = await c.from('profiles').select('presence_mode').eq('id', uid).maybeSingle();
      pres.mode = data && data.presence_mode === 'invisible' ? 'invisible' : 'auto';
    } catch (e) { pres.mode = 'auto'; }
    if (tok !== pres.tok || uid !== me()) return;                      // inzwischen neu gestartet oder abgemeldet
    pres.lastInput = Date.now(); pres.mine = computeMine();
    pres.ch = c.channel('online', { config: { presence: { key: uid } } })
      .on('presence', { event: 'sync' }, readPresence)
      .subscribe((st) => { if (st === 'SUBSCRIBED') { pres.joined = true; pushStatus(true); } });
    let n = 0;
    pres.timer = setInterval(() => { pushStatus(false); if (++n % 3 === 0) paint(); }, 20000);   // „vor … Min.“ aktuell halten
    paint();
  }
  function stopPresence() {
    pres.tok = (pres.tok || 0) + 1; clearInterval(pres.timer);
    if (pres.ch) { try { if (pres.tracking) pres.ch.untrack(); db().removeChannel(pres.ch); } catch (e) { } }
    pres.ch = null; pres.joined = false; pres.tracking = false; pres.map = {};
  }
  /** Mein Status: 'auto' (online/abwesend) oder 'invisible' (erscheint offline) */
  async function setMode(mode) {
    mode = mode === 'invisible' ? 'invisible' : 'auto';
    const { error } = await db().from('profiles').update({ presence_mode: mode }).eq('id', state.uid);
    if (error) throw new Error(deErr(error));
    pres.mode = mode; pushStatus(true);
    if (mode === 'auto') touchSeen();
  }
  // Eingaben merken: wer 5 Minuten nichts tut oder den Tab wechselt, ist „abwesend“
  let inputT = 0;
  const onActivity = () => {
    const now = Date.now(); if (now - inputT < 1000) return; inputT = now;
    pres.lastInput = now; if (pres.mine === 'abwesend' && !document.hidden) pushStatus(false);
  };
  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'].forEach((ev) => addEventListener(ev, onActivity, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pres.lastInput = Date.now(); pushStatus(false); });
  // Neue Profilbilder auf der Seite bekommen den Punkt automatisch
  function watchAvatars() {
    if (!document.body || watchAvatars.on) return; watchAvatars.on = true;
    new MutationObserver((muts) => {
      const todo = new Set();
      muts.forEach((m) => {
        if (m.type === 'attributes') { if (m.target.matches && m.target.matches('.av')) todo.add(m.target); return; }
        const t = m.target.nodeType === 1 && m.target.closest ? m.target.closest('.av[data-uid]') : null; if (t) todo.add(t);
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches('.av[data-uid]')) todo.add(n);
          if (n.querySelector && n.querySelector('[data-stat]')) setTimeout(paint, 0);
          if (n.firstElementChild) n.querySelectorAll('.av[data-uid]').forEach((a) => todo.add(a));
        });
      });
      todo.forEach(paintOne);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-uid'] });
  }
  watchAvatars(); document.addEventListener('DOMContentLoaded', watchAvatars);

  /* ---------- Live-Updates ---------- */
  function onMessage(payload) {
    const m = payload.new; if (!m || !m.id) return;
    if (payload.eventType === 'UPDATE') {                     // Gelesen-Haken für eigene Nachrichten
      const x = chat.msgs.find((y) => y.id === m.id);
      if (x && m.read_at && !x.read_at) { x.read_at = m.read_at; if (tab === 'chat') renderMsgs('auto'); }
      return;
    }
    if (m.recipient !== state.uid) return;
    if (dock && tab === 'chat' && chat.with === m.sender) {
      if (!chat.msgs.some((y) => y.id === m.id)) { chat.msgs.push(m); renderMsgs('auto'); }
      if (!document.hidden) markRead(); else { state.unread[m.sender] = unreadOf(m.sender) + 1; updateBadge(); }
      return;
    }
    state.unread[m.sender] = unreadOf(m.sender) + 1; updateBadge();
    if (dock && tab === 'friends') renderFriends();
    const say = () => toast(`Neue Nachricht von ${prof(m.sender).name}`);
    if (state.profiles[m.sender]) say(); else loadProfiles([m.sender]).then(say).catch(() => { });
  }
  function subscribe(uid) {
    unsubscribe();
    const c = db();
    if (!c || !c.channel) return;
    const onRow = (payload) => {
      const n = payload.new || {};
      if (payload.eventType === 'INSERT' && n.addressee === uid && n.status === 'pending') {
        loadProfiles([n.requester]).then(() => toast(`${prof(n.requester).name} möchte dein Freund sein`)).catch(() => { });
      }
      if (payload.eventType === 'UPDATE' && n.requester === uid && n.status === 'accepted') {
        loadProfiles([n.addressee]).then(() => toast(`${prof(n.addressee).name} hat deine Anfrage angenommen`)).catch(() => { });
      }
      reload();
    };
    channel = c.channel('freunde-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee=eq.${uid}` }, onRow)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester=eq.${uid}` }, onRow)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friendships' }, (p) => {
        if (state.friendships.some((f) => f.id === (p.old || {}).id)) reload();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${uid}` }, onMessage)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender=eq.${uid}` }, onMessage)
      .subscribe();
  }
  function unsubscribe() { if (channel) { try { db().removeChannel(channel); } catch (e) { } channel = null; } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && dock && tab === 'chat') markRead(); });

  /* ---------- An- und Abmelden ---------- */
  function onAuth() {
    const uid = me();
    const btn = $('#friendsBtn'); if (btn) btn.hidden = !(window.Auth && Auth.ready);
    if (uid && uid === state.uid && (state.loaded || pres.ch)) return;
    unsubscribe(); clearInterval(pollT); leaveLobby(); stopPresence();
    state.uid = uid; state.friendships = []; state.blocks = []; state.unread = {}; state.loaded = false; updateBadge();
    if (!uid) { close(); paint(); return; }
    startPresence(uid);
    if (!$('#friendsBtn')) return;                                    // Admin-Programm: nur Online-Status
    load().catch((e) => console.warn(e));
    subscribe(uid);
    pollT = setInterval(() => { if (!document.hidden) reload(); }, 60000);   // falls Live-Updates mal ausfallen
  }
  if (window.Auth) Auth.onChange(onAuth);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && dock && !document.querySelector('.sheet')) close(); });
  function bindButton() { const b = $('#friendsBtn'); if (b && !b.onclick) b.onclick = () => (dock ? close() : open()); }
  bindButton(); document.addEventListener('DOMContentLoaded', bindButton);

  window.Social = { open, close, avatar, reload, sendInvite, state, isFriend, setMode, mode: () => pres.mode, statusLabel, statusOf, paint };
})();
