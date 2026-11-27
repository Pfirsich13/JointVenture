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
| `js/social.js` | Freunde, Chat (privat und Lobby) und Online-Status (Punkt am Profilbild) |
| `js/content.js` | Texte, Spiele, Projekte aus der Datenbank (mit Standardwerten) |
| `js/admin.js` | Admin-Panel (Adresse `#admin`, nur für Admins) |
| `js/net.js` | Echtzeit-Verbindung (Peer-to-Peer über PeerJS, oder Claude-Raum) |
| `js/hub.js` | Kacheln, Filter, Duell-Bilanz – neue Spiele hier eintragen |
| `js/games/airhockey.js` | Air-Hockey (Werte ganz oben im Code) |
| `js/errors.js` | Merkt sich die letzten Fehlermeldungen im Browser (gehen bei „Fehler melden“ mit) |
| `js/console.js` | Konsole im Admin-Bereich (Befehle wie `meldungen`, `claude offen`, `spiel arena beta`, `freunde`, `online`, `lobby leeren`, `stumm`, `passwort-anfragen`) |
| `konsole/` | Admin-Programm zum Installieren (Edge oder Chrome), mit Hinweis bei neuen Meldungen |
| `play/arena/` | Arena-Spiel des Bruders (fertiger Build), Anleitung in `quellen/arena/` |
| `play/gladiator/` | Gladiator 3D (eine HTML-Datei). Online über `Net` der Seite (Raum-Code, Einladung `?join=`, `Hub.roomOpened`), Ergebnisse über `Hub.recordResult` |
| `tools/version.sh` | Vor jedem Hochladen ausführen: neue Versionsnummer an CSS und JavaScript |
| `MASTERPROMPT.md` | Bauplan und Regeln fürs Projekt |
