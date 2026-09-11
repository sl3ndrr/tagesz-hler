# Implementierungsstatus

Diese Datei ist die zentrale Übergabe zwischen den Arbeitspaketen des Umsetzungsplans. Sie wird mit jeder Umsetzung im selben Pull Request aktualisiert. Folgepakete prüfen den aktuellen `main` und lesen zusätzlich die verlinkten Abschlussberichte der direkten Voraussetzungen.

**Ausgangsstand:** `081d5abf3e04f85b4b00d9df3f8af1d2c64cd454`  
**Stand:** 2026-09-11  
**Statuswerte:** `Geplant` · `In Arbeit` · `Gemergt` · `Blockiert` · `Entfällt`

## Arbeitsregeln

- Ein Paket wird in einem eigenen Branch und Pull Request umgesetzt.
- Vor dem Start muss jede angegebene Voraussetzung den Status `Gemergt` haben.
- Der Pull Request enthält den vollständigen Abschlussbericht: Änderungen und Gründe, betroffene Dateien/Funktionen, ausgeführte und manuelle Tests, Restrisiken, Planabweichungen und offene Fragen.
- Nach dem Merge ergänzt der umsetzende Pull Request diese Datei mit PR-Link, Merge-Commit, Teststatus, Entscheidungen und Übergabehinweisen.
- Abweichungen oder neu erkannte, außerhalb des Pakets liegende Arbeiten werden als `Blockiert` oder als offener Punkt dokumentiert. Der Scope wird nicht still erweitert.

## Überblick

