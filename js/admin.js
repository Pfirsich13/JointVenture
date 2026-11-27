/* =========================================================================
   admin.js – Admin-Panel (nur für Admins sichtbar, Adresse #admin)
   -------------------------------------------------------------------------
   Bereiche: Übersicht, Texte, Spiele (inkl. Upload), Projekte, Spieler,
   Einstellungen (Ankündigung, Wartungsmodus), Backup (in Google Drive),
   Meldungen (Fehler von Spielern) und Konsole (Befehle, siehe console.js).
   Die Datenbank prüft selbst, ob jemand Admin ist. Dieses Panel ist nur
   die Oberfläche dafür.
   ========================================================================= */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = () => Auth.client();
  const now = () => new Date().toISOString();
  const TABS = [
    ['overview', 'Übersicht'], ['reports', 'Meldungen'], ['texts', 'Texte'], ['games', 'Spiele'],
    ['projects', 'Projekte'], ['players', 'Spieler'], ['settings', 'Einstellungen'], ['backup', 'Backup'], ['console', 'Konsole']
  ];
  const STATUS_OPTS = [['live', 'Spielbar'], ['beta', 'Beta'], ['soon', 'Bald'], ['hidden', 'Versteckt'], ['review', 'Zur Freigabe']];
  let root = null, ctx = null, tab = 'overview';
  try { tab = sessionStorage.getItem('jv_admin_tab') || 'overview'; } catch (e) { }

  function ago(t) {
    const m = Math.round((Date.now() - Date.parse(t)) / 60000);
    if (m < 1) return 'gerade eben'; if (m < 60) return `vor ${m} Min.`;
    const h = Math.round(m / 60); if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24); return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  }
  const slug = (t) => String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  async function saved(msg) { await ctx.refresh(); ctx.toast(msg || 'Gespeichert'); }
  function fail(e) { console.error(e); ctx.toast('Fehler: ' + ((e && e.message) || e)); }
  function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.textContent = 'Speichert …'; } else if (btn.dataset.t) btn.textContent = btn.dataset.t; }

  /* ---------- Gerüst ---------- */
  function render(el, context) {
    root = el; ctx = context;
    if (ctx.tab && TABS.some(([t]) => t === ctx.tab)) tab = ctx.tab;
    root.innerHTML = `<div class="wrap adm">
      ${ctx.app ? '' : '<div class="adm-head"><div><p class="kicker">Admin</p><h1>Seite verwalten</h1></div><div class="row"><a class="btn" href="konsole/" target="_blank" rel="noopener">Admin-Programm</a><a class="btn" href="#">Zur Seite</a></div></div>'}
      <nav class="adm-tabs" role="tablist">${TABS.map(([id, n]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === tab}">${n}</button>`).join('')}</nav>
      <div class="adm-body" id="admBody"><p class="empty">Lädt …</p></div></div>`;
    root.querySelector('.adm-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (b) goTab(b.dataset.tab);
    });
    show(); updateBadge();
  }
  // Zahl offener Meldungen am Reiter
  async function updateBadge() {
    const { count } = await db().from('reports').select('id', { count: 'exact', head: true }).in('status', ['neu', 'in_arbeit']);
    const b = root && root.querySelector('[data-tab=reports]'); if (!b) return;
    b.innerHTML = 'Meldungen' + (count ? ` <span class="badge">${count}</span>` : '');
  }
  // Links zur Seite (im Admin-Programm liegt die Seite einen Ordner höher)
  const siteLink = (hash) => (ctx && ctx.app ? '../' : '') + (hash ? '#' + hash : '');
  function goTab(id) {
    if (!TABS.some(([t]) => t === id)) return;
    tab = id; try { sessionStorage.setItem('jv_admin_tab', tab); } catch (err) { }
    root.querySelectorAll('.adm-tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === id)));
    show();
  }
  function show() {
    // frisches Element, damit keine alten Klick-Handler hängen bleiben
    const old = root.querySelector('#admBody'), body = old.cloneNode(false); old.replaceWith(body);
    body.innerHTML = '<p class="empty">Lädt …</p>';
    ({ overview, reports, texts, games, projects, players, settings, backup, console: konsole })[tab](body).catch((e) => { body.innerHTML = `<p class="msg">Konnte nicht laden: ${esc(e.message || e)}</p>`; });
  }

  /* ---------- Übersicht ---------- */
  async function overview(body) {
    const [pr, rs, rp] = await Promise.all([
      db().from('profiles').select('id,name,role,created_at'),
      db().from('results').select('user_id,game,mode,won,score,opponent,created_at').order('created_at', { ascending: false }).limit(1000),
      db().from('reports').select('id', { count: 'exact', head: true }).in('status', ['neu', 'in_arbeit'])
    ]);
    if (pr.error) throw pr.error; if (rs.error) throw rs.error;
    const openReports = rp.count || 0;
    const names = Object.fromEntries(pr.data.map((p) => [p.id, p.name]));
    const res = rs.data, today = new Date().toDateString();
    const todayCount = res.filter((r) => new Date(r.created_at).toDateString() === today).length;
    const online = res.filter((r) => r.mode === 'online').length;
    const perGame = {}; res.forEach((r) => { perGame[r.game] = (perGame[r.game] || 0) + 1; });
    const titles = Object.fromEntries((Content.get().games || []).map((g) => [g.id, g.title]));
    const top = Object.entries(perGame).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = top.length ? top[0][1] : 1;
    const pending = (Content.get().games || []).filter((g) => g.status === 'review');
    const bk = Content.get().backup, bkDays = bk && bk.at ? (Date.now() - Date.parse(bk.at)) / 864e5 : Infinity;
    body.innerHTML = `
      ${bkDays > 7 ? `<div class="panel bk-remind"><span>${bk && bk.at ? `Letztes Backup ${ago(bk.at)}.` : 'Es gibt noch kein Backup.'} Sichere die Seite in Google Drive.</span><button class="btn primary" type="button" data-go="backup">Jetzt sichern</button></div>` : ''}
      ${pending.length ? `<div class="panel pending-box"><h3>Wartet auf deine Freigabe</h3>${pending.map((g) => `<div class="pend" data-id="${esc(g.id)}"><span><b>${esc(g.title)}</b><small>${g.version ? 'Version ' + esc(g.version) + ' · ' : ''}<a href="${siteLink(g.id)}" ${ctx.app ? 'target="_blank" rel="noopener"' : ''}>Jetzt testen</a></small></span><span class="pend-btns"><button class="btn" type="button" data-release="beta">Als Beta</button><button class="btn primary" type="button" data-release="live">Spielbar</button></span></div>`).join('')}</div>` : ''}
      <div class="kpis">
        <div class="kpi"><strong>${pr.data.length}</strong><span>Spieler</span></div>
        <div class="kpi"><strong>${res.length}</strong><span>Matches gesamt</span></div>
        <div class="kpi"><strong>${todayCount}</strong><span>Matches heute</span></div>
        <div class="kpi"><strong>${online}</strong><span>davon online</span></div>
        <button class="kpi kpi-btn ${openReports ? 'warn' : ''}" type="button" data-go="reports"><strong>${openReports}</strong><span>offene Meldungen</span></button>
      </div>
      <div class="adm-grid">
        <div class="panel"><h3>Beliebteste Spiele</h3>${top.length ? top.map(([g, n]) => `<div class="hbar"><span>${esc(titles[g] || g)}</span><div><i style="width:${Math.round(n / max * 100)}%"></i></div><b>${n}</b></div>`).join('') : '<p class="empty">Noch keine Matches.</p>'}</div>
        <div class="panel"><h3>Letzte Matches</h3>${res.length ? `<ol class="hist">${res.slice(0, 10).map((r) => `<li><span><b>${esc(names[r.user_id] || 'Spieler')}: ${esc(titles[r.game] || r.game)} gegen ${esc(r.opponent || 'Gegner')}</b><small>${r.mode === 'online' ? 'Online' : r.mode === 'bot' ? 'Training' : 'Lokal'} · ${ago(r.created_at)}</small></span><span class="sc">${esc(r.score || '')}</span><span class="res ${r.won ? 'w' : 'l'}">${r.won ? 'Sieg' : 'Niederlage'}</span></li>`).join('')}</ol>` : '<p class="empty">Noch keine Matches.</p>'}</div>
      </div>`;
  }

  document.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b && root && root.contains(b)) goTab(b.dataset.go); });

  // Freischalten (Übersicht und Spiele-Karten)
  async function release(id, status) {
    const { error } = await db().from('games').update({ status, updated_at: now() }).eq('id', id);
    if (error) return fail(error);
    await saved(status === 'live' ? 'Freigeschaltet: jetzt für alle spielbar' : 'Als Beta freigeschaltet'); show();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-release]'); if (!b || !root || !root.contains(b)) return;
    release(b.closest('[data-id]').dataset.id, b.dataset.release);
  });

  /* ---------- Meldungen (Fehler von Spielern) ---------- */
  const R_STATUS = [['neu', 'Neu', ''], ['in_arbeit', 'In Arbeit', 'beta'], ['erledigt', 'Erledigt', 'ok'], ['abgelehnt', 'Kein Fehler', 'off']];
  const rLabel = (st) => (R_STATUS.find((x) => x[0] === st) || R_STATUS[0]);
  const R_FILTERS = [['offen', 'Offen', ['neu', 'in_arbeit']], ['neu', 'Neu', ['neu']], ['erledigt', 'Erledigt', ['erledigt', 'abgelehnt']], ['alle', 'Alle', null]];
  let rFilter = 'offen';

  async function loadReports(filter, id) {
    let q = db().from('reports').select('*').order('created_at', { ascending: false }).limit(200);
    if (id) q = q.eq('id', id);
    else { const f = (R_FILTERS.find((x) => x[0] === filter) || R_FILTERS[0])[2]; if (f) q = q.in('status', f); }
    const { data, error } = await q; if (error) throw error;
    return data;
  }
  async function shotUrl(path, seconds) {
    if (!path) return null;
    const { data, error } = await db().storage.from('reports').createSignedUrl(path, seconds || 3600);
    return error ? null : data.signedUrl;
  }
  // Meldung als Text für Claude (Markdown)
  async function reportMarkdown(r, withShot) {
    const c = r.context || {}, g = (Content.get().games || []).find((x) => x.id === r.game);
    const shot = withShot && r.screenshot_path ? await shotUrl(r.screenshot_path, 7 * 24 * 3600) : null;
    const lines = [
      `## Fehlermeldung #${r.id}: ${r.title}`,
      `- Spiel: ${r.game ? `${g ? g.title : r.game} (${r.game})` : 'Allgemein / Webseite'}`,
      `- Gemeldet von: ${r.reporter || 'unbekannt'}, ${new Date(r.created_at).toLocaleString('de-DE')}`,
      `- Status: ${rLabel(r.status)[1]}${r.admin_note ? ` · Antwort: ${r.admin_note}` : ''}`,
      `- Gerät: ${c.browser || '?'}`,
      `- Bildschirm ${c.bildschirm || '?'}, Fenster ${c.fenster || '?'}, Pixel ${c.pixel || '?'}${c.touch ? ', Touch' : ''}${c.online === false ? ', OFFLINE' : ''}`,
      `- Seite: ${c.seite || '?'}${c.spiel_offen ? ` (offenes Spiel: ${c.spiel_offen})` : ''} · Version ${c.version || '?'}`,
      '', '### Beschreibung', r.description
    ];
    if (c.fehler && c.fehler.length) lines.push('', '### Letzte Fehlermeldungen im Browser', ...c.fehler.map((e) => `- ${e.t} ${e.m}`));
    if (shot) lines.push('', '### Bildschirmfoto (Link 7 Tage gültig)', shot);
    return lines.join('\n');
  }
  const CLAUDE_INTRO = 'Bitte prüfe und behebe diese Fehler auf unserer Spieleseite JointVenture (Repo Pfirsich13/JointVenture, Supabase-Projekt gekavukdzlhnhgpjyyyd). Setze die Meldungen danach im Admin-Panel auf „Erledigt“.\n\n';
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove(); return ok;
    }
  }
  async function copyForClaude(list) {
    const parts = []; for (const r of list) parts.push(await reportMarkdown(r, true));
    return copyText(CLAUDE_INTRO + parts.join('\n\n---\n\n'));
  }
  async function setReport(id, upd) {
    const { error } = await db().from('reports').update(Object.assign({ updated_at: now() }, upd)).eq('id', id);
    if (error) throw error;
  }

  async function reports(body) {
    const list = await loadReports(rFilter);
    const games = Object.fromEntries((Content.get().games || []).map((g) => [g.id, g.title]));
    body.innerHTML = `
      <div class="rep-bar"><div class="chips">${R_FILTERS.map(([id, n]) => `<button type="button" class="chip" data-filter="${id}" aria-pressed="${id === rFilter}">${n}</button>`).join('')}</div>
        ${list.length ? '<button class="btn" type="button" id="copyAll">Alle hier für Claude kopieren</button>' : ''}</div>
      <p class="hint">Spieler melden Fehler über „Fehler melden“ auf der Seite. Mit „Für Claude kopieren“ landet alles Nötige in der Zwischenablage, dann einfach im Chat einfügen.</p>
      <div class="cards">${list.length ? list.map((r) => {
        const [, lab, cls] = rLabel(r.status), c = r.context || {};
        return `<article class="panel card rep" data-id="${r.id}">
          <div class="card-head"><div><b>#${r.id} · ${esc(r.title)}</b><small>${esc(r.game ? (games[r.game] || r.game) : 'Allgemein')} · von ${esc(r.reporter || 'unbekannt')} · ${ago(r.created_at)}</small></div><span class="pill ${cls}">${lab}</span></div>
          <p class="rep-desc">${esc(r.description)}</p>
          ${r.screenshot_path ? '<a class="rep-shot" data-shot target="_blank" rel="noopener">Bildschirmfoto wird geladen …</a>' : ''}
          <details class="rep-tech"><summary>Technische Daten${c.fehler && c.fehler.length ? ` · ${c.fehler.length} Fehlermeldung${c.fehler.length > 1 ? 'en' : ''}` : ''}</summary>
            <dl><dt>Gerät</dt><dd>${esc(c.browser)}</dd><dt>Bildschirm</dt><dd>${esc(c.bildschirm)} · Fenster ${esc(c.fenster)} · Pixel ${esc(c.pixel)}${c.touch ? ' · Touch' : ''}</dd>
            <dt>Seite</dt><dd>${esc(c.seite)}${c.spiel_offen ? ' · offenes Spiel: ' + esc(c.spiel_offen) : ''} · Version ${esc(c.version)}</dd><dt>Zeit</dt><dd>${esc(c.zeit)}</dd></dl>
            ${c.fehler && c.fehler.length ? `<pre>${c.fehler.map((e) => esc(e.t + ' ' + e.m)).join('\n')}</pre>` : '<p class="hint">Keine technischen Fehlermeldungen.</p>'}</details>
          <form class="form">
            <div class="f2"><label class="f"><span>Status</span><select class="field" name="status">${R_STATUS.map(([v, n]) => `<option value="${v}" ${v === r.status ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="f"><span>Antwort an ${esc(r.reporter || 'den Spieler')} (sieht er bei seinen Meldungen)</span><input class="field" name="admin_note" maxlength="2000" value="${esc(r.admin_note || '')}"></label></div>
            <div class="row"><button class="btn danger" type="button" data-act="del">Löschen</button><button class="btn" type="button" data-act="claude">Für Claude kopieren</button><button class="btn primary" type="submit">Speichern</button></div>
          </form></article>`;
      }).join('') : `<p class="empty">${rFilter === 'offen' ? 'Keine offenen Meldungen. Alles läuft!' : 'Keine Meldungen in dieser Ansicht.'}</p>`}</div>`;
    // Bildschirmfotos nachladen (private Links, eine Stunde gültig)
    body.querySelectorAll('[data-shot]').forEach(async (a) => {
      const r = list.find((x) => String(x.id) === a.closest('[data-id]').dataset.id), url = await shotUrl(r.screenshot_path);
      if (url) { a.href = url; a.innerHTML = `<img src="${esc(url)}" alt="Bildschirmfoto">`; } else a.textContent = 'Bildschirmfoto nicht gefunden';
    });
    body.addEventListener('click', async (e) => {
      const fb = e.target.closest('[data-filter]');
      if (fb) { rFilter = fb.dataset.filter; show(); return; }
      if (e.target.closest('#copyAll')) { ctx.toast(await copyForClaude(list) ? `${list.length} Meldung${list.length > 1 ? 'en' : ''} kopiert, jetzt im Chat einfügen` : 'Kopieren ging nicht'); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const r = list.find((x) => String(x.id) === b.closest('[data-id]').dataset.id);
      if (b.dataset.act === 'claude') { ctx.toast(await copyForClaude([r]) ? 'Kopiert, jetzt im Chat bei Claude einfügen' : 'Kopieren ging nicht'); return; }
      if (b.dataset.act === 'del') {
        if (!confirm(`Meldung #${r.id} „${r.title}“ löschen?`)) return;
        try {
          if (r.screenshot_path) await db().storage.from('reports').remove([r.screenshot_path]);
          const { error } = await db().from('reports').delete().eq('id', r.id); if (error) throw error;
          ctx.toast('Meldung gelöscht'); show(); updateBadge();
        } catch (err) { fail(err); }
      }
    });
    body.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, id = Number(f.closest('[data-id]').dataset.id), btn = f.querySelector('[type=submit]'); busy(btn, true);
      try { await setReport(id, { status: f.elements.status.value, admin_note: f.elements.admin_note.value.trim() || null }); ctx.toast('Meldung gespeichert'); show(); updateBadge(); }
      catch (err) { busy(btn, false); fail(err); }
    });
  }

  /* ---------- Konsole ---------- */
  async function konsole(body) {
    if (!window.AdminConsole) { body.innerHTML = '<p class="msg">Die Konsole konnte nicht geladen werden.</p>'; return; }
    window.AdminConsole.mount(body, api);
  }

  /* ---------- Texte ---------- */
  const TEXT_FIELDS = [
    ['name', 'Name der Seite', 'input', 40],
    ['kicker', 'Kleine Zeile über der Überschrift', 'input', 60],
    ['tagline', 'Große Überschrift', 'input', 80],
    ['lead', 'Einleitungstext', 'textarea', 300],
    ['gamesHint', 'Text neben „Spiele“', 'input', 80],
    ['standHint', 'Text neben „Spielstände“ (leer = automatisch)', 'input', 80],
    ['projectsHint', 'Text neben „In Arbeit“', 'input', 80],
    ['footer', 'Fußzeile', 'input', 120]
  ];
  async function texts(body) {
    const site = Content.get().site || {};
    body.innerHTML = `<form class="panel form" id="txtForm">
      ${TEXT_FIELDS.map(([k, label, type, max]) => `<label class="f"><span>${label}</span>${type === 'textarea'
        ? `<textarea class="field" name="${k}" maxlength="${max}" rows="3">${esc(site[k])}</textarea>`
        : `<input class="field" name="${k}" maxlength="${max}" value="${esc(site[k])}">`}</label>`).join('')}
      <div class="row"><button class="btn primary" type="submit">Texte speichern</button></div></form>`;
    const f = body.querySelector('#txtForm');
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = f.querySelector('[type=submit]'); busy(btn, true);
      const value = {}; TEXT_FIELDS.forEach(([k]) => { value[k] = f.elements[k].value.trim(); });
      if (!value.name) value.name = 'JointVenture';
      const { error } = await db().from('site_settings').upsert({ key: 'site', value, updated_at: now() });
      busy(btn, false); if (error) return fail(error); saved('Texte gespeichert');
    });
  }

  /* ---------- Spiele ---------- */
  async function uploadFile(path, file, asText) {
    const blob = asText ? new Blob([await file.text()], { type: 'text/plain' }) : file;
    const { error } = await db().storage.from('games').upload(path, blob, { upsert: true, contentType: asText ? 'text/plain' : file.type, cacheControl: '60' });
    if (error) throw error;
  }
  function checkHtml(file) {
    if (!file) return 'Bitte eine HTML-Datei auswählen.';
    if (!/\.html?$/i.test(file.name)) return 'Die Spieldatei muss eine .html-Datei sein.';
    if (file.size > 20 * 1024 * 1024) return 'Die Datei ist größer als 20 MB.';
    return '';
  }
  function checkImg(file) {
    if (!file) return '';
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return 'Titelbild bitte als PNG, JPG oder WebP.';
    if (file.size > 5 * 1024 * 1024) return 'Das Titelbild ist größer als 5 MB.';
    return '';
  }
  const imgExt = (f) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[f.type]);

  async function games(body) {
    const { data: list, error } = await db().from('games').select('*').order('sort').order('title');
    if (error) throw error;
    body.innerHTML = `
      <details class="panel new" ${list.length ? '' : 'open'}><summary>+ Neues Spiel, Beta-Version oder Platzhalter</summary>
        <form class="form" id="newGame">
          <p class="hint">Ein Spiel ist eine einzelne HTML-Datei, in der alles steckt (wie der Arena-Prototyp). Es läuft abgeschirmt in einem eigenen Rahmen.</p>
          <label class="f"><span>Titel</span><input class="field" name="title" maxlength="40" required></label>
          <label class="f"><span>Kurzname für die Adresse (automatisch)</span><input class="field" name="id" maxlength="40" required></label>
          <label class="f"><span>Beschreibung</span><textarea class="field" name="description" maxlength="200" rows="2"></textarea></label>
          <div class="f2"><label class="f"><span>Status</span><select class="field" name="status">${STATUS_OPTS.map(([v, n]) => `<option value="${v}" ${v === 'beta' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="f"><span>Version</span><input class="field" name="version" maxlength="20" value="0.1"></label></div>
          <label class="check"><input type="checkbox" name="placeholder"> <span>Nur Platzhalter, ohne Datei (erscheint als „Bald“)</span></label>
          <label class="f" data-filebox><span>Spieldatei (.html)</span><input class="field" name="file" type="file" accept=".html,.htm,text/html"></label>
          <label class="f"><span>Titelbild (optional)</span><input class="field" name="cover" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <p class="msg"></p>
          <div class="row"><button class="btn primary" type="submit">Hochladen</button></div>
        </form></details>
      <div class="cards" id="gameCards">${list.map((g, i) => gameCard(g, i, list.length)).join('')}</div>`;

    const nf = body.querySelector('#newGame');
    nf.elements.title.addEventListener('input', () => { if (!nf.elements.id.dataset.touched) nf.elements.id.value = slug(nf.elements.title.value); });
    nf.elements.id.addEventListener('input', () => { nf.elements.id.dataset.touched = '1'; });
    nf.elements.placeholder.addEventListener('change', () => {
      const ph = nf.elements.placeholder.checked;
      nf.querySelector('[data-filebox]').hidden = ph;
      nf.elements.status.value = ph ? 'soon' : 'beta'; nf.elements.status.disabled = ph;
      nf.querySelector('[type=submit]').textContent = ph ? 'Platzhalter anlegen' : 'Hochladen';
    });
    nf.addEventListener('submit', async (e) => {
      e.preventDefault(); const msg = nf.querySelector('.msg'); msg.textContent = '';
      const id = slug(nf.elements.id.value), file = nf.elements.file.files[0], cover = nf.elements.cover.files[0], ph = nf.elements.placeholder.checked;
      const problem = (!/^[a-z0-9-]{2,40}$/.test(id) && 'Kurzname: nur a-z, 0-9 und Bindestrich, mind. 2 Zeichen.') || (list.some((g) => g.id === id) && 'Diesen Kurznamen gibt es schon.') || ['admin'].includes(id) && 'Dieser Kurzname ist reserviert.' || (!ph && checkHtml(file)) || checkImg(cover);
      if (problem) { msg.textContent = problem; return; }
      const btn = nf.querySelector('[type=submit]'); busy(btn, true);
      try {
        if (!ph) await uploadFile(`${id}/index.html`, file, true);
        let cover_path = null;
        if (cover) { cover_path = `${id}/cover.${imgExt(cover)}`; await uploadFile(cover_path, cover, false); }
        const maxSort = list.reduce((m, g) => Math.max(m, g.sort), 0);
        const { error: err } = await db().from('games').insert({
          id, title: nf.elements.title.value.trim(), description: nf.elements.description.value.trim(), status: ph ? 'soon' : nf.elements.status.value,
          kind: ph ? 'builtin' : 'upload', file_path: ph ? null : `${id}/index.html`, cover_path, version: ph ? null : (nf.elements.version.value.trim() || null), sort: maxSort + 10, updated_at: now()
        });
        if (err) throw err;
        await saved(ph ? 'Platzhalter angelegt' : 'Spiel hochgeladen'); show();
      } catch (err) { msg.textContent = 'Fehler: ' + (err.message || err); busy(btn, false); }
    });

    const cards = body.querySelector('#gameCards');
    cards.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const card = b.closest('[data-id]'), id = card.dataset.id, i = list.findIndex((g) => g.id === id), g = list[i];
      if (b.dataset.act === 'up' || b.dataset.act === 'down') {
        const j = b.dataset.act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= list.length) return;
        const o = list[j], a = g.sort === o.sort ? g.sort + (j > i ? 1 : -1) : o.sort;
        const r1 = await db().from('games').update({ sort: a, updated_at: now() }).eq('id', g.id);
        const r2 = await db().from('games').update({ sort: g.sort, updated_at: now() }).eq('id', o.id);
        if (r1.error || r2.error) return fail(r1.error || r2.error);
        await saved('Reihenfolge geändert'); show();
      }
      if (b.dataset.act === 'del') {
        const question = g.kind === 'upload'
          ? `„${g.title}“ wirklich löschen? Die hochgeladene Spieldatei wird mit gelöscht. Das kann nicht rückgängig gemacht werden.`
          : isPlaceholder(g)
            ? `Platzhalter „${g.title}“ löschen?`
            : `„${g.title}“ von der Seite löschen? Die Kachel verschwindet für alle. Der Spiel-Code bleibt im Projekt gespeichert, Claude kann das Spiel jederzeit wieder eintragen.`;
        if (!confirm(question)) return;
        try {
          const { data: files } = await db().storage.from('games').list(g.id);
          if (files && files.length) await db().storage.from('games').remove(files.map((f) => `${g.id}/${f.name}`));
          const { error: err } = await db().from('games').delete().eq('id', g.id); if (err) throw err;
          await saved('Spiel gelöscht'); show();
        } catch (err) { fail(err); }
      }
    });
    cards.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, id = f.closest('[data-id]').dataset.id, g = list.find((x) => x.id === id);
      const msg = f.querySelector('.msg'); msg.textContent = '';
      const file = f.elements.file && f.elements.file.files[0], cover = f.elements.cover && f.elements.cover.files[0];
      const problem = (file && checkHtml(file)) || checkImg(cover);
      if (problem) { msg.textContent = problem; return; }
      const btn = f.querySelector('[type=submit]'); busy(btn, true);
      try {
        const upd = { title: f.elements.title.value.trim() || g.title, description: f.elements.description.value.trim(), status: f.elements.status.value, version: f.elements.version.value.trim() || null, updated_at: now() };
        if (file) { await uploadFile(`${id}/index.html`, file, true); upd.file_path = `${id}/index.html`; }
        if (cover) { upd.cover_path = `${id}/cover.${imgExt(cover)}`; await uploadFile(upd.cover_path, cover, false); }
        else if (f.elements.dropCover && f.elements.dropCover.checked) upd.cover_path = null;
        // altes Bild mit anderer Endung (z. B. .png statt .webp) aufräumen
        const oldCover = g.cover_path && g.cover_path !== upd.cover_path && 'cover_path' in upd ? g.cover_path : null;
        const { error: err } = await db().from('games').update(upd).eq('id', id); if (err) throw err;
        if (oldCover) await db().storage.from('games').remove([oldCover]);
        await saved(file ? 'Neue Version hochgeladen' : cover ? 'Titelbild gespeichert' : 'Spiel gespeichert'); show();
      } catch (err) { msg.textContent = 'Fehler: ' + (err.message || err); busy(btn, false); }
    });
  }
  const isPlaceholder = (g) => g.kind === 'builtin' && g.status === 'soon';
  const KIND_LABEL = (g) => g.kind === 'upload' ? 'Hochgeladen' : g.kind === 'page' ? 'Eigener Ordner' : isPlaceholder(g) ? 'Platzhalter' : 'Eingebaut';
  function gameCard(g, i, n) {
    const up = g.kind === 'upload';
    return `<article class="panel card ${g.status === 'review' ? 'pending' : ''}" data-id="${esc(g.id)}">
      ${g.status === 'review' ? `<div class="pend-note"><span>Neu, wartet auf Freigabe. <a href="${siteLink(g.id)}" ${ctx.app ? 'target="_blank" rel="noopener"' : ''}>Testen</a></span><span class="pend-btns"><button class="btn" type="button" data-release="beta">Als Beta</button><button class="btn primary" type="button" data-release="live">Spielbar</button></span></div>` : ''}
      <div class="card-head"><div><b>${esc(g.title)}</b><small>${KIND_LABEL(g)} · #${esc(g.id)}${g.updated_at ? ' · geändert ' + ago(g.updated_at) : ''}</small></div>
        <div class="ord"><button class="icon" type="button" data-act="up" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon" type="button" data-act="down" aria-label="Nach unten" ${i === n - 1 ? 'disabled' : ''}>↓</button></div></div>
      <form class="form">
        <label class="f"><span>Titel</span><input class="field" name="title" maxlength="40" value="${esc(g.title)}"></label>
        <label class="f"><span>Beschreibung</span><textarea class="field" name="description" maxlength="200" rows="2">${esc(g.description)}</textarea></label>
        <div class="f2"><label class="f"><span>Status</span><select class="field" name="status">${STATUS_OPTS.map(([v, nm]) => `<option value="${v}" ${v === g.status ? 'selected' : ''}>${nm}</option>`).join('')}</select></label>
        <label class="f"><span>Version</span><input class="field" name="version" maxlength="20" value="${esc(g.version || '')}"></label></div>
        ${up ? `<label class="f"><span>Neue Version hochladen (.html, optional)</span><input class="field" name="file" type="file" accept=".html,.htm,text/html"></label>` : ''}
        <div class="cover-edit">${g.cover_path ? `<img class="cover-thumb" src="${esc(Content.fileUrl(g.cover_path, g.updated_at))}" alt="Aktuelles Titelbild">` : ''}
          <label class="f"><span>Titelbild ${g.cover_path ? 'ersetzen' : 'hinzufügen'} (optional, PNG, JPG oder WebP)</span><input class="field" name="cover" type="file" accept="image/png,image/jpeg,image/webp"></label></div>
        ${g.cover_path ? '<label class="check"><input type="checkbox" name="dropCover"> <span>Eigenes Titelbild entfernen</span></label>' : ''}
        <p class="msg"></p>
        <div class="row"><button class="btn danger" type="button" data-act="del">Löschen</button><button class="btn primary" type="submit">Speichern</button></div>
      </form></article>`;
  }

  /* ---------- Projekte ---------- */
  async function projects(body) {
    const { data: list, error } = await db().from('projects').select('*').order('sort').order('id');
    if (error) throw error;
    body.innerHTML = `<div class="row top"><button class="btn primary" type="button" id="addProj">+ Neues Projekt</button></div>
      <div class="cards">${list.map((p, i) => `<article class="panel card" data-id="${p.id}">
        <div class="card-head"><div><b>${esc(p.title)}</b><small>geändert ${ago(p.updated_at)}</small></div>
          <div class="ord"><button class="icon" type="button" data-act="up" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon" type="button" data-act="down" aria-label="Nach unten" ${i === list.length - 1 ? 'disabled' : ''}>↓</button></div></div>
        <form class="form">
          <div class="f2"><label class="f"><span>Titel</span><input class="field" name="title" maxlength="60" value="${esc(p.title)}" required></label>
          <label class="f"><span>Zuständig</span><input class="field" name="owner" maxlength="20" value="${esc(p.owner)}"></label></div>
          <label class="f"><span>Fortschritt: <b class="pv">${p.progress} %</b></span><input class="range" name="progress" type="range" min="0" max="100" step="5" value="${p.progress}"></label>
          <label class="f"><span>Status</span><input class="field" name="status" maxlength="80" value="${esc(p.status)}"></label>
          <label class="f"><span>Nächster Schritt</span><input class="field" name="next_step" maxlength="120" value="${esc(p.next_step)}"></label>
          <div class="row"><button class="btn danger" type="button" data-act="del">Löschen</button><button class="btn primary" type="submit">Speichern</button></div>
        </form></article>`).join('')}</div>`;
    body.querySelector('#addProj').onclick = async () => {
      const maxSort = list.reduce((m, p) => Math.max(m, p.sort), 0);
      const { error: err } = await db().from('projects').insert({ title: 'Neues Projekt', owner: Auth.name() || '', progress: 0, status: 'Idee', next_step: '', sort: maxSort + 10 });
      if (err) return fail(err); await saved('Projekt angelegt'); show();
    };
    body.addEventListener('input', (e) => { if (e.target.name === 'progress') e.target.closest('label').querySelector('.pv').textContent = e.target.value + ' %'; });
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = Number(b.closest('[data-id]').dataset.id), i = list.findIndex((p) => p.id === id), p = list[i];
      if (b.dataset.act === 'del') {
        if (!confirm(`Projekt „${p.title}“ löschen?`)) return;
        const { error: err } = await db().from('projects').delete().eq('id', id); if (err) return fail(err);
        await saved('Projekt gelöscht'); show(); return;
      }
      const j = b.dataset.act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= list.length) return;
      const o = list[j], a = p.sort === o.sort ? p.sort + (j > i ? 1 : -1) : o.sort;
      const r1 = await db().from('projects').update({ sort: a }).eq('id', p.id);
      const r2 = await db().from('projects').update({ sort: p.sort }).eq('id', o.id);
      if (r1.error || r2.error) return fail(r1.error || r2.error);
      await saved('Reihenfolge geändert'); show();
    });
    body.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, id = Number(f.closest('[data-id]').dataset.id), btn = f.querySelector('[type=submit]'); busy(btn, true);
      const { error: err } = await db().from('projects').update({
        title: f.elements.title.value.trim() || 'Projekt', owner: f.elements.owner.value.trim(), progress: Number(f.elements.progress.value),
        status: f.elements.status.value.trim(), next_step: f.elements.next_step.value.trim(), updated_at: now()
      }).eq('id', id);
      busy(btn, false); if (err) return fail(err); saved('Projekt gespeichert');
    });
  }

  /* ---------- Spieler ---------- */
  async function players(body) {
    const [pr, rs] = await Promise.all([
      db().from('profiles').select('id,name,role,created_at,avatar_path').order('created_at'),
      db().from('results').select('user_id').limit(5000)
    ]);
    if (pr.error) throw pr.error;
    const count = {}; (rs.data || []).forEach((r) => { count[r.user_id] = (count[r.user_id] || 0) + 1; });
    const me = Auth.user() && Auth.user().id;
    body.innerHTML = `<p class="hint">Neue Spieler registrieren sich selbst auf der Seite (oben rechts „Anmelden“). Hier kannst du ihnen Admin-Rechte geben.</p>
      <div class="cards">${pr.data.map((p) => `<article class="panel player" data-id="${p.id}">
        <span class="av">${p.avatar_path ? `<img src="${esc(Auth.avatarUrl(p.avatar_path))}" alt="" loading="lazy">` : esc((p.name || '?')[0].toUpperCase())}</span>
        <div class="pinfo"><b>${esc(p.name)}${p.id === me ? ' <small>(du)</small>' : ''}</b><small>dabei seit ${new Date(p.created_at).toLocaleDateString('de-DE')} · ${count[p.id] || 0} Matches</small></div>
        <span class="pill ${p.role === 'admin' ? 'ok' : ''}">${p.role === 'admin' ? 'Admin' : 'Spieler'}</span>
        <button class="btn" type="button" data-role="${p.role === 'admin' ? 'player' : 'admin'}">${p.role === 'admin' ? 'Admin entfernen' : 'Zum Admin machen'}</button>
      </article>`).join('')}</div>`;
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-role]'); if (!b) return;
      const id = b.closest('[data-id]').dataset.id, role = b.dataset.role;
      if (role === 'player' && id === me && !confirm('Dir selbst die Admin-Rechte entziehen? Dann kommst du nicht mehr ins Admin-Panel.')) return;
      const { error } = await db().rpc('set_role', { target: id, new_role: role });
      if (error) return fail(error);
      ctx.toast(role === 'admin' ? 'Ist jetzt Admin' : 'Admin-Rechte entfernt');
      if (id === me) location.reload(); else show();
    });
  }

  /* ---------- Einstellungen ---------- */
  async function settings(body) {
    const c = Content.get(), a = c.announcement || {}, m = c.maintenance || {};
    body.innerHTML = `
      <form class="panel form" id="annForm"><h3>Ankündigung</h3>
        <p class="hint">Ein Banner ganz oben auf der Seite, z. B. „Neues Spiel: Reaktionsduell ist da!“</p>
        <label class="switch"><input type="checkbox" name="on" ${a.on ? 'checked' : ''}><span>Banner anzeigen</span></label>
        <label class="f"><span>Text</span><input class="field" name="text" maxlength="160" value="${esc(a.text)}"></label>
        <div class="row"><button class="btn primary" type="submit">Speichern</button></div></form>
      <form class="panel form" id="mntForm"><h3>Wartungsmodus</h3>
        <p class="hint">Alle außer Admins sehen statt der Spiele nur diesen Hinweis. Praktisch, wenn ihr gerade umbaut.</p>
        <label class="switch"><input type="checkbox" name="on" ${m.on ? 'checked' : ''}><span>Wartungsmodus an</span></label>
        <label class="f"><span>Text</span><input class="field" name="text" maxlength="160" value="${esc(m.text)}"></label>
        <div class="row"><button class="btn primary" type="submit">Speichern</button></div></form>
      <div class="panel form"><h3>Datenbank</h3>
        <p class="hint">Alles, was hier im Admin-Bereich gespeichert wird, liegt bei Supabase. Backups machst du im Reiter „Backup“.</p>
        <div class="row"><a class="btn" href="https://supabase.com/dashboard/project/gekavukdzlhnhgpjyyyd" target="_blank" rel="noopener">Supabase öffnen</a></div></div>`;
    const bind = (id, key, label) => body.querySelector(id).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, btn = f.querySelector('[type=submit]'); busy(btn, true);
      const value = { on: f.elements.on.checked, text: f.elements.text.value.trim() };
      const { error } = await db().from('site_settings').upsert({ key, value, updated_at: now() });
      busy(btn, false); if (error) return fail(error); saved(label);
    });
    bind('#annForm', 'announcement', 'Ankündigung gespeichert');
    bind('#mntForm', 'maintenance', 'Wartungsmodus gespeichert');
  }

  /* ---------- Backup ---------- */
  // Am PC (Edge, Chrome) darf die Seite direkt in einen Ordner schreiben. Liegt der Ordner in
  // Google Drive für den Computer (z. B. F:\Meine Ablage\…), lädt Google Drive die Datei von selbst hoch.
  const canPickFolder = typeof window.showDirectoryPicker === 'function';

  // Den gewählten Ordner merken (nur auf diesem Gerät, im Browser-Speicher)
  function kv(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('jv-admin', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction('kv', mode), req = fn(tx.objectStore('kv'));
          tx.oncomplete = () => { open.result.close(); resolve(req && req.result); };
          tx.onerror = () => reject(tx.error);
        } catch (e) { open.result.close(); reject(e); }
      };
    });
  }
  const savedFolder = () => kv('readonly', (st) => st.get('backupDir')).catch(() => null);
  const rememberFolder = (h) => kv('readwrite', (st) => st.put(h, 'backupDir')).catch(() => { });

  async function backupFolder(pickNew) {
    let dir = pickNew ? null : await savedFolder();
    if (dir) {
      let perm = await dir.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') perm = await dir.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') return dir;
    }
    dir = await window.showDirectoryPicker({ id: 'jv-backup', mode: 'readwrite' });
    dir.isNew = true;                                      // wird nach dem Speichern gemerkt
    return dir;
  }

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = () => reject(r.error); r.readAsDataURL(blob);
  });

  // Alles einsammeln: Tabellen und die hochgeladenen Dateien (Spiele, Titelbilder)
  async function buildBackup(step) {
    const out = {
      app: 'JointVenture', format: 1, erstellt: now(), von: Auth.name() || '',
      hinweis: 'Backup der Seite https://pfirsich13.github.io/JointVenture/ . Zum Wiederherstellen diese Datei an Claude geben. Der Code der Seite liegt auf GitHub (Pfirsich13/JointVenture).',
      tabellen: {}, dateien: {}
    };
    for (const t of ['site_settings', 'games', 'projects', 'profiles', 'results', 'reports']) {
      step(`Lese ${t} …`);
      const rows = [];
      for (let from = 0; ; from += 1000) {                  // in Blöcken, damit nichts abgeschnitten wird
        const { data, error } = await db().from(t).select('*').range(from, from + 999);
        if (error) throw error;
        rows.push(...data); if (data.length < 1000) break;
      }
      out.tabellen[t] = rows;
    }
    const bucket = db().storage.from('games');
    const { data: top, error } = await bucket.list('', { limit: 1000 });
    if (error) throw error;
    const paths = [];
    for (const item of top || []) {
      if (item.id) { paths.push(item.name); continue; }   // Datei direkt im Speicher
      const { data: files, error: e2 } = await bucket.list(item.name, { limit: 1000 });
      if (e2) throw e2;
      (files || []).filter((f) => f.id).forEach((f) => paths.push(`${item.name}/${f.name}`));
    }
    for (const path of paths) {
      step(`Lade ${path} …`);
      const { data: blob, error: e3 } = await bucket.download(path);
      if (e3) throw e3;
      out.dateien[path] = { typ: blob.type, base64: await toBase64(blob) };
    }
    return out;
  }
  function backupName() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `JointVenture-Backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`;
  }
  const mb = (n) => n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  // Backup erstellen: in den gemerkten Ordner (toDrive) oder als Download. Muss direkt nach einem Klick/Enter starten.
  async function doBackup(toDrive, step) {
    const folder = toDrive && canPickFolder ? await backupFolder(false) : null;   // zuerst: braucht den frischen Klick
    const data = await buildBackup(step || (() => { }));
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), name = backupName();
    if (folder) {
      if (step) step('Speichere …');
      const fh = await folder.getFileHandle(name, { create: true });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
      if (folder.isNew) await rememberFolder(folder);
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    const info = { at: now(), by: Auth.name() || '', bytes: blob.size, ziel: folder ? `Ordner „${folder.name}“` : 'Download', datei: name };
    await db().from('site_settings').upsert({ key: 'backup', value: info, updated_at: now() });
    await ctx.refresh();
    return info;
  }

  async function backup(body) {
    const { data: row } = await db().from('site_settings').select('value').eq('key', 'backup').maybeSingle();
    const last = row && row.value;
    const dir = canPickFolder ? await savedFolder() : null;
    body.innerHTML = `
      <div class="panel form"><h3>Backup</h3>
        <p class="hint">Sichert alle Texte, Spiele (auch hochgeladene Spieldateien und Titelbilder), Projekte, Spieler, Ergebnisse und Fehlermeldungen in einer Datei. Der Code der Seite liegt zusätzlich auf GitHub.</p>
        <p class="bk-last">${last && last.at ? `Letztes Backup <b>${ago(last.at)}</b>${last.by ? ' von ' + esc(last.by) : ''} · ${mb(last.bytes || 0)}${last.ziel ? ' · ' + esc(last.ziel) : ''}` : 'Noch kein Backup gemacht.'}</p>
        ${canPickFolder ? `
          <p class="hint">Ordner auf diesem Gerät: <b id="bkDir">${dir ? esc(dir.name) : 'noch keiner gewählt'}</b></p>
          <div class="row">${dir ? '<button class="btn" type="button" id="bkPick">Ordner ändern</button>' : ''}<button class="btn" type="button" id="bkDownload">Als Datei herunterladen</button><button class="btn primary" type="button" id="bkDrive">Backup in Google Drive speichern</button></div>
          <details class="bk-help" ${dir ? '' : 'open'}><summary>So landet das Backup in Google Drive</summary>
            <ol><li>Auf „Backup in Google Drive speichern“ klicken. Beim ersten Mal öffnet sich ein Fenster zur Ordnerwahl.</li>
            <li>Links <b>Google Drive</b> bzw. <b>Meine Ablage</b> (bei dir Laufwerk F:) öffnen, dann „Projekt Handy Game“.</li>
            <li>Dort mit „Neuer Ordner“ einen Ordner <b>JointVenture-Backups</b> anlegen, ihn anklicken und „Ordner auswählen“.</li>
            <li>Die Frage des Browsers mit „Dateien bearbeiten“ bzw. „Zulassen“ bestätigen.</li></ol>
            <p>Danach reicht ein Klick. Google Drive lädt jede Datei von selbst hoch. Nach einem Neustart des Browsers fragt er einmal kurz nach, ob er wieder in den Ordner schreiben darf.</p></details>`
        : `<p class="hint">Auf diesem Gerät kann die Seite nicht direkt in einen Ordner schreiben (geht am PC mit Edge oder Chrome). Lade das Backup herunter und lege es in Google Drive ab, am iPhone über Teilen → „In Dateien sichern“ → Google Drive.</p>
          <div class="row"><button class="btn primary" type="button" id="bkDownload">Backup herunterladen</button></div>`}
        <p class="msg" id="bkMsg" aria-live="polite"></p>
      </div>`;
    const msg = body.querySelector('#bkMsg'), btns = [...body.querySelectorAll('button')];
    const lock = (on) => btns.forEach((b) => { b.disabled = on; });
    async function run(toDrive) {
      msg.className = 'msg'; msg.textContent = ''; lock(true);
      try {
        const info = await doBackup(toDrive, (t) => { msg.textContent = t; });
        ctx.toast(info.ziel === 'Download' ? 'Backup heruntergeladen' : 'Backup gespeichert');
        show();
      } catch (err) {
        lock(false);
        if (err && err.name === 'AbortError') { msg.textContent = 'Kein Ordner gewählt, nichts gespeichert.'; return; }
        console.error(err); msg.textContent = 'Das Backup hat nicht geklappt: ' + ((err && err.message) || err);
      }
    }
    if (canPickFolder) {
      body.querySelector('#bkDrive').onclick = () => run(true);
      const pick = body.querySelector('#bkPick');
      if (pick) pick.onclick = async () => {
        try { await rememberFolder(await backupFolder(true)); ctx.toast('Ordner gewählt'); show(); }
        catch (err) { if (!err || err.name !== 'AbortError') { console.error(err); msg.textContent = 'Ordner konnte nicht gewählt werden: ' + ((err && err.message) || err); } }
      };
    }
    body.querySelector('#bkDownload').onclick = () => run(false);
  }

  // Werkzeuge für die Konsole (console.js) und das Admin-Programm (konsole/)
  const api = {
    db, now, ago, esc, toast: (m) => ctx.toast(m), refresh: () => ctx.refresh(), goTab, updateBadge,
    loadReports, reportMarkdown, copyForClaude, copyText, setReport, rLabel,
    doBackup, canPickFolder, release: async (id, status) => { const { error } = await db().from('games').update({ status, updated_at: now() }).eq('id', id); if (error) throw error; await ctx.refresh(); }
  };
  window.Admin = { render, api };
})();
