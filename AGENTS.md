# AGENTS.md - Oelpreis-Manager-Pro

## Kommunikation
- Antworte auf Deutsch, klar, praxisnah und nicht unnoetig ausschweifend.
- Arbeite bei Codeaenderungen in kleinen, nachvollziehbaren Schritten.
- Vor groesseren Aenderungen kurz nennen: Ziel, betroffene Dateien und Risiken.
- Wenn etwas unklar ist, stelle maximal eine gezielte Rueckfrage.

## Projekt
- Pfad: `C:\Users\stefa\OneDrive\Documents\GitHub\Oelpreis-Manager-Pro`
- Branch: `main`
- React/Vite-Projekt.
- Build-Pruefung: `npm run build`
- Dev-Server: `npm run dev -- --host 127.0.0.1`
- Lokale App: `http://127.0.0.1:5173/`

## Datenmodell
- `fluid_typ` enthaelt die Fluessigkeitsart, z. B. `Motoroel`, `Getriebeoel`, `Kuehlmittel`, `Bremsfluessigkeit`, `Sonstiges`.
- `viskositaet` enthaelt die separate Viskositaet, z. B. `0W-20`, `5W-30`, `75W-90`.
- `bemerkungen` in JSON-Daten beibehalten, auch wenn das Feld leer ist.
- `public/data/localdb.json` ist die aktive Hauptdatenbank.
- `src/data/localdb.json` ist ein identischer Spiegel.
- `public/localdb.json` nicht aendern.
- JSON-Feldnamen oder Datenstruktur nicht ohne Rueckfrage aendern.

## Bekannte Datenlage
- Datenstand zuletzt: `2026-05-29 13:16`.
- 43 Datensaetze.
- `OEL-010` hat absichtlich eine leere `viskositaet`.
- `OEL-037` wurde entfernt, weil der Artikel nicht mehr im Bestand ist.
- `public/data/localdb.json` und `src/data/localdb.json` sollen identisch bleiben.

## UI-Stand
- `src/App.jsx` enthaelt die sichtbare Oelliste.
- Bezeichnung wird nur in der Anzeige von doppelter Viskositaet bereinigt.
- Freigaben sind per `mehr` / `weniger` einklappbar.
- Freigaben werden nur in der Anzeige entdoppelt; Originaldaten bleiben unveraendert.
- Kennzahlenkarten dienen als Schnellfilter, z. B. kritische Marge, Preis fehlt, Marge fehlt, Viskositaet offen und Freigaben fehlen.
- Fluessigkeitstypen werden als klickbare Typ-Filter vorbereitet, damit spaeter auch Kuehlmittel, Bremsfluessigkeit und Getriebeoel direkt filterbar sind.
- Vorhandene Hersteller duerfen als Schnellchips aus den geladenen Daten erzeugt werden.
- Vorhandene Viskositaeten/Spezifikationen duerfen als Schnellchips aus den geladenen Daten erzeugt werden.
- Die sichtbare Spalte `Viskositaet/Spez.` ist eine berechnete Anzeige. Sie nutzt `viskositaet` fuer Oele und erkennt spaeter z. B. `DOT 4`, `DOT 5.1`, `G12`, `G13`, `G40`, `D40`, `GL-4`, `GL-5` oder `ATF`.
- EK/VK-Zellen duerfen zusaetzlich kompakte Literpreise anzeigen, ohne die Originalpreise zu veraendern.
- Aktive Suche und Filter werden als kompakte Chips angezeigt und koennen zentral zurueckgesetzt werden.
- Haeufige Freigaben duerfen als Schnellchips angeboten werden. Die Suche bleibt normalisiert, damit z. B. `50400`, `504 00` und `504.00` zusammenpassen.
- Bei langen Freigaben darf die eingeklappte Vorschau bei aktiver Suche automatisch den Trefferbereich zeigen, damit die gelbe Markierung sichtbar bleibt.
- Suche, Sortierung und Datenexport sollen weiter mit den Originalfeldern funktionieren.

## Export
- `OelExport/oel_json_export_v3.py` erzeugt `fluid_typ`, `viskositaet` und `bemerkungen`.
- Die Typ-Erkennung beruecksichtigt Bezeichnung und Freigaben/Bemerkungen.
- `ml`-Gebinde werden fuer spaetere Betriebsstoffe beruecksichtigt.
- Automatische Oel-Verkaufspreisregeln sollen nur fuer `Motoroel` greifen, nicht fuer Kuehlmittel oder Bremsfluessigkeit.
- Exportskript nicht ohne Freigabe ausfuehren, weil es JSON-Dateien und Backups schreiben kann.

## Git/GitHub
- Vor Commit oder Push Status und Diff pruefen.
- Keine Commits oder Pushes ohne ausdrueckliche Freigabe.
- Bei Codeaenderungen vor Commit `npm run build` ausfuehren.
- `.codex/` ist lokale Umgebung und wird ignoriert.

## Vorsicht
- Projekt liegt in OneDrive: Sync- und Lock-Probleme bei `.git`, `node_modules` oder `dist` beachten.
- `public/localdb.json` nicht als aktive Datenbank verwenden.
- In-App-Browser kann unter Windows unzuverlaessig sein; technische Pruefung per Build oder HTTP ist oft robuster.
