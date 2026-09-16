# Implementierungsstatus

Diese Datei ist die zentrale Übergabe zwischen den Arbeitspaketen des Umsetzungsplans. Sie wird mit jeder Umsetzung im selben Pull Request aktualisiert. Folgepakete prüfen den aktuellen `main` und lesen zusätzlich die verlinkten Abschlussberichte der direkten Voraussetzungen.

**Ausgangsstand:** `081d5abf3e04f85b4b00d9df3f8af1d2c64cd454`  
**Stand:** 2026-09-16  
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
| P03 | Kalenderrechnung und Aktualisierung bei Uhränderungen | A2, A7, B10 | Gemergt | P01 | [PR #3](https://github.com/sl3ndrr/tagesz-hler/pull/3) / `af1998b62e7c7e8d4aba4634da1b771708829e6b` |
| P04 | Konsistente Offline-Versionen und begrenztes Caching | A3, B3, B4 | Gemergt | P01 | [PR #4](https://github.com/sl3ndrr/tagesz-hler/pull/4) / `e8a20f10e6fa4391e34de25d31dc02e79607aaf8` |
| P05 | Zugängliche und konsistente Darstellung | A4, A12, B11, B14, B15 | Gemergt | P01 | [PR #5](https://github.com/sl3ndrr/tagesz-hler/pull/5) / `c697b2da28ec1c549f129f81cd76fbd6c3853627` |
| P06 | Einheitliche Daten- und Formularvalidierung | A5, A9, A10, B7, B13 | Gemergt | P01 | [PR #6](https://github.com/sl3ndrr/tagesz-hler/pull/6) / `c07cb664a102dc7b1f97afa762113729087f1d9e` |
| P07 | Datenrettung und verständliche Speicherzustände | A6, A8 | Gemergt | P02, P06 | [PR #7](https://github.com/sl3ndrr/tagesz-hler/pull/7) / `3e8019ed5fe58285333c265f6c0f5b9b8452e923` |
| P08 | Belastbare Bildverarbeitung und URL-Vorschau | A11, B6 | Gemergt | P06 | [PR #8](https://github.com/sl3ndrr/tagesz-hler/pull/8) / `02f4cb03b032d11fa94b6a9d3a906c30e09e2a90` |
| P09 | Installationsbezogene Speicherung und Präferenzen | B2, B17 | Gemergt | P02, P04, P07 | [PR #9](https://github.com/sl3ndrr/tagesz-hler/pull/9) / `8bdd7f412ff7274dd99862a3ceab68cb51ac961e` |
| P10 | Controller entkoppeln und überflüssigen Zustand entfernen | B12, B16 | Gemergt | P02, P07 | [PR #10](https://github.com/sl3ndrr/tagesz-hler/pull/10) / `de72c0e361d4c895c05893c96a7f3c29d277498e` |
| P11 | Ereignislisten gezielt aktualisieren | B9 | Gemergt | P03, P05, P10 | [PR #13](https://github.com/sl3ndrr/tagesz-hler/pull/13) / `65d5cb5e77607cf94d503ee121d1856cbcc834fb` |
| P12 | Schriftarten lokal bereitstellen | B5 | Gemergt | P04 | [PR #14](https://github.com/sl3ndrr/tagesz-hler/pull/14) / `d1305a46bebda6dedf2987d102c37a36be124ef3` |
| P13 | Datumssemantik und Wartungsabläufe dokumentieren | B18 | Gemergt | P01–P12 | [PR #17](https://github.com/sl3ndrr/tagesz-hler/pull/17) / `b3e572c0126709b15eadb4ae97f8bd601eaa0ab7` |
| P14 | Ereignisse suchen und filtern | C1 | Gemergt | P11 | [PR #18](https://github.com/sl3ndrr/tagesz-hler/pull/18) / `8a3b4634afe0637f51937d73592f393f53cc012d` |
| P15 | Vollständiges Backup mit Einstellungen | C3 (Backup) | In Arbeit | P06, P07, P09 | [PR #19](https://github.com/sl3ndrr/tagesz-hler/pull/19), Branch `p15-vollstaendiges-backup-einstellungen`; Merge-Commit nach Merge |
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

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #3](https://github.com/sl3ndrr/tagesz-hler/pull/3), Merge-Commit `af1998b62e7c7e8d4aba4634da1b771708829e6b`, getesteter Branch-Commit `fd3ec317474cb14000d802fe208412726ed8f035`; [CI-Lauf #14](https://github.com/sl3ndrr/tagesz-hler/actions/runs/34623547573) laut PR-Abschlussbericht erfolgreich. Reale Browser-/Uhrprüfungen nicht ausgeführt.
- **Abschlussbericht:** Nulladditionen erhalten den exakten Instant auch in DST-Folds. Ein leichter sichtbarer Prüftakt erkennt Tages-, Systemzeitzonen- und relevante Uhränderungen, invalidiert zeitabhängige Anzeigen und plant Mitternacht sowie Detailfristen neu. Sekündliche Updates laufen nur bei sichtbarem Sekunden- oder Fortschrittsbedarf. Synthetische Regressionen decken beide Fold-Instanzen, Lücken, Einheitenkombinationen, Monatsenden, Schaltjahre, Uhrsprünge, Zeitzonenwechsel, Mitternacht, Sichtbarkeitswechsel und den reduzierten Leerlauftakt ab.
- **Übergabe an Folgepakete:** Die leichte Erkennung verwendet höchstens einen 30-Sekunden-Takt; entsprechend können Uhr- oder Zeitzonenänderungen im sichtbaren Leerlauf bis zu 30 Sekunden später erscheinen. Gespeicherte Ereigniszeitzonen bleiben unverändert. P11 kann auf `EventListRenderer.needsSecondUpdates()` und den zentralen Neuaufbau in `refreshTemporalViews()` aufsetzen, ohne die Kalendersemantik neu zu definieren.

### P04 – Konsistente Offline-Versionen und begrenztes Caching

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #4](https://github.com/sl3ndrr/tagesz-hler/pull/4), Merge-Commit `e8a20f10e6fa4391e34de25d31dc02e79607aaf8`, getesteter Branch-Commit `fad5cb6c96d74979ceb1bf03666ea1bae07b5107`; [CI-Lauf #17](https://github.com/sl3ndrr/tagesz-hler/actions/runs/34625692467) laut PR-Abschlussbericht erfolgreich. Reale Offline-/Mehrtab-Browserprüfungen nicht ausgeführt.
- **Abschlussbericht:** Die App-Shell wird vollständig in `tageszaehler-v5` installiert und ausschließlich aus dem Cache der aktiven Worker-Version gelesen. Fehlende Assets oder Schreibfehler verwerfen die Installation. Kontrollierte Navigationen verwenden die aktive Shell sofort; nur bei einem verlorenen aktiven Cache wird das Netz zeitlich begrenzt versucht. Allgemeines Runtime-Caching entfällt. Wartende Updates werden nicht erzwungen und in der bestehenden zugänglichen Statusmeldung angekündigt. Synthetische Regressionen decken Versionswechsel mit mehreren Clients, Precache- und Schreibfehler, HTTP 503, Netzabbruch, langsames Netz, Offline-Neustart und Pages-Unterpfade ab.
- **Übergabe an Folgepakete:** App-Shell-Dateien bleiben durch `APP_SHELL` und `CACHE_VERSION` gekoppelt; Folgeänderungen daran müssen die Version weiterhin erhöhen. Der aktive Worker liefert keine Shell-Ressource aus fremden Versionscaches und cached sonstige Laufzeitanfragen nicht. Updates aktivieren regulär erst nach dem Schließen aller App-Tabs; bei einer extern erzwungenen Aktivierung erfolgt aus Rücksicht auf offene Eingaben kein automatisches Neuladen. Die Trusted-Types-Policy bleibt ausschließlich `tageszaehler-sw` für `./sw.js`.
- **Historischer Statuspunkt (mit P08 erledigt):** PR #3 war bereits als Merge-Commit `af1998b62e7c7e8d4aba4634da1b771708829e6b` in `main`, während die P03-Übergabe noch `In Arbeit` zeigte. Überblick und P03-Protokoll wurden auf `Gemergt` berichtigt.

### P05 – Zugängliche und konsistente Darstellung

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #5](https://github.com/sl3ndrr/tagesz-hler/pull/5), Merge-Commit `c697b2da28ec1c549f129f81cd76fbd6c3853627`; [CI-Lauf #20](https://github.com/sl3ndrr/tagesz-hler/actions/runs/34639271789) laut PR-Abschlussbericht erfolgreich. Reale Browser-/Screenreader-/Zoomprüfungen nicht ausgeführt.
- **Abschlussbericht:** Die Primärfarbe erreicht mit allen vier Akzenten auf den verwendeten hellen und dunklen Flächen mindestens 4,5:1. Der Rechner verwendet eine dauerhafte Statusregion außerhalb der rein visuellen Flip-Ziffern; Fehler und Ergebnisse werden dort angekündigt. Detailbeschreibungen erhalten Zeilenumbrüche, lange Inhalte brechen um, beide Flip-Varianten animieren und reduzierte Bewegung wartet nicht. Wegen App-Shell-Änderungen ist `CACHE_VERSION` nun `v6`.
- **Übergabe an Folgepakete:** `#calc-result-status` muss als stabile Rechner-Live-Region erhalten bleiben; `#calc-flip-clock` enthält nur visuelle Ziffern. Änderungen an App-Shell-Dateien bleiben an eine Erhöhung von `CACHE_VERSION` gekoppelt. Reale Browser-, Zoom-, Screenreader- und Bewegungspräferenzprüfungen stehen noch aus.
- **Historischer Statuspunkt (mit P08 erledigt):** P03 und P04 waren bereits gemergt, aber ihre Übergabe noch auf `In Arbeit`. Beide Statusnachträge wurden in Überblick und Paketprotokoll berichtigt.

### P06 – Einheitliche Daten- und Formularvalidierung

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #6](https://github.com/sl3ndrr/tagesz-hler/pull/6), Merge-Commit `c07cb664a102dc7b1f97afa762113729087f1d9e`, getesteter Branch-Commit `d9fee2650311dff60654c10a2c21096dfb6952a5`; [CI-Lauf #23](https://github.com/sl3ndrr/tagesz-hler/actions/runs/34640864525) laut PR-Abschlussbericht erfolgreich.
- **Abschlussbericht:** Normalisierung akzeptiert IDs nur als String oder endliche Legacy-Zahl und weist falsche vorhandene Typen von `time`/`refDate` kontrolliert über den Quarantänepfad ab. `validity.badInput` verhindert, dass unvollständige native Datum-/Zeiteingaben als leer gespeichert werden. Speichern, Laden, Import und formatierter Export teilen ein UTF-8-Limit von 8 MiB; direkte DST-Listener entfallen zugunsten des Formularpfads. `CACHE_VERSION` ist `v7`.
- **Übergabe an Folgepakete:** P07/P08/P15 können die strikte Ereignisnormalisierung und das gemeinsame UTF-8-Limit voraussetzen. Altformate mit Array-Wurzel, fehlenden/`null` optionalen Zeit-/Referenzwerten und numerischen Legacy-IDs bleiben lesbar. Browserprüfungen für native `badInput`-Fälle stehen noch aus.

### P07 – Datenrettung und verständliche Speicherzustände

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #7](https://github.com/sl3ndrr/tagesz-hler/pull/7), Merge-Commit `3e8019ed5fe58285333c265f6c0f5b9b8452e923`, getesteter Branch-Commit `de141777d1ea479414055a0dc275600b9d984f00`; [CI-Lauf #26](https://github.com/sl3ndrr/tagesz-hler/actions/runs/34965238822) laut PR-Abschlussbericht erfolgreich. Reale Browser-/Fokusprüfungen nicht ausgeführt.
- **Abschlussbericht:** Der vollständige Bericht steht in der PR-Beschreibung. Aktiver Rohbestand und gesicherte Rettungskopien sind getrennt exportierbar; eine validierte, ausdrücklich bestätigte Wiederherstellung oder Ersetzung läuft unter dem P02-Web-Lock mit Bestandsvergleich und Read-back. Teilvalidierung lässt die Rohkopie bestehen und sperrt stille Änderungen. Drei bestätigte Löschvarianten betreffen nur aktive Ereignisse und/oder die beiden zugehörigen Rettungsschlüssel. Ein erfolgreiches erneutes Lesen hebt vorübergehenden Schreibschutz auch bei gleicher Revision auf. App-Shell-Version `v8`.
- **Übergabe an Folgepakete:** Rettungskopien werden nach Wiederherstellung nicht automatisch entfernt; der unveränderte Rohdatenexport ist kein vollständiges Backup mit Einstellungen (P15). Alle aktiven Ersetzungen und Löschungen benötigen Web Locks; alte, nicht kooperierende Tabs bleiben das dokumentierte P02-Restrisiko. Der Rettungsdialog verwendet ein natives modales `dialog`, fokussiert explizit und stellt den Ausgangsfokus beim Schließen wieder her. Reale Browser-/Tastatur-/Fokusprüfung steht aus.
- **Historischer Statuspunkt (mit P08 erledigt):** P06 war laut [PR #6](https://github.com/sl3ndrr/tagesz-hler/pull/6) als `c07cb664a102dc7b1f97afa762113729087f1d9e` gemergt, aber die Übergabe veraltet. P07 wurde damals vom Nutzer ausdrücklich trotz dieser Diskrepanz freigegeben. P03–P06 sind nun in Überblick und Paketprotokoll berichtigt.

### P08 – Belastbare Bildverarbeitung und URL-Vorschau

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #8](https://github.com/sl3ndrr/tagesz-hler/pull/8), Merge-Commit `02f4cb03b032d11fa94b6a9d3a906c30e09e2a90`, getesteter Branch-Commit `eb67b2848e05e9355e6e58d33dd87064ab9508a0`; [Actions #30](https://github.com/sl3ndrr/tagesz-hler/actions/runs/34968401340) erfolgreich. Reale Browser-/DevTools-/Offline- und Referrerprüfungen nicht ausgeführt.
- **Abschlussbericht:** Vollständiger Bericht in der PR-Beschreibung. Upload und JSON-Bildimport prüfen Base64, Bildsignaturen, MIME und Headerdimensionen vor dem Dekodieren; eingebettete Importbilder werden zusätzlich tatsächlich dekodiert. URL-Vorschauen warten 400 ms auf vollständige absolute URLs und verwerfen überholte Ergebnisse. Die Darstellung verwendet `no-referrer`; App-Shell-Version `v9`.
- **Übergabe an Folgepakete:** Uploadlimit 20 MiB, maximal 24 Mio. Bildpixel und 10.000 Pixel je Achse; eingebettete Bilder bleiben zusätzlich durch P06-Quellen-/Bestandslimits begrenzt. Headerprüfung verhindert den großen Dekodierschritt für erkannte Ausreißer, kann jedoch nicht die Browserinternen Ressourcen der anschließenden Dekodierung oder jedes beschädigte Kompressionsdetail vorab beweisen. CSS-Hintergrundbilder übernehmen den dokumentweiten `no-referrer`-Wert; externe Bilder werden nicht offline gespeichert. Reale Browserprüfung bleibt vor Merge offen.
- **Statuskorrektur außerhalb P08:** P03–P07 sind nach GitHub-PRs und Vorfahrvergleich auf `main` gemergt; ihre veralteten Zeilen und Protokolle wurden auf den tatsächlichen Merge-Stand gebracht. Historische offene Statushinweise in den alten Paketprotokollen sind damit erledigt; andere fachliche Restrisiken bleiben bestehen.

### P09 – Installationsbezogene Speicherung und Präferenzen

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #9](https://github.com/sl3ndrr/tagesz-hler/pull/9), Merge-Commit `8bdd7f412ff7274dd99862a3ceab68cb51ac961e`, getesteter Branch-Commit `11b2a03e0348d49deb7be6e1c3e559620acfa88d`; [Actions #34](https://github.com/sl3ndrr/tagesz-hler/actions/runs/35007155693) erfolgreich. Reale Browser-/Offline-/Mehrtabprüfungen nicht ausgeführt.
- **Abschlussbericht:** Vollständiger Bericht in der PR-Beschreibung. Verzeichnispfad-basierte Installationsschlüssel, Channel-/Lock-Namen und Shell-Caches; früh gelesene Präferenzen; explizite Altquellenwahl und persistenzfehlerbezogener UI-Hinweis. Shell-Version `v10`.
- **Übergabe an Folgepakete:** Alte originweite Ereignisse, Rettungskopien und Einstellungen werden nicht automatisch einer Installation zugeordnet oder gelöscht. Übernahme braucht explizite Bestätigung; Ereignisse nur in unbeschriebenen Zielbestand unter altem und neuem Web Lock mit Quellen-/Zielvergleich und Read-back. Alte sendende Tabs werden über den bisherigen Channel beziehungsweise den alten Storage-Schlüssel erkannt und sperren weitere Schreibvorgänge; stumme alte Tabs bleiben nicht zuverlässig erkennbar. Präferenzauswahl wirkt sofort, ein fehlgeschlagener dauerhafter Schreibzugriff wird gemeldet. Jede weitere App-Shell-Änderung benötigt eine neue Cache-Version.
- **Statusnachtrag:** GitHub bestätigt den Merge von PR #8 und PR #9. Überblick und Protokoll führen die tatsächlichen Merge-Commits und beobachteten CI-Läufe jetzt nach. Alte gemeinsame Schlüssel bleiben bis zu einer ausdrücklich bestätigten Auswahl unangetastet.

### P10 – Controller entkoppeln und überflüssigen Zustand entfernen

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #10](https://github.com/sl3ndrr/tagesz-hler/pull/10), Merge-Commit `de72c0e361d4c895c05893c96a7f3c29d277498e`, getesteter Branch-Commit `1674b8433a3432d94bf0798abf4616afb30f1415`; [Actions #37](https://github.com/sl3ndrr/tagesz-hler/actions/runs/35008534192) erfolgreich. Reale Browser-/Zwei-Tab-/Fokus-/Offlineprüfungen nicht ausgeführt.
- **Abschlussbericht:** Vollständiger Bericht in der PR-Beschreibung. Sheet-Auswahl und Editor-Ausgangsdatensatz gehören zur UI; der Controller nutzt explizite UI-Callbacks für Darstellung, Rückmeldungen und Rettungsdialog. Der ungenutzte `normalizeEvent`-Index sowie durchgereichte `migrated`-/`updatedAt`-Snapshotdaten entfallen; alte Array- und v2-Daten bleiben lesbar. App-Shell-Version `v11`.
- **Übergabe an Folgepakete:** P02-Bearbeitungskonflikte verwenden weiterhin den beim Öffnen erfassten Ausgangsdatensatz; Store-Mutationen werden vor Erfolg und Sheet-Schließen abgewartet. Externe Änderungen, Rettungsstatus und Benachrichtigungen laufen über `createEventControllerUI`; P11 kann diese Schnittstelle verwenden, ohne Speicher- oder Kalendersemantik zu ändern. Die Browser-/Zwei-Tab-/Fokusprüfung steht noch aus; eine weitere Änderung an `app.js` oder anderen Shell-Dateien verlangt eine neue `CACHE_VERSION`.
- **Statusnachtrag:** GitHub bestätigt die Merges von PR #8 bis PR #10. Überblick und Protokoll führen die tatsächlichen Merge-Commits und beobachteten CI-Läufe jetzt nach. Sheet-Auswahl bleibt UI-eigen; Altformate bleiben lesbar.

### P11 – Ereignislisten gezielt aktualisieren

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #13](https://github.com/sl3ndrr/tagesz-hler/pull/13), Merge-Commit `65d5cb5e77607cf94d503ee121d1856cbcc834fb`, getesteter Branch-Commit `7df50f51fe1139902f8db7eb9b9c2647d801d6bc`; [Actions #47](https://github.com/sl3ndrr/tagesz-hler/actions/runs/35011681101) erfolgreich.
- **Abschlussbericht:** Unveränderte Ereignisse verwenden ihr Zeitmodell und ihren DOM-Knoten weiter. Ereignisänderung, Zeitablauf an einer Zeitgrenze, Tages-/Zeitzonenwechsel, Einheiten-/Ansichtswechsel und Sichtbarkeitswechsel invalidieren gezielt. Differenzen werden je Ansichtsobjekt innerhalb desselben Schritts geteilt; gelöschte Ereignisse entfernen Modellcache und Ansicht.
- **Übergabe an Folgepakete:** `EventListModelCache` hält höchstens aktive Ereignis-Modelle. `getRenderStats()` liefert die letzte Renderzählung für synthetische Regressionen. `refreshTemporalViews()` ruft den Renderer mit temporaler Invalidierung auf; eine Änderung an `app.js` erhöhte die Shell-Version auf `v12`. Reale Browser-/Scroll-/Mitternachts-/Uhrsprungprüfungen stehen vor Merge aus.
- **Statusnachtrag:** GitHub bestätigt Merge-Commit `65d5cb5e77607cf94d503ee121d1856cbcc834fb`; Überblick und Protokoll führen jetzt den tatsächlichen Merge-Commit, den getesteten Branch-Commit und Actions #47. Der Modellcache bleibt auf aktive Ereignisse begrenzt.

### P12 – Schriftarten lokal bereitstellen

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #14](https://github.com/sl3ndrr/tagesz-hler/pull/14), Merge-Commit `d1305a46bebda6dedf2987d102c37a36be124ef3`, getesteter Branch-Commit `b50a94628416cf01167bcad5de29e9ac8419145a`; [Actions #51](https://github.com/sl3ndrr/tagesz-hler/actions/runs/35058584345) erfolgreich.
- **Abschlussbericht:** Die externe Google-Fonts-Einbindung wurde durch zwei lokale variable Roboto-Flex-WOFF2-Teilmengen für Latin und Latin Extended ersetzt. Google-Fonts-Preconnects sowie CSP-Hostfreigaben entfallen. Lizenz und Herkunft liegen in `fonts/`; `CACHE_VERSION` ist wegen der App-Shell-Erweiterung `v13`.
- **Übergabe an Folgepakete:** Jede Änderung an `index.html`, `styles.css` oder lokalen Schriftdateien bleibt eine App-Shell-Änderung und verlangt Precache-Eintrag sowie eine erhöhte `CACHE_VERSION`. Neue Schriften dürfen keinen externen Laufzeitdienst einführen; sie benötigen lokale Dateien, Lizenz/Herkunft und relative URLs. Reale Browser-/DevTools-Netzwerk-/Offline-/schmale-Viewport-Prüfungen stehen vor Merge aus.
- **Statusnachtrag:** GitHub bestätigt Merge-Commit `d1305a46bebda6dedf2987d102c37a36be124ef3`; Überblick und Protokoll führen jetzt den tatsächlichen Merge-Commit, den getesteten Branch-Commit und Actions #51. Lokale Roboto-Flex-Dateien samt OFL/Herkunft und App-Shell-Kopplung bleiben erhalten.

### P13 – Datumssemantik und Wartungsabläufe dokumentieren

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #17](https://github.com/sl3ndrr/tagesz-hler/pull/17), Merge-Commit `b3e572c0126709b15eadb4ae97f8bd601eaa0ab7`, getesteter Branch-Commit `b927e64eaff6d076924770d7b84c60ec58bcce03`; [Actions #58](https://github.com/sl3ndrr/tagesz-hler/actions/runs/35111851514) erfolgreich.
- **Abschlussbericht:** Datumssemantik, Zeitumstellungsgrenzen, Monats-Clamping, Einheitenreste, Speicher-/Rettungsabläufe, lokale Schrift- und Icon-Wartung sowie ausführenbare Prüfungen werden am aktuellen Code dokumentiert. Erklärende Kommentare erläutern nur bestehende Datumshelfer.
- **Übergabe an Folgepakete:** Dokumentiert werden ausschließlich abgesicherte Voraussetzungen; praktische Browser-/Zeitzonen-Kompatibilität bleibt ausdrücklich unbestätigt. Änderungen an `app.js` sind App-Shell-Änderungen und erhöhen `CACHE_VERSION` auf `v15`.

### P14 – Ereignisse suchen und filtern

- **Status:** Gemergt
- **PR / Merge-Commit:** [PR #18](https://github.com/sl3ndrr/tagesz-hler/pull/18), Merge-Commit `8a3b4634afe0637f51937d73592f393f53cc012d`, getesteter Branch-Commit `5879f3cc18ccfd08f92888e199e0fe2ab1a5cc59`; [Actions #61](https://github.com/sl3ndrr/tagesz-hler/actions/runs/35113276632) erfolgreich.
- **Abschlussbericht:** Lokale Suche über Name/Beschreibung und Filter für Zeitlage sowie Ganztägig/Uhrzeit; Karten und Kompaktansicht verwenden denselben gefilterten Rendererbestand. Trefferzahl, Zurücksetzen und getrennte Leerzustände ergänzen die bestehende Liste ohne Datenänderung.
- **Übergabe an Folgepakete:** Die Suche normalisiert deutschsprachige Akzente und `ß` zu `ss`; mehrteilige Eingaben sind eine UND-Suche über Name/Beschreibung. Reale Browser-, Tastatur-/Screenreader-, Offline- und große-Sammlung-Prüfungen stehen weiterhin aus.

### P15 – Vollständiges Backup mit Einstellungen

- **Status:** In Arbeit
- **PR / Merge-Commit:** [PR #19](https://github.com/sl3ndrr/tagesz-hler/pull/19), Branch `p15-vollstaendiges-backup-einstellungen`; letzter getesteter Commit und CI-Lauf werden im PR-Abschlussbericht geführt. Merge-Commit und Status `Gemergt` erst nach tatsächlichem Merge.
- **Abschlussbericht:** Versioniertes Vollbackup (`tageszaehler-backup`, Version 1) für Ereignisse sowie Theme, Farbe und Ansicht; bisherige Ereignis-Arrays bleiben importierbar. Die Wiederherstellung validiert Datei, Bilder, Größen und Präferenztypen vollständig vor produktiven Schreibzugriffen und verwendet ein installationsbezogenes, per Read-back bestätigtes Rollback-Journal. App-Shell-Version `v17`.
- **Übergabe an Folgepakete:** Das Journal stellt keine echte `localStorage`-Mehrschlüsseltransaktion dar. Es ermöglicht bestätigten Commit oder sichtbaren Rollback beim Start; kann die Rücknahme nicht bestätigt werden, bleiben Schreibzugriffe gesperrt. Ereignisse sind auf 8 MiB, vollständige Backup-Dateien auf 10 MiB UTF-8 begrenzt. P07-Rohdaten und Quarantänekopien werden nicht in das Vollbackup aufgenommen, ersetzt oder gelöscht.

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
