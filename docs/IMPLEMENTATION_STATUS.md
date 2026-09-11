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
| P03 | Kalenderrechnung und Aktualisierung bei Uhränderungen | A2, A7, B10 | In Arbeit | P01 | Branch `p03-kalender-uhrwechsel` |
| P04 | Konsistente Offline-Versionen und begrenztes Caching | A3, B3, B4 | Geplant | P01 | — |
| P05 | Zugängliche und konsistente Darstellung | A4, A12, B11, B14, B15 | Geplant | P01 | — |
| P06 | Einheitliche Daten- und Formularvalidierung | A5, A9, A10, B7, B13 | Geplant | P01 | — |
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
- **PR / Merge-Commit:** Branch `p03-kalender-uhrwechsel`; PR und Merge-Commit werden nach Erstellung beziehungsweise Merge ergänzt.
- **Abschlussbericht:** Nulladditionen erhalten den exakten Instant auch in DST-Folds. Ein leichter sichtbarer Prüftakt erkennt Tages-, Systemzeitzonen- und relevante Uhränderungen, invalidiert zeitabhängige Anzeigen und plant Mitternacht sowie Detailfristen neu. Sekündliche Updates laufen nur bei sichtbarem Sekunden- oder Fortschrittsbedarf. Synthetische Regressionen decken beide Fold-Instanzen, Lücken, Einheitenkombinationen, Monatsenden, Schaltjahre, Uhrsprünge, Zeitzonenwechsel, Mitternacht, Sichtbarkeitswechsel und den reduzierten Leerlauftakt ab.
- **Übergabe an Folgepakete:** Die leichte Erkennung verwendet höchstens einen 30-Sekunden-Takt; entsprechend können Uhr- oder Zeitzonenänderungen im sichtbaren Leerlauf bis zu 30 Sekunden später erscheinen. Gespeicherte Ereigniszeitzonen bleiben unverändert. P11 kann auf `EventListRenderer.needsSecondUpdates()` und den zentralen Neuaufbau in `refreshTemporalViews()` aufsetzen, ohne die Kalendersemantik neu zu definieren.

### P04 – Konsistente Offline-Versionen und begrenztes Caching

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P05 – Zugängliche und konsistente Darstellung

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P06 – Einheitliche Daten- und Formularvalidierung

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

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
