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
| P01 | Test- und CI-Grundlage | B1 | Geplant | keine | — |
| P02 | Sichere Schreibvorgänge und Konfliktbehandlung | A1, B8 | Geplant | P01 | — |
| P03 | Kalenderrechnung und Aktualisierung bei Uhränderungen | A2, A7, B10 | Geplant | P01 | — |
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

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P02 – Sichere Schreibvorgänge und Konfliktbehandlung

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

### P03 – Kalenderrechnung und Aktualisierung bei Uhränderungen

- **Status:** Geplant
- **PR / Merge-Commit:** —
- **Abschlussbericht:** —
- **Übergabe an Folgepakete:** —

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
