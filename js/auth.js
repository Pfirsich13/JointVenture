/* =========================================================================
   auth.js – Anmeldung und gespeicherte Spielstände (Supabase)
   -------------------------------------------------------------------------
   Solange in config.js keine Supabase-Daten stehen, ist die Anmeldung
   ausgeschaltet und alles wird nur auf dem Gerät gespeichert.

   Auth.ready            -> true, wenn Supabase eingerichtet ist
   Auth.user()           -> angemeldeter Nutzer oder null
   Auth.name()           -> Anzeigename des Nutzers
   Auth.onChange(fn)     -> wird bei An-/Abmeldung aufgerufen
   Auth.signUp(name, mail, pw) / Auth.signIn(mail, pw) / Auth.signOut()
   Auth.saveResult({game, mode, won, score, opponent})
   Auth.loadResults()    -> Liste der eigenen Ergebnisse (neueste zuerst)
   ========================================================================= */
(function () {
  const S = window.SITE || {};
  const configured = !!(S.supabaseUrl && S.supabaseKey);
  let client = null, user = null, profileName = '', failed = false;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('Supabase konnte nicht geladen werden.'));
      document.head.appendChild(s);
    });
  }

  async function loadProfile() {
    profileName = '';
    if (!user) return;
    profileName = (user.user_metadata && user.user_metadata.name) || '';
    try {
      const { data } = await client.from('profiles').select('name').eq('id', user.id).maybeSingle();
      if (data && data.name) profileName = data.name;
    } catch (e) { /* Tabelle fehlt noch: Name aus den Metadaten */ }
  }

  async function init() {
    if (!configured) { emit(); return; }
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js');
      client = window.supabase.createClient(S.supabaseUrl, S.supabaseKey);
      const { data } = await client.auth.getSession();
      user = data.session ? data.session.user : null;
      await loadProfile(); emit();
      client.auth.onAuthStateChange(async (_e, session) => {
        user = session ? session.user : null;
        await loadProfile(); emit();
      });
    } catch (e) { console.warn('Anmeldung nicht erreichbar:', e.message); failed = true; emit(); }
  }

  const deErr = (e) => {
    const m = String((e && e.message) || e || '');
    if (/Invalid login/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/already registered|already exists/i.test(m)) return 'Diese E-Mail ist schon registriert. Melde dich an.';
    if (/Password should be/i.test(m)) return 'Das Passwort muss mindestens 6 Zeichen haben.';
    if (/Email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail (Link im Postfach).';
    if (/valid email|invalid.*email/i.test(m)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
    if (/signups? (are|is) disabled|signup.*not allowed/i.test(m)) return 'Registrieren ist bei Supabase gerade ausgeschaltet (Authentication → Sign In / Providers).';
    if (/rate limit|too many/i.test(m)) return 'Zu viele Versuche. Bitte kurz warten und nochmal probieren.';
    if (/fetch|network/i.test(m)) return 'Keine Verbindung. Internet prüfen und nochmal versuchen.';
    return m || 'Das hat nicht geklappt.';
  };

  const need = () => { if (!client) throw new Error('Die Anmeldung ist gerade nicht erreichbar. Bitte später nochmal versuchen.'); };
  window.Auth = {
    get ready() { return configured && !failed; },
    init,
    user: () => user,
    name: () => profileName,
    onChange(fn) { listeners.push(fn); },
    async signUp(name, email, password) {
      need();
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw new Error(deErr(error));
      if (data.user && data.session) {
        try { await client.from('profiles').upsert({ id: data.user.id, name }); } catch (e) { }
      }
      return { needsConfirm: !data.session };
    },
    async signIn(email, password) {
      need();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(deErr(error));
    },
    async signOut() { if (client) await client.auth.signOut(); },
    async saveResult(r) {
      if (!client || !user) return false;
      const { error } = await client.from('results').insert({
        user_id: user.id, game: r.game, mode: r.mode, won: !!r.won,
        score: String(r.score || '').slice(0, 9), opponent: String(r.opponent || '').slice(0, 20)
      });
      if (error) { console.error(error); return false; }
      return true;
    },
    async loadResults() {
      if (!client || !user) return [];
      const { data, error } = await client.from('results').select('game,mode,won,score,opponent,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) { console.error(error); return []; }
      return data || [];
    }
  };
})();