| # | Paket | Befunde | Status | Voraussetzungen | PR / Merge-Commit |
|---|---|---|---|---|---|
| P01 | Test- und CI-Grundlage | B1 | Gemergt | keine | [PR #1](https://github.com/sl3ndrr/tagesz-hler/pull/1) / `da260f23d12130272a457ebba41043def39c39cf` |
| P02 | Sichere Schreibvorgänge und Konfliktbehandlung | A1, B8 | Gemergt | P01 | [PR #2](https://github.com/sl3ndrr/tagesz-hler/pull/2) / `b5847d222e5a5f80ec94a726d4db27cca9c48a7c` |
| P03 | Kalenderrechnung und Aktualisierung bei Uhränderungen | A2, A7, B10 | In Arbeit | P01 | [PR #3](https://github.com/sl3ndrr/tagesz-hler/pull/3), Branch `p03-kalender-uhrwechsel` |
| P04 | Konsistente Offline-Versionen und begrenztes Caching | A3, B3, B4 | In Arbeit | P01 | [PR #4](https://github.com/sl3ndrr/tagesz-hler/pull/4), Branch `p04-konsistente-offline-versionen` |
| P05 | Zugängliche und konsistente Darstellung | A4, A12, B11, B14, B15 | In Arbeit | P01 | [PR #5](https://github.com/sl3ndrr/tagesz-hler/pull/5), Branch `p05-zugaengliche-konsistente-darstellung`; Merge-Commit wird nach dem Merge ergänzt |
| P06 | Einheitliche Daten- und Formularvalidierung | A5, A9, A10, B7, B13 | In Arbeit | P01 | [PR #6](https://github.com/sl3ndrr/tagesz-hler/pull/6), Branch `p06-einheitliche-daten-formularvalidierung`; Merge-Commit wird nach dem Merge ergänzt |
| P07 | Datenrettung und verständliche Speicherzustände | A6, A8 | Geplant | P02, P06 | — |
| P08 | Belastbare Bildverarbeitung und URL-Vorschau | A11, B6 | Geplant | P06 | — |
| P09 | Installationsbezogene Speicherung und Präferenzen | B2, B17 | Geplant | P02, P04, P07 | — |
| P10 | Controller entkoppeln und überflüssigen Zustand entfernen | B12, B16 | Geplant | P02, P07 | — |
| P11 | Ereignislisten gezielt aktualisieren | B9 | Geplant | P03, P05, P10 | — |
| P12 | Schriftarten lokal bereitstellen | B5 | Geplant | P04 | — |
| P13 | Datumssemantik und Wartungsabläufe dokumentieren | B18 | Geplant | P01–P12 | — |
| P14 | Ereignisse suchen und filtern | C1 | Geplant | P11 | — |
| P15 | Vollständiges Backup mit Einstellungen | C3 (Backup) | Geplant | P06, P07, P09 | — |
| P16 | Jährlich wiederkehrende Ereignisse | C2 | Geplant | P03, P06, P09, P11; P15, falls das Backup bereits existiert | — |
| P17 | Kalenderexport als ICS | C3 (ICS) | Geplant | P03, P06; P16 bei vorhandenen jährlichen Wiederholungen | — |
| P18 | Installation und Direktzugriffe verbessern | C4 | Geplant | P04, P05, P12 | — |

## Paketprotokoll

### P01 – Test- und CI-Grundlage

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #1](https://github.com/sl3ndrr/tagesz-hler/pull/1), Merge-Commit `da260f23d12130272a457ebba41043def39c39cf`, getesteter Implementierungscommit `f9c3c3c2de07c48595354b1e0913b6fdafccf81f`.
- **Abschlussbericht:** Node-Bordmittel-Prüfung für Syntax, Manifest, lokale Referenzen, CSP-Grundregeln und Cache-Versionen sowie vier synthetische Regressionstests und ein vorgeschalteter Actions-Prüfjob sind auf `main` vorhanden.
- **Übergabe an Folgepakete:** Jede Änderung an einer Datei der `APP_SHELL` in `sw.js` benötigt im selben Paket eine Änderung von `sw.js` mit erhöhter `CACHE_VERSION`. Der Vergleich nutzt bei Pull Requests den Base-SHA und bei Pushes den vorherigen SHA; Initialläufe prüfen die Basisregeln, überspringen aber den Versionsvergleich.

### P02 – Sichere Schreibvorgänge und Konfliktbehandlung

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #2](https://github.com/sl3ndrr/tagesz-hler/pull/2), Merge-Commit `b5847d222e5a5f80ec94a726d4db27cca9c48a7c`, getesteter Implementierungscommit `6ebacef51191c45e1f4d0be952a45c4caa977d3c`.
- **Abschlussbericht:** Alle Ereignis-Mutationen verwenden eine asynchrone Web-Lock-Transaktion mit erneutem Lesen, Konfliktprüfung, Schreiben und Read-back-Bestätigung. Bearbeitungen vergleichen den konkreten Ausgangsdatensatz; unabhängige Änderungen werden zusammengeführt, echte Konflikte erhalten den Editorentwurf. Deterministische Node-Regressionen decken konkurrierendes Anlegen, Bearbeitungen, Löschen, Import, Quota-Fehler, fehlende Locks und nicht kooperierende Schreiber ab.
- **Übergabe an Folgepakete:** Store- und Controller-Mutationen sind asynchron und müssen vor Erfolgsmeldungen abgewartet werden. Ohne Web Locks sind Ereignis-Schreibvorgänge absichtlich gesperrt. Das bestehende Array-Speicherformat und der Broadcast-Channel bleiben unverändert; Nachrichten tragen zusätzlich `writeProtocolVersion: 2`. Erkannte alte Broadcast-Clients sperren weitere Schreibvorgänge, nicht sendende oder Broadcast-lose alte Tabs sind technisch nicht zuverlässig erkennbar und bleiben ein dokumentiertes Restrisiko. `CACHE_VERSION` wurde wegen der Änderung an `app.js` auf `v3` erhöht.

### P03 – Kalenderrechnung und Aktualisierung bei Uhränderungen

- **Status:** In Arbeit
- **PR / Merge-Commit:** [PR #3](https://github.com/sl3ndrr/tagesz-hler/pull/3), Branch `p03-kalender-uhrwechsel`; Merge-Commit wird nach dem Merge ergänzt.
- **Abschlussbericht:** Nulladditionen erhalten den exakten Instant auch in DST-Folds. Ein leichter sichtbarer Prüftakt erkennt Tages-, Systemzeitzonen- und relevante Uhränderungen, invalidiert zeitabhängige Anzeigen und plant Mitternacht sowie Detailfristen neu. Sekündliche Updates laufen nur bei sichtbarem Sekunden- oder Fortschrittsbedarf. Synthetische Regressionen decken beide Fold-Instanzen, Lücken, Einheitenkombinationen, Monatsenden, Schaltjahre, Uhrsprünge, Zeitzonenwechsel, Mitternacht, Sichtbarkeitswechsel und den reduzierten Leerlauftakt ab.
- **Übergabe an Folgepakete:** Die leichte Erkennung verwendet höchstens einen 30-Sekunden-Takt; entsprechend können Uhr- oder Zeitzonenänderungen im sichtbaren Leerlauf bis zu 30 Sekunden später erscheinen. Gespeicherte Ereigniszeitzonen bleiben unverändert. P11 kann auf `EventListRenderer.needsSecondUpdates()` und den zentralen Neuaufbau in `refreshTemporalViews()` aufsetzen, ohne die Kalendersemantik neu zu definieren.

### P04 – Konsistente Offline-Versionen und begrenztes Caching

- **Status:** In Arbeit
- **PR / Merge-Commit:** [PR #4](https://github.com/sl3ndrr/tagesz-hler/pull/4), Branch `p04-konsistente-offline-versionen`, getesteter Implementierungscommit `d9f46b60f2ea6a699b85ce0e96cc1430b9a3cae7`; Merge-Commit wird nach dem Merge ergänzt.
- **Abschlussbericht:** Die App-Shell wird vollständig in `tageszaehler-v5` installiert und ausschließlich aus dem Cache der aktiven Worker-Version gelesen. Fehlende Assets oder Schreibfehler verwerfen die Installation. Kontrollierte Navigationen verwenden die aktive Shell sofort; nur bei einem verlorenen aktiven Cache wird das Netz zeitlich begrenzt versucht. Allgemeines Runtime-Caching entfällt. Wartende Updates werden nicht erzwungen und in der bestehenden zugänglichen Statusmeldung angekündigt. Synthetische Regressionen decken Versionswechsel mit mehreren Clients, Precache- und Schreibfehler, HTTP 503, Netzabbruch, langsames Netz, Offline-Neustart und Pages-Unterpfade ab.
- **Übergabe an Folgepakete:** App-Shell-Dateien bleiben durch `APP_SHELL` und `CACHE_VERSION` gekoppelt; Folgeänderungen daran müssen die Version weiterhin erhöhen. Der aktive Worker liefert keine Shell-Ressource aus fremden Versionscaches und cached sonstige Laufzeitanfragen nicht. Updates aktivieren regulär erst nach dem Schließen aller App-Tabs; bei einer extern erzwungenen Aktivierung erfolgt aus Rücksicht auf offene Eingaben kein automatisches Neuladen. Die Trusted-Types-Policy bleibt ausschließlich `tageszaehler-sw` für `./sw.js`.
- **Offener Punkt außerhalb P04:** PR #3 ist nachweislich als Merge-Commit `af1998b62e7c7e8d4aba4634da1b771708829e6b` in `main` enthalten, seine P03-Zeile und sein Paketprotokoll stehen dort jedoch noch auf `In Arbeit`. Der P03-Nachtrag auf `Gemergt` ist außerhalb dieses Pakets weiterhin erforderlich.

### P05 – Zugängliche und konsistente Darstellung

- **Status:** In Arbeit
- **PR / Merge-Commit:** [PR #5](https://github.com/sl3ndrr/tagesz-hler/pull/5), Branch `p05-zugaengliche-konsistente-darstellung`, getesteter Implementierungscommit `7ab5d4e92a83029ae9bdf7fe778fb1c88f99ff51`; Merge-Commit wird nach dem Merge ergänzt.
- **Abschlussbericht:** Die Primärfarbe erreicht mit allen vier Akzenten auf den verwendeten hellen und dunklen Flächen mindestens 4,5:1. Der Rechner verwendet eine dauerhafte Statusregion außerhalb der rein visuellen Flip-Ziffern; Fehler und Ergebnisse werden dort angekündigt. Detailbeschreibungen erhalten Zeilenumbrüche, lange Inhalte brechen um, beide Flip-Varianten animieren und reduzierte Bewegung wartet nicht. Wegen App-Shell-Änderungen ist `CACHE_VERSION` nun `v6`.
- **Übergabe an Folgepakete:** `#calc-result-status` muss als stabile Rechner-Live-Region erhalten bleiben; `#calc-flip-clock` enthält nur visuelle Ziffern. Änderungen an App-Shell-Dateien bleiben an eine Erhöhung von `CACHE_VERSION` gekoppelt. Reale Browser-, Zoom-, Screenreader- und Bewegungspräferenzprüfungen stehen noch aus.
- **Offener Punkt außerhalb P05:** P03 und P04 sind laut ihren Merge-Commits in `main`, stehen in Überblick und Paketprotokoll weiterhin auf `In Arbeit`; die Statusnachträge sind außerhalb dieses Pakets zu erledigen.

### P06 – Einheitliche Daten- und Formularvalidierung

- **Status:** In Arbeit
- **PR / Merge-Commit:** [PR #6](https://github.com/sl3ndrr/tagesz-hler/pull/6), Branch `p06-einheitliche-daten-formularvalidierung`; Merge-Commit wird nach dem Merge ergänzt.
- **Abschlussbericht:** Normalisierung akzeptiert IDs nur als String oder endliche Legacy-Zahl und weist falsche vorhandene Typen von `time`/`refDate` kontrolliert über den Quarantänepfad ab. `validity.badInput` verhindert, dass unvollständige native Datum-/Zeiteingaben als leer gespeichert werden. Speichern, Laden, Import und formatierter Export teilen ein UTF-8-Limit von 8 MiB; direkte DST-Listener entfallen zugunsten des Formularpfads. `CACHE_VERSION` ist `v7`.
- **Übergabe an Folgepakete:** P07/P08/P15 können die strikte Ereignisnormalisierung und das gemeinsame UTF-8-Limit voraussetzen. Altformate mit Array-Wurzel, fehlenden/`null` optionalen Zeit-/Referenzwerten und numerischen Legacy-IDs bleiben lesbar. Der reale CI-Lauf sowie Browserprüfungen für native `badInput`-Fälle stehen noch aus.

### P07 – Datenrettung und verständliche Speicherzustände

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P08 – Belastbare Bildverarbeitung und URL-Vorschau

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P09 – Installationsbezogene Speicherung und Präferenzen

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P10 – Controller entkoppeln und überflüssigen Zustand entfernen

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P11 – Ereignislisten gezielt aktualisieren

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P12 – Schriftarten lokal bereitstellen

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P13 – Datumssemantik und Wartungsabläufe dokumentieren

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P14 – Ereignisse suchen und filtern

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P15 – Vollständiges Backup mit Einstellungen

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P16 – Jährlich wiederkehrende Ereignisse

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P17 – Kalenderexport als ICS

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P18 – Installation und Direktzugriffe verbessern

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

