/* =========================================================================
   content.js – Inhalte der Seite (Texte, Spiele, Projekte, Banner, Wartung)
   -------------------------------------------------------------------------
   Kommen aus Supabase und lassen sich im Admin-Panel bearbeiten.
   Ohne Verbindung werden die zuletzt geladenen bzw. diese Standardwerte
   benutzt, damit die Seite immer funktioniert.
   ========================================================================= */
(function () {
  const DEFAULTS = {
    site: {
      name: (window.SITE && window.SITE.name) || 'JointVenture',
      kicker: 'Nur für uns zwei',
      tagline: 'Zockt gegeneinander. Live.',
      lead: 'Spiel wählen, Code teilen, loslegen. Jedes Duell wird gezählt, und wer verliert, fordert Revanche.',
      gamesHint: 'Tippen und loslegen.',
      standHint: '',
      projectsHint: 'Woran wir gerade bauen.',
      footer: 'Online-Spiele verbinden eure Handys direkt miteinander.'
    },
    announcement: { on: false, text: '' },
    maintenance: { on: false, text: 'Wir bauen gerade um. Gleich geht es weiter!' },
    games: [
      { id: 'airhockey', title: 'Air-Hockey', description: 'Schnell, laut, gemein. Wer zuerst 7 Tore hat, gewinnt.', status: 'live', kind: 'builtin', version: '1.2', sort: 10 },
      { id: 'reaction', title: 'Reaktionsduell', description: 'Warte aufs Signal und tippe schneller als der andere.', status: 'soon', kind: 'builtin', sort: 20 },
      { id: 'bomber', title: 'Mini-Bomber', description: 'Bomben legen, Wände sprengen, den anderen erwischen.', status: 'soon', kind: 'builtin', sort: 30 },
      { id: 'arena', title: 'Arena-PvP', description: '3D-Magier-Duell: Feuer gegen Eis. Raum erstellen, Code teilen oder gegen den Bot üben.', status: 'review', kind: 'page', file_path: 'play/arena/index.html', version: 'Magier 3', sort: 40 },
      { id: 'gladiator', title: 'Gladiator 3D', description: 'Schwert gegen Speer in der vollen Arena: Kombos, blocken, treten, Waffe aus der Hand schlagen und werfen. Echte 3D-Figuren in Tunika.', status: 'review', kind: 'page', file_path: 'play/gladiator/index.html', version: '0.5', sort: 45 },
      { id: 'elementar', title: 'Elementar-Arena', description: 'Wähle Feuer, Wasser, Erde oder Luft: je 4 Attacken, Doppelsprung, Slide und Dash in der Schnee-Arena. Gegen den Bot.', status: 'review', kind: 'page', file_path: 'play/elementar/index.html', version: '0.2', sort: 47 },
      { id: 'zombie', title: 'Zombie-Shooter', description: 'Welle um Welle gegen Horden, allein oder zusammen.', status: 'soon', kind: 'builtin', sort: 50 }
    ],
    projects: [
      { title: 'Anmeldung & Spielstände', owner: 'Ron', progress: 100, status: 'Fertig: Anmeldung und Speichern laufen', next_step: 'Rangliste für alle Spieler', sort: 10 },
      { title: 'Arena-PvP', owner: 'Bruder', progress: 25, status: 'Prototyp mit Würfeln läuft', next_step: 'Thema wählen: Gladiatoren, Mechs oder Magier', sort: 20 }
    ]
  };
  const CACHE = 'jv_content_v1';
  let data = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c && c.site && Array.isArray(c.games)) data = Object.assign(data, c);
  } catch (e) { }
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });

  async function load() {
    const client = window.Auth && Auth.client();
    if (!client) return false;
    try {
      const [s, g, p] = await Promise.all([
        client.from('site_settings').select('key,value'),
        client.from('games').select('*').order('sort').order('title'),
        client.from('projects').select('*').order('sort').order('id')
      ]);
      if (s.error || g.error || p.error) throw (s.error || g.error || p.error);
      const next = { site: Object.assign({}, DEFAULTS.site), announcement: DEFAULTS.announcement, maintenance: DEFAULTS.maintenance, games: g.data, projects: p.data };
      for (const row of s.data) {
        if (row.key === 'site') next.site = Object.assign({}, DEFAULTS.site, row.value);
        else next[row.key] = row.value;
      }
      data = next;
      try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (e) { }
      emit();
      return true;
    } catch (e) { console.warn('Inhalte nicht geladen:', e.message || e); return false; }
  }

  // Öffentliche Adresse einer Datei im Speicher "games"
  function fileUrl(path, stamp) {
    const client = window.Auth && Auth.client();
    if (!client || !path) return '';
    const url = client.storage.from('games').getPublicUrl(path).data.publicUrl;
    return stamp ? url + '?v=' + encodeURIComponent(stamp) : url;
  }

  window.Content = {
    get: () => data,
    defaults: DEFAULTS,
    load,
    fileUrl,
    onChange(fn) { listeners.push(fn); }
  };
})();
