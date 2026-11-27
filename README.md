# JointVenture

Unsere private PvP-Spieleseite (JointVenture): Startseite mit Spielekacheln, Echtzeit-Duelle von Handy zu Handy.

- **Spielen:** https://pfirsich13.github.io/JointVenture/
- **Aufs iPhone als App:** Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“

## Aufbau
| Datei | Inhalt |
|---|---|
| `index.html` | Startseite |
| `css/style.css` | Design |
| `js/config.js` | Name der Seite und Supabase-Zugang |
| `js/auth.js` | Anmeldung und gespeicherte Spielstände (Supabase) |
| `js/net.js` | Echtzeit-Verbindung (Peer-to-Peer über PeerJS, oder Claude-Raum) |
| `js/hub.js` | Kacheln, Filter, Duell-Bilanz – neue Spiele hier eintragen |
| `js/games/airhockey.js` | Air-Hockey (Werte ganz oben im Code) |
| `MASTERPROMPT.md` | Bauplan und Regeln fürs Projekt |
