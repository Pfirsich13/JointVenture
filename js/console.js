/* =========================================================================
   console.js – Konsole im Admin-Bereich und im Admin-Programm
   -------------------------------------------------------------------------
   Befehle eintippen statt klicken, z. B. "meldungen", "claude offen",
   "spiel arena beta". "hilfe" zeigt alle Befehle.
   Benutzt die Werkzeuge aus admin.js (Admin.api).
   ========================================================================= */
(function () {
  const HIST_KEY = 'jv_console_hist';
  const GAME_STATUS = { spielbar: 'live', live: 'live', beta: 'beta', bald: 'soon', soon: 'soon', versteckt: 'hidden', hidden: 'hidden', freigabe: 'review', review: 'review' };
  const GAME_LABEL = { live: 'Spielbar', beta: 'Beta', soon: 'Bald', hidden: 'Versteckt', review: 'Zur Freigabe' };
  const pad = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n); };

  function mount(el, api) {
    el.innerHTML = `<div class="panel console">
      <div class="con-out" role="log" aria-live="polite"></div>
      <form class="con-in" autocomplete="off"><span class="con-prompt" aria-hidden="true">›</span>
        <input name="cmd" spellcheck="false" autocapitalize="off" placeholder="Befehl eingeben, z. B. hilfe" aria-label="Befehl"></form></div>
      <p class="hint">Tipp: Mit den Pfeiltasten ↑ ↓ holst du frühere Befehle zurück.</p>`;
    const out = el.querySelector('.con-out'), form = el.querySelector('form'), input = form.elements.cmd;
    let hist = []; try { hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { }
    let hpos = hist.length;

    function print(text, cls) {
      const line = document.createElement('div'); line.className = 'con-line' + (cls ? ' ' + cls : '');
      line.textContent = text; out.appendChild(line); out.scrollTop = out.scrollHeight;
    }
    const ok = (t) => print(t, 'ok'), err = (t) => print(t, 'err'), dim = (t) => print(t, 'dim');

    // ------------------------------------------------------------ Befehle
    const nr = (a) => { const n = Number(String(a || '').replace('#', '')); if (!Number.isInteger(n) || n < 1) throw new Error('Bitte die Nummer der Meldung angeben, z. B. „meldung 3“.'); return n; };
    async function findPlayer(name) {
      const { data, error } = await api.db().from('profiles').select('id,name,role').ilike('name', name);
      if (error) throw error;
      if (!data.length) throw new Error(`Keinen Spieler „${name}“ gefunden. „spieler“ zeigt alle.`);
      if (data.length > 1) throw new Error(`Mehrere Spieler heißen „${name}“. Bitte im Reiter „Spieler“ ändern.`);
      return data[0];
    }
    async function setSetting(key, value) {
      const { error } = await api.db().from('site_settings').upsert({ key, value, updated_at: api.now() });
      if (error) throw error; await api.refresh();
    }
    async function reportStatus(args, status, verb) {
      const id = nr(args[0]), note = args.slice(1).join(' ').trim();
      await api.setReport(id, note ? { status, admin_note: note } : { status });
      ok(`Meldung #${id} ist jetzt „${api.rLabel(status)[1]}“${note ? ' (mit Antwort)' : ''}.`); api.updateBadge();
      if (verb) dim(verb);
    }

    const CMDS = {
      hilfe: ['', 'zeigt diese Liste', async () => {
        print('Befehle:');
        Object.entries(CMDS).forEach(([n, [a, t]]) => { const u = n + (a ? ' ' + a : ''); print('  ' + (u.length >= 40 ? u + '  ' : u.padEnd(40)) + t, 'dim'); });
      }],
      meldungen: ['[offen|neu|erledigt|alle]', 'Fehlermeldungen auflisten', async (args) => {
        const list = await api.loadReports(args[0] || 'offen');
        if (!list.length) return ok('Keine Meldungen in dieser Ansicht.');
        print(pad('Nr', 6) + pad('Status', 13) + pad('Spiel', 14) + pad('Titel', 38) + 'Von, wann', 'head');
        list.forEach((r) => print(pad('#' + r.id, 6) + pad(api.rLabel(r.status)[1], 13) + pad(r.game || 'Allgemein', 14) + pad(r.title, 38) + `${r.reporter || '?'}, ${api.ago(r.created_at)}`));
        dim(`${list.length} Meldung${list.length > 1 ? 'en' : ''}. Details: „meldung <nr>“, für Claude: „claude <nr>“ oder „claude offen“.`);
      }],
      meldung: ['<nr>', 'eine Meldung komplett anzeigen', async (args) => {
        const [r] = await api.loadReports(null, nr(args[0]));
        if (!r) return err('Diese Meldung gibt es nicht.');
        (await api.reportMarkdown(r, false)).split('\n').forEach((l) => print(l));
      }],
      claude: ['[nr|offen]', 'Meldung(en) für Claude kopieren', async (args) => {
        const list = !args[0] || args[0] === 'offen' ? await api.loadReports('offen') : await api.loadReports(null, nr(args[0]));
        if (!list.length) return ok('Nichts zu kopieren, keine passenden Meldungen.');
        if (await api.copyForClaude(list)) ok(`${list.length} Meldung${list.length > 1 ? 'en' : ''} kopiert. Jetzt im Chat bei Claude einfügen (Strg+V).`);
        else err('Kopieren ging nicht. Erlaube der Seite den Zugriff auf die Zwischenablage.');
      }],
      inarbeit: ['<nr>', 'Meldung auf „In Arbeit“ setzen', (a) => reportStatus(a, 'in_arbeit')],
      erledigt: ['<nr> [antwort]', 'Meldung erledigt, optional mit Antwort an den Spieler', (a) => reportStatus(a, 'erledigt')],
      ablehnen: ['<nr> [antwort]', 'Meldung ist kein Fehler', (a) => reportStatus(a, 'abgelehnt')],
      antwort: ['<nr> <text>', 'Antwort an den Spieler speichern', async (args) => {
        const id = nr(args[0]), note = args.slice(1).join(' ').trim();
        if (!note) return err('Bitte einen Text angeben, z. B. „antwort 3 Danke, ist behoben!“.');
        await api.setReport(id, { admin_note: note }); ok(`Antwort bei #${id} gespeichert.`);
      }],
      spiele: ['', 'alle Spiele mit Status', async () => {
        const { data, error } = await api.db().from('games').select('id,title,status,version,kind').order('sort');
        if (error) throw error;
        print(pad('Kurzname', 14) + pad('Titel', 24) + pad('Status', 14) + 'Version', 'head');
        data.forEach((g) => print(pad(g.id, 14) + pad(g.title, 24) + pad(GAME_LABEL[g.status] || g.status, 14) + (g.version || '')));
      }],
      spiel: ['<kurzname> <spielbar|beta|bald|versteckt|freigabe>', 'Status eines Spiels ändern', async (args) => {
        const id = (args[0] || '').toLowerCase(), st = GAME_STATUS[(args[1] || '').toLowerCase()];
        if (!id || !st) return err('So geht es: „spiel arena beta“. Status: spielbar, beta, bald, versteckt, freigabe.');
        const { data, error } = await api.db().from('games').select('id,title').eq('id', id).maybeSingle();
        if (error) throw error; if (!data) return err(`Kein Spiel mit dem Kurznamen „${id}“. „spiele“ zeigt alle.`);
        await api.release(id, st); ok(`${data.title}: jetzt „${GAME_LABEL[st]}“.`);
      }],
      ankuendigung: ['<text> | aus', 'Banner oben auf der Seite', async (args) => {
        const text = args.join(' ').trim();
        if (!text) return err('So geht es: „ankuendigung Neues Spiel ist da!“ oder „ankuendigung aus“.');
        if (text === 'aus') { await setSetting('announcement', { on: false, text: '' }); return ok('Ankündigung ausgeschaltet.'); }
        await setSetting('announcement', { on: true, text: text.slice(0, 160) }); ok('Ankündigung ist online.');
      }],
      wartung: ['an [text] | aus', 'Wartungsmodus an- oder ausschalten', async (args) => {
        const mode = (args[0] || '').toLowerCase(), text = args.slice(1).join(' ').trim();
        if (mode !== 'an' && mode !== 'aus') return err('So geht es: „wartung an Wir bauen kurz um“ oder „wartung aus“.');
        await setSetting('maintenance', { on: mode === 'an', text: (text || 'Wir bauen gerade um. Gleich geht es weiter.').slice(0, 160) });
        ok(mode === 'an' ? 'Wartungsmodus ist an. Nur Admins sehen die Spiele.' : 'Wartungsmodus ist aus.');
      }],
      spieler: ['', 'alle Spieler mit Rolle', async () => {
        const { data, error } = await api.db().from('profiles').select('name,role,created_at').order('created_at');
        if (error) throw error;
        print(pad('Name', 20) + pad('Rolle', 10) + 'Dabei seit', 'head');
        data.forEach((p) => print(pad(p.name, 20) + pad(p.role === 'admin' ? 'Admin' : 'Spieler', 10) + new Date(p.created_at).toLocaleDateString('de-DE')));
      }],
      rolle: ['<name> <admin|spieler>', 'Admin-Rechte geben oder nehmen', async (args) => {
        const role = (args[args.length - 1] || '').toLowerCase(), name = args.slice(0, -1).join(' ').trim();
        if (!name || (role !== 'admin' && role !== 'spieler')) return err('So geht es: „rolle Tim admin“ oder „rolle Tim spieler“.');
        const p = await findPlayer(name);
        const { error } = await api.db().rpc('set_role', { target: p.id, new_role: role === 'admin' ? 'admin' : 'player' });
        if (error) throw error; ok(`${p.name} ist jetzt ${role === 'admin' ? 'Admin' : 'Spieler'}.`);
      }],
      projekte: ['', 'Projekte mit Fortschritt', async () => {
        const { data, error } = await api.db().from('projects').select('id,title,owner,progress,status').order('sort');
        if (error) throw error;
        print(pad('Nr', 5) + pad('Projekt', 26) + pad('Wer', 10) + pad('Stand', 8) + 'Status', 'head');
        data.forEach((p) => print(pad(p.id, 5) + pad(p.title, 26) + pad(p.owner, 10) + pad(p.progress + ' %', 8) + (p.status || '')));
      }],
      projekt: ['<nr> <prozent> [status]', 'Fortschritt eines Projekts setzen', async (args) => {
        const id = Number(args[0]), pr = Number(String(args[1] || '').replace('%', '')), st = args.slice(2).join(' ').trim();
        if (!Number.isInteger(id) || !(pr >= 0 && pr <= 100)) return err('So geht es: „projekt 2 60 Bot fertig“. „projekte“ zeigt die Nummern.');
        const upd = { progress: Math.round(pr), updated_at: api.now() }; if (st) upd.status = st.slice(0, 80);
        const { data, error } = await api.db().from('projects').update(upd).eq('id', id).select('title');
        if (error) throw error; if (!data.length) return err(`Kein Projekt mit Nummer ${id}.`);
        await api.refresh(); ok(`${data[0].title}: ${upd.progress} %${st ? ', ' + st : ''}.`);
      }],
      'passwort-anfragen': ['', 'offene Anfragen „Passwort vergessen“', async () => {
        const list = await api.loadPwRequests();
        if (!list.length) return ok('Keine offenen Passwort-Anfragen.');
        print(pad('Nr', 5) + pad('Name', 16) + pad('E-Mail', 32) + 'Wann', 'head');
        list.forEach((r) => print(pad(r.id, 5) + pad(r.name || '–', 16) + pad(r.email, 32) + api.ago(r.created_at)));
        dim('Einmal-Passwort erstellen: „einmalpasswort <email>“.');
      }],
      einmalpasswort: ['<email>', 'Einmal-Passwort setzen und kopieren', async (args) => {
        const email = (args[0] || '').trim();
        if (!/^[^\s@]+@[^\s@]+$/.test(email)) return err('So geht es: „einmalpasswort name@beispiel.de“.');
        const r = await api.resetPassword(email);
        ok(`Einmal-Passwort für ${r.name || r.email}: ${r.password}`);
        if (await api.copyText(r.password)) dim('Ist in der Zwischenablage. Persönlich oder per WhatsApp weitergeben; nach dem Anmelden muss ein neues Passwort gesetzt werden.');
      }],
      statistik: ['', 'Zahlen auf einen Blick', async () => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const q = (t, f) => { let x = api.db().from(t).select('*', { count: 'exact', head: true }); return f ? f(x) : x; };
        const [p, m, mt, r] = await Promise.all([q('profiles'), q('results'), q('results', (x) => x.gte('created_at', today.toISOString())), q('reports', (x) => x.in('status', ['neu', 'in_arbeit']))]);
        print(`Spieler: ${p.count ?? '?'} · Matches: ${m.count ?? '?'} (heute ${mt.count ?? '?'}) · offene Meldungen: ${r.count ?? '?'}`);
      }],
      backup: ['[download]', 'Backup in den Google-Drive-Ordner (oder als Download)', async (args) => {
        const toDrive = args[0] !== 'download' && api.canPickFolder;
        const info = await api.doBackup(toDrive, dim);
        ok(`Backup fertig: ${info.datei} → ${info.ziel}.`);
      }],
      gehe: ['<reiter>', 'Reiter öffnen: meldungen, spiele, spieler, backup …', async (args) => {
        const map = { uebersicht: 'overview', übersicht: 'overview', meldungen: 'reports', texte: 'texts', spiele: 'games', projekte: 'projects', spieler: 'players', einstellungen: 'settings', backup: 'backup' };
        const t = map[(args[0] || '').toLowerCase()]; if (!t) return err('Reiter: übersicht, meldungen, texte, spiele, projekte, spieler, einstellungen, backup.');
        api.goTab(t);
      }],
      leeren: ['', 'Konsole leeren', async () => { out.innerHTML = ''; }]
    };
    const ALIAS = { help: 'hilfe', '?': 'hilfe', clear: 'leeren', cls: 'leeren', reports: 'meldungen', report: 'meldung', games: 'spiele', players: 'spieler', stats: 'statistik', 'ankündigung': 'ankuendigung', projects: 'projekte' };

    async function run(line) {
      const parts = line.trim().split(/\s+/); if (!parts[0]) return;
      const name = ALIAS[parts[0].toLowerCase()] || parts[0].toLowerCase(), cmd = CMDS[name];
      print('› ' + line, 'cmd');
      if (!cmd) return err(`Unbekannter Befehl „${parts[0]}“. „hilfe“ zeigt alle Befehle.`);
      try { await cmd[2](parts.slice(1)); }
      catch (e) { if (e && e.name === 'AbortError') err('Abgebrochen.'); else err((e && e.message) || String(e)); }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault(); const line = input.value; input.value = '';
      if (line.trim()) { hist = hist.filter((h) => h !== line).concat(line).slice(-50); try { localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch (x) { } }
      hpos = hist.length; run(line);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && hpos > 0) { hpos--; input.value = hist[hpos]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hpos = Math.min(hist.length, hpos + 1); input.value = hist[hpos] || ''; e.preventDefault(); }
    });
    el.querySelector('.console').addEventListener('click', (e) => { if (!e.target.closest('input') && !getSelection().toString()) input.focus(); });

    print('JointVenture Konsole. Tippe „hilfe“ für alle Befehle.', 'ok');
    run('statistik').then(() => input.focus());
  }

  window.AdminConsole = { mount };
})();
