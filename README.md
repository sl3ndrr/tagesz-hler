# Tageszähler & Rechner

Eine deutschsprachige, installierbare Progressive Web App zum Verwalten kommender und vergangener Ereignisse sowie zum kalendergenauen Berechnen von Zeitabständen.

Nach Aktivierung von GitHub Pages ist die Web-App unter <https://sl3ndrr.github.io/tagesz-hler/> erreichbar.

## Funktionen

- sekundengenaue Zähler für zukünftige und vergangene Ereignisse
- jährliche Geburtstage und Jahrestage mit automatisch nächstem Auftreten
- Datumsrechner mit Jahren, Monaten, Wochen, Tagen, Stunden, Minuten und Sekunden
- optionale Beschreibungen und Hintergrundbilder
- Karten- und Kompaktansicht sowie System-, Hell- und Dunkelmodus
- ausschließlich lokale Datenhaltung im Browser über `localStorage`
- JSON-Import und -Export mit Validierung und Größenlimits
- installierbare PWA mit Offline-App-Shell
- strikte Content-Security-Policy ohne Inline-JavaScript

## Suche und Filter

Die Lupe in der App-Bar öffnet die Ereignissuche über den Listen. Im Ruhezustand nimmt sie nur den Platz eines Icons ein. Du kannst die Suche auch mit `/` oder `Strg`/`Cmd` + `K` öffnen, sofern kein Eingabefeld, Menü oder Dialog aktiv ist. Schließen funktioniert über die Lupe, den Schließen-Button oder `Escape`; der Fokus kehrt zur Lupe zurück. Im Rechner ist die Suche ausgeblendet.

Die Suche berücksichtigt Name und Beschreibung, ignoriert Groß-/Kleinschreibung und normalisiert Akzente sowie `ß` zu `ss`. Mehrere Begriffe müssen alle vorkommen. Der erklärende Hinweis erscheint nur bei mehreren Begriffen ohne Treffer. Eingaben werden nach 120 ms Ruhe verarbeitet.

Die Chips „Kommend“/„Vergangen“ und „Ganztägig“/„Mit Uhrzeit“ sind innerhalb ihres Paares exklusiv. Noch einmal auf einen ausgewählten Chip tippen hebt den Filter dieser Gruppe auf. Alle Chips sind regulär per Tab erreichbar. „Zurücksetzen“ leert Suchtext und Chips und fokussiert das Suchfeld.

Filter bleiben beim Schließen und beim Tabwechsel erhalten, werden aber nicht gespeichert. Eine geschlossene, aktive Suche ist am Punkt auf der Lupe, ihrer zugänglichen Beschriftung und dem Treffertext unter der Listenüberschrift erkennbar.

## Einstellungen und Daten

Das Menü zeigt zunächst Darstellung, vier Akzentfarben und Ansicht sowie gegebenenfalls „App installieren“. Darstellung und Ansicht sind verbundene Auswahlgruppen: Pfeiltasten wechseln die Auswahl, `Home`/`End` springen zum ersten/letzten Eintrag. Die gewählte Akzentfarbe zeigt ein Häkchen.

„Daten & Sicherung“ öffnet die zweite Ebene mit vollständigem Backup, Ereignis- und Kalenderexport, Import sowie Datenrettung. „Daten gezielt löschen“ steht optisch abgesetzt am Ende dieser Ebene. Die bestehenden Bestätigungen und Datenformate bleiben erhalten.

Auf breiten Bildschirmen öffnet sich ein Popover, bis 600 px ein modales Bottom-Sheet. Du kannst es über den Schließen-Button, den Hintergrund, `Escape` oder durch Ziehen am Griff nach unten schließen. `Escape` führt aus „Daten & Sicherung“ zunächst zu den Einstellungen zurück. Beim erneuten Öffnen beginnt das Menü immer dort. Nach dem separaten Rettungsdialog kehrt der Fokus zum Einstellungsbutton zurück.

## Versionierung

Die dezente Versionsnummer im Einstellungsmenü öffnet einen Dialog mit Datum und Änderungen. Version, Datum und Änderungsprotokoll stehen in `APP_RELEASES` in `app.js`; eine neue Veröffentlichung wird dort vorne ergänzt. `CACHE_VERSION` in `sw.js` ist ein unabhängiger interner Zähler für die Offline-App-Shell. Bei Änderungen an ausgelieferten Dateien wird dieser Zähler erhöht, auch wenn die angezeigte Produktversion gleich bleibt.

## Technische Entscheidungen

Das Projekt bleibt bewusst bei Vanilla HTML, CSS und JavaScript ohne Paketmanager oder Build-Schritt. Dadurch ist die ausgelieferte Version direkt prüfbar, es gibt keine Laufzeit- oder Build-Abhängigkeiten und die gehostete URL kann später unverändert durch eine Trusted Web Activity verwendet werden.

Die zwei ursprünglichen Skriptphasen bleiben getrennt:

- `theme.js` wird früh im `<head>` geladen und setzt gespeicherte Darstellungspräferenzen vor dem ersten Rendern.
- `app.js` enthält die bestehende Anwendungslogik und wird am Ende des `<body>` geladen.

Eine weitere fachliche Modularisierung wäre eine funktionale Refaktorierung und ist deshalb nicht Teil der strukturellen Migration.

## Projektstruktur

```text
.
├── .github/workflows/deploy-pages.yml
├── scripts/check-static-pwa.mjs
├── tests/check-static-pwa.test.mjs
├── docs/MIGRATION.md
├── icons/
├── index.html
├── styles.css
├── theme.js
├── app.js
├── manifest.webmanifest
├── sw.js
├── LICENSE
└── README.md
```

## Lokal ausführen

Es ist keine Installation erforderlich. Wegen Service Worker und PWA-Funktionen sollte die App über HTTP statt direkt als `file://` geöffnet werden:

```bash
python3 -m http.server 8080
```

Danach <http://localhost:8080/> öffnen. `localhost` gilt für Service Worker als sicherer Kontext.

## Content-Security-Policy

Die CSP steht als Meta-Policy in `index.html`. Ausführbarer Code und Stylesheets liegen in externen, gleichursprünglichen Dateien; daher sind keine SHA-256-Hashes für Inline-Blöcke mehr nötig. Inline-Event-Handler bleiben durch `script-src-attr 'none'` gesperrt. Roboto Flex wird mit zwei lokalen, relativen WOFF2-Dateien aus `fonts/` geladen; CSP-Freigaben für Google-Fonts-Hosts entfallen. Lizenz und nachvollziehbare Herkunft liegen neben den Schriftdateien. Vom Nutzer hinterlegte HTTPS-Bilder bleiben über `img-src` zulässig.

Trusted Types bleiben für Script-Sinks erzwungen. Ausschließlich die benannte Policy `tageszaehler-sw` ist zugelassen; sie erzeugt nur für den fest codierten Pfad `./sw.js` eine `TrustedScriptURL`. Dadurch kann der Service Worker registriert werden, ohne die Trusted-Types-Erzwingung aufzugeben.

Bei Änderungen keine Inline-Skripte oder Inline-Stylesheet-Blöcke hinzufügen. Die dynamisch gesetzten Style-Attribute der bestehenden UI benötigen weiterhin `style-src-attr 'unsafe-inline'`.

## PWA und Offline-Cache

`manifest.webmanifest` enthält relative `start_url`- und `scope`-Werte, damit die App auch unter dem GitHub-Pages-Unterpfad funktioniert. `sw.js` speichert die vollständige lokale App-Shell in einem Cache pro Worker-Version. Ein kontrollierter Tab erhält Navigation, JavaScript und CSS ausschließlich aus diesem aktiven Versionscache; dadurch kann ein bereitstehendes Update keine Shell-Versionen mischen. Navigationen verwenden die gespeicherte Shell auch bei HTTP-Fehlern, Netzabbruch oder langsamem Netz ohne darauf zu warten.

Ein neuer Worker überspringt die Wartephase nicht. Er wird erst aktiv, wenn keine Tabs der bisherigen Version mehr geöffnet sind. Die App meldet ein bereitstehendes Update zugänglich über die vorhandene Statusmeldung. Falls eine Aktivierung außerhalb dieses Ablaufs erzwungen wird, lädt die App nicht automatisch neu und lässt offene Eingaben bestehen. Sonstige gleichursprüngliche GET-Anfragen werden ohne Runtime-Cache direkt aus dem Netz geladen; fehlgeschlagene oder unvollständige Precache-Installationen werden verworfen. Bei Änderungen an ausgelieferten statischen Dateien muss `CACHE_VERSION` in `sw.js` erhöht werden.

### Installation und Direktzugriffe

Das Manifest enthält einen echten, mit synthetischen Beispieldaten erstellten
Screenshot sowie die optionalen Direktzugriffe „Neues Ereignis“ und „Rechner“.
Unterstützende Browser können diese beim Installieren oder im App-Kontext
anzeigen. Die Ziele bleiben relativ zum GitHub-Pages-Unterpfad:
`./?action=new-event` öffnet den vorhandenen Ereigniseditor,
`./?action=calculator` den vorhandenen Rechner. Andere oder unbekannte
`action`-Werte werden ohne Änderung des normalen Starts ignoriert.

Der Screenshot und seine Herkunft sind in
[`screenshots/README.md`](screenshots/README.md) dokumentiert. Er gehört zur
versionierten App-Shell und steht nach einem erfolgreichen Erstladen auch
offline bereit.

## GitHub Pages

Jeder Push auf `main` startet `.github/workflows/deploy-pages.yml`. Der Workflow paketiert nur die statischen Laufzeitdateien; ein Build findet nicht statt.

Vor dem Deployment und bei Pull Requests nach `main` läuft `node scripts/check-static-pwa.mjs`. Die Prüfung verwendet ausschließlich Node-Bordmittel und prüft JavaScript-Syntax, Manifest, lokale Referenzen, CSP-Grundregeln und den Versionswechsel des Service-Worker-Caches. Für Änderungen an einer gecachten App-Shell-Datei muss im selben Vergleich `sw.js` mit erhöhter `CACHE_VERSION` vorliegen. Ohne verfügbaren Vergleichsstand (etwa im Initiallauf) läuft die Grundprüfung weiter und meldet den übersprungenen Versionsvergleich.

Die synthetischen Regressionen lassen sich ohne Installation ausführen:

```bash
node --test tests/*.test.mjs
```

## Kalenderrechnung und Uhränderungen

Kalenderanteile werden in der gespeicherten Ereigniszeitzone berechnet. Eine
Nulladdition bewahrt den exakten Zeitpunkt auch in einer doppelt vorkommenden
DST-Stunde; Kalenderadditionen in eine Lücke werden weiterhin kompatibel auf
die nächste existierende lokale Uhrzeit verschoben.

Während die App sichtbar ist, prüft ein leichter 30-Sekunden-Takt auf
Mitternacht, Änderungen der Systemzeitzone und relevante Sprünge der
Systemuhr. Betroffene Tagesklassifikationen und Aktualisierungsfristen werden
dann neu aufgebaut. Der Sekundentakt läuft nur, wenn eine sichtbare zeitgenaue
Karte oder Detailansicht Sekunden beziehungsweise einen laufenden Fortschritt
anzeigt.

## Datumssemantik und Grenzen

### Ganztägig oder zeitgenau

Ein Ereignis ohne Uhrzeit ist **ganztägig**: Es speichert nur den Kalendertag
`YYYY-MM-DD` und wird im Kalendertag der betrachtenden Systemzeitzone
eingeordnet. Es hat keine gespeicherte Ereigniszeitzone. Der Datumsrechner
arbeitet ebenfalls nur mit solchen Kalendertagen.

Ein Ereignis mit Uhrzeit ist **zeitgenau**. Es speichert Datum, Uhrzeit,
IANA-Zeitzone und bei einer doppelt vorkommenden Ortszeit die Wahl
`earlier` (erstes Vorkommen) oder `later` (zweites Vorkommen). Die
Ereigniszeitzone wird beim Speichern festgehalten; ein späterer Wechsel der
Systemzeitzone verändert den Zeitpunkt nicht, nur die lokale Anzeige und
Sortierung aus Sicht des Geräts.

In einer DST-Lücke (eine Ortszeit existiert nicht) lässt die Eingabe kein
zeitgenaues Ereignis zu. In einem DST-Fold erscheint die Auswahl für erstes
oder zweites Vorkommen. Beispiel: `2026-10-25 02:30` in
`Europe/Berlin` kommt zweimal vor; ohne abweichende Auswahl wird das erste
Vorkommen verwendet. Eine bestehende zeitgenaue Referenz wird als Beginn des
Referenztags in derselben Ereigniszeitzone aufgelöst und muss vor dem
Zielzeitpunkt liegen.

### Kalenderanteile, Clamping und Reste

Jahre, Monate, Wochen und Tage sind Kalenderoperationen. Beim Übergang in
einen kürzeren Monat wird der Tag auf dessen letzten vorhandenen Tag begrenzt:
`2024-01-31 + 1 Monat = 2024-02-29`,
`2023-01-31 + 1 Monat = 2023-02-28`. Analog wird der 29. Februar beim
Hinzufügen eines Jahres in ein Nichtschaltjahr auf den 28. Februar begrenzt.

Die aktivierten Einheiten werden in der festen Reihenfolge Jahre, Monate,
Wochen, Tage, Stunden, Minuten, Sekunden abgearbeitet. Jede Einheit zählt
ganze Schritte ab dem nach dem vorigen Schritt verbleibenden Zeitpunkt; der
Rest geht an die nächste aktivierte Einheit. Beispiel für reine Kalendertage:
`2023-01-31 → 2023-03-01` mit Monaten und Tagen ergibt
`1 Monat, 1 Tag`; mit nur Tagen ergibt es `29 Tage`. Bei zeitgenauen
Ereignissen werden die Kalenderanteile in der gespeicherten Ereigniszeitzone
gerechnet; erst danach werden Stunden, Minuten und Sekunden als feste
Millisekundenreste ausgegeben. Über eine Sommerzeitumstellung kann ein
Kalendertag deshalb nicht zwangsläufig 24 Stunden entsprechen.

Datumswerte akzeptiert die Anwendungsvalidierung nur als vierstellige Jahre
`0001` bis `9999` mit einem tatsächlich vorhandenen Monatstag und
Uhrzeiten von `00:00` bis `23:59`. Native Datums- und Zeiteingaben sowie
Zeitzonenregeln unterscheiden sich zwischen Browsern; sehr alte oder
ungewöhnliche historische Zeitzonenwechsel sind nicht praktisch
browserübergreifend bestätigt.

### Jährliche Geburtstage und Jahrestage

Im Editor ist „Einzelereignis“ voreingestellt. „Jährlich“ wiederholt ausschließlich
Monat und Tag des gespeicherten Ursprungsdatums, frühestens in dessen Jahr. Das
Ursprungsdatum bleibt beim Jahreswechsel unverändert; ein Alter wird nicht
berechnet. Für einen Geburtstag am 29. Februar deshalb ein tatsächlich gültiges
Ursprungsdatum mit Schaltjahr eingeben.

- **29. Februar:** in Nichtschaltjahren 28. Februar, im nächsten Schaltjahr wieder
  29. Februar. Das passt zum vorhandenen Kalender-Clamping und erhält einen
  Termin in jedem Jahr.
- **Ganztägig:** Kalendertag des betrachtenden Geräts, ohne gespeicherte Zeitzone.
  Am Auftreten bleibt der Zähler den ganzen Tag bei null; erst am nächsten Tag
  zählt er bis zum nächsten Jahr.
- **Mit Uhrzeit:** dieselbe lokale Uhrzeit in der gespeicherten IANA-Zeitzone in
  jedem Jahr. Ein Gerätezeitzonenwechsel verändert den Zeitpunkt nicht. Die
  stets verfügbare Fold-Auswahl gilt auch in späteren Jahren: erstes (`earlier`)
  oder zweites (`later`) Vorkommen. Eine Zeitlücke wird um ihre Dauer vorwärts
  verschoben (Berlin 02:30 → 03:30; Lord Howe 02:15 → 02:45). So bleibt auch in
  einem Umstellungsjahr ein eindeutiger Termin erhalten. Die Detailanzeige nennt
  den tatsächlich aufgelösten Zeitpunkt und die Verschiebung. Einzelereignisse
  weisen Zeitlücken weiterhin ab.
- **Zeitpunkt erreicht:** Am exakten Instant ist der Zähler null; danach folgt
  das nächste Jahr. Liste, Sortierung, Badges und Detail nutzen dasselbe nächste
  Auftreten. Es entstehen keine zusätzlichen gespeicherten Ereignisse und keine
  Historie abgelaufener Wiederholungen.
- **Fortschritt:** automatisch vom vorherigen Jahrestermin bis zum nächsten,
  für Ganztag nach Kalendertagen und mit Uhrzeit nach Instants. Der vorjährige
  Termin ist eine Rechengrenze, auch vor dem Ursprungsjahr. Ein vorhandenes
  manuelles Referenzdatum muss vor der Umstellung ausdrücklich geleert werden;
  es wird nicht still verworfen. Beim Wechsel zurück zum Einzelereignis gilt
  wieder das Ursprungsdatum, das im Editor bei Bedarf angepasst werden kann.
  Im Jahr 0001 ist ohne darstellbares Vorjahr kein Fortschritt verfügbar. Nach
  dem letzten Auftreten im Jahr 9999 bleibt der letzte Termin mit sichtbarem
  Grenzhinweis im Rückblick.

Jahreswechsel, Mitternacht, Uhrsprünge und Sichtbarkeitswechsel verwenden die
bestehenden Aktualisierungspfade. Im sichtbaren Leerlauf beträgt die maximale
Prüfkadenz weiterhin 30 Sekunden; sichtbare zeitgenaue Jahresfortschritte laufen
sekündlich. Synthetische P16-Regressionen: `node --test tests/annual-events.mjs`.

#### Datenformat und ältere Clients

Das einzige neue Ereignisfeld ist `"recurrence": "yearly"`; ohne dieses Feld
bleibt ein Ereignis einmalig. Speicherung und reiner Ereignisexport verwenden
bei mindestens einer Wiederholung die Hülle
`{"schemaVersion":3,"events":[…]}`. Vollbackups mit Wiederholungen tragen
`"format":"tageszaehler-backup","version":2`. Reine Einzelereignisbestände
verwenden weiterhin Arrays und Vollbackup Version 1. Beide Exportwege und der
Ereignisdatei-Ersatz in der Datenrettung erhalten Wiederholungen. Die bestehende
v2-Speicherhülle für alte Einzelereignisse bleibt lesbar.

Alte v2-/P15-Clients lehnen die neuen Hüllen ab, statt das Wiederholungsfeld
beim Normalisieren zu verlieren. Unbekannte Schema-/Backupversionen,
Ereignisfelder und Wiederholungsregeln werden abgewiesen; ein betroffener
gespeicherter Bestand bleibt im Rohformat erhalten und schreibgeschützt.
Versionskennzeichen nicht manuell entfernen oder heruntersetzen. Das
Broadcast-Schreibprotokoll ist Version 3, verwendet aber absichtlich denselben
installationsbezogenen Channel und Web Lock zur Erkennung alter Tabs. Bereits
offene, nicht kooperierende oder stumme Alt-Clients sind weiterhin nicht
vollständig kontrollierbar; alle App-Tabs vor der Umstellung schließen bzw.
aktualisieren. Es gibt keine automatische Downgrade-Konvertierung in
Einzelereignisse. Das 8-MiB-Ereignislimit umfasst auch die neue Hülle; das
Vollbackuplimit bleibt bei 10 MiB.

#### Kalenderexport (ICS)

„Kalender exportieren“ erzeugt lokal im Browser eine UTF-8-kodierte
iCalendar-Datei (`.ics`); gespeicherte Ereignisse und die beiden JSON-Exportwege
bleiben unverändert. Ganztage werden als `VALUE=DATE`, einzelne Uhrzeitereignisse
als eindeutige UTC-Instants und jährliche Uhrzeitereignisse als lokale Serie in
der gespeicherten IANA-Zeitzone ausgegeben. Titel und Beschreibung werden nach
RFC 5545 maskiert, Inhaltszeilen nach höchstens 75 UTF-8-Oktetten gefaltet und
mit CRLF abgeschlossen.

Jährliche Ereignisse beginnen am unveränderten Ursprungsdatum. Für den 29.
Februar bildet `BYMONTHDAY=28,29;BYSETPOS=-1` die P16-Regel ab: in
Nichtschaltjahren gilt der 28. Februar, in Schaltjahren wieder der 29. Februar.
Bei jährlichen Uhrzeiten ergänzen `EXDATE` und UTC-`RDATE` genau die Jahre, in
denen eine DST-Lücke vorwärts verschoben oder die gespeicherte spätere
Fold-Instanz gewählt wird. Dadurch bleibt die unterstützte P16-Semantik bis zur
Datumsgrenze 9999 erhalten; bei sehr vielen solchen Serien kann der Export
entsprechend groß werden und länger dauern.

Die Datei bettet keine vollständigen `VTIMEZONE`-Definitionen bis zum Jahr 9999
ein. Jährliche Uhrzeitserien setzen deshalb voraus, dass das importierende
Kalenderprogramm den angegebenen IANA-`TZID` aus seiner Zeitzonendatenbank
kennt. Ein ICS-Import, Kalenderkonten und Synchronisation gehören nicht zu
dieser Funktion. Praktische Importe in unterschiedliche Kalenderprogramme
sind zusätzlich zur synthetischen Serializer-Prüfung manuell zu kontrollieren.

### Browservoraussetzungen

Getestet wird synthetisch mit aktuellem Node.js in GitHub Actions. Für die
App sind ein sicherer Kontext (HTTPS oder `localhost`), Service Worker,
Cache Storage, `Intl.DateTimeFormat(..., { timeZone })`, moderne
JavaScript-APIs und `localStorage` erforderlich. Ereignisänderungen setzen
zusätzlich Web Locks voraus; ohne diese Unterstützung sperrt die App
Schreibvorgänge. Browser-, Betriebssystem-, Zeitzonen- und
Zeitzonendatenbank-Kombinationen sind nicht als Kompatibilitätsmatrix
praktisch geprüft.

## Schreibsicherheit und mehrere Tabs

Alle Änderungen am Ereignisbestand laufen über denselben exklusiven Web Lock. Innerhalb der Sperre wird der aktuelle `localStorage`-Stand erneut gelesen, der fachliche Konflikt geprüft und erst danach geschrieben. Neue Ereignisse und Änderungen an unterschiedlichen Ereignissen werden dadurch auf dem frischen Gesamtbestand zusammengeführt. Bei Änderungen desselben Ereignisses, Bearbeiten gegen Löschen sowie einem Import oder dem Löschen aktiver Ereignisse gegen eine parallele Änderung wird der Vorgang abgebrochen; ein geöffneter Bearbeitungsentwurf bleibt erhalten.

Fehlt die Web-Locks-Unterstützung, blockiert die App Schreibvorgänge, statt einen unkoordinierten Erfolg zu melden. Tabs mit einer älteren App-Version beachten die Sperre nicht und können daher nicht vollständig geschützt werden. Meldet sich ein solcher Tab über den bestehenden Broadcast-Kanal, sperrt die aktuelle Sitzung weitere Schreibvorgänge bis zum Neuladen. Alte Tabs ohne Broadcast-Unterstützung lassen sich nicht zuverlässig erkennen; vor Änderungen sollten deshalb alle bereits geöffneten Tabs aktualisiert oder geschlossen werden.

Falls Pages für das Repository noch nicht aktiviert ist:

1. In GitHub `Settings` → `Pages` öffnen.
2. Unter `Build and deployment` als Quelle `GitHub Actions` auswählen.
3. Den Workflow `Deploy static PWA to GitHub Pages` erneut ausführen.

## Daten und Datenschutz

Ereignisse und Einstellungen verbleiben im jeweiligen Browserprofil. Das Projekt besitzt kein Backend und überträgt keine Ereignisdaten. Netzwerkzugriffe entstehen nur für externe Bild-URLs, die Nutzer selbst hinterlegen.

Ereignisse, Rettungskopien, Darstellungspräferenzen, Schreibsperre, Broadcast-Kanal und Offline-Shell-Caches verwenden einen stabilen Namensraum aus dem Installationsverzeichnis. Starts über das Verzeichnis und `index.html` sowie Query/Hash führen zum selben Bestand; unterschiedliche Unterpfade derselben Origin bleiben getrennt. Die frühen Theme-Einstellungen lesen ausschließlich die Schlüssel der jeweiligen Installation.

Vor P09 originweit verwendete Ereignisse und Rettungskopien bleiben als unveränderte gemeinsame Rohquellen im Rettungsdialog exportierbar. Ihre Herkunft ist bei mehreren Installationen nicht sicher feststellbar: prüfe sie vor einer ausdrücklich bestätigten Übernahme. Ereignisse werden nur in einen noch unbeschriebenen Installationsbestand und unter der alten sowie der neuen Web-Lock-Sperre mit Quellen-/Zielvergleich und Read-back übernommen. Alte Schlüssel werden nie automatisch gelöscht. Alte Einstellungen können dort separat bestätigt werden; vorhandene Installationswerte werden nicht überschrieben. Ein Speicherfehler bei einer neu gewählten Darstellung lässt die Auswahl sofort sichtbar, meldet aber, dass sie nur in diesem Tab gilt.

Import, lokaler Ereignisbestand und formatierter JSON-Export teilen ein Limit von 8 MiB UTF-8-Daten. Dadurch bleibt jeder regulär speicherbare Bestand auch wieder exportier- und importierbar; nichtlateinische Zeichen und Emoji werden nach ihrer tatsächlichen Bytegröße bewertet.

Bilddateien müssen PNG, JPEG, WebP oder GIF sein und dürfen höchstens 20 MiB, 24 Millionen Pixel und 10.000 Pixel je Achse umfassen. Format, Base64 und verfügbare Headerabmessungen werden vor der Dekodierung geprüft; eingebettete Bilder in JSON-Dateien müssen auch tatsächlich dekodierbar sein. Die Dateigröße eingebetteter Bilder bleibt zudem durch das Ereignislimit begrenzt. Eine vollständige Fehler- oder Speicherprognose vor der Browserdekodierung ist technisch nicht möglich.

Eine externe Bild-URL wird erst nach 400 ms ohne weitere Eingabe als Vorschau geladen, wenn sie vollständig und absolut ist. Für externe Vorschau- und Hintergrundbilder übermittelt die App keinen Referrer; Bilder bleiben bei Offline-Nutzung weiterhin vom externen Anbieter abhängig.

„Vollständiges Backup exportieren“ erzeugt das explizit versionierte JSON-Format
`tageszaehler-backup` Version 1 mit Ereignissen sowie Theme, Akzentfarbe und
Ansicht. Beim Import erkennt die App dieses Format und bisherige reine
Ereignis-Arrays. Unbekannte Backup-Versionen, ungültige Ereignisse oder
Einstellungen mit falschem Typ werden vor dem ersten produktiven Schreibzugriff
abgewiesen. Ereignisdaten bleiben auf 8 MiB UTF-8 begrenzt; die vollständige
Backup-Datei darf einschließlich Format- und Einstellungsdaten 10 MiB umfassen.

Die vollständige Wiederherstellung legt vor Änderungen ein
installationsbezogenes Journal mit dem vorherigen Ereignis- und
Einstellungsstand an und bestätigt jeden Schreibschritt durch erneutes Lesen.
Schlägt ein Schritt fehl, wird der vorherige Stand zurückgeschrieben; ein beim
Neustart gefundenes unvollständiges Journal wird vor der normalen
Initialisierung bereinigt. `localStorage` bietet keine Mehrschlüsseltransaktion:
Bei Quota-, Browser- oder nicht kooperierenden Alttab-Fehlern kann auch die
Rücknahme scheitern. Dieser Zustand wird dauerhaft angezeigt und sperrt weitere
Schreibzugriffe, bis ein späterer Start die Bereinigung bestätigen kann.

Über „Daten & Sicherung“ → „Datenrettung und Rettungskopien“ im Menü oder die dauerhaft sichtbare Fehlermeldung lassen sich der unveränderte aktive Rohbestand und lesbare Quarantänekopien getrennt exportieren. Bei beschädigten oder teilweise ungültigen aktiven Daten bleiben Änderungen gesperrt, bis gültige Ereignisse aus einer ausdrücklich gewählten Quelle oder einer vollständig validierten JSON-Datei nach Bestätigung über den Web-Lock-Schreibpfad übernommen werden. Ungültige Einträge werden dabei nicht still in den neuen aktiven Bestand übernommen; exportiere die Rohdaten vorher. Frühere Rettungskopien bleiben nach erfolgreicher Wiederherstellung erhalten. Dieser Rohdatenrettungsweg bleibt vom Vollbackup getrennt und wird durch dessen Wiederherstellung nicht gelöscht.

„Daten gezielt löschen“ bietet nach einer zweiten Bestätigung drei Varianten: nur aktive Ereignisse, nur die beiden zugehörigen Rettungsschlüssel (Kopien und Metadaten) oder beides in dieser Reihenfolge. Andere Origin-Daten und Einstellungen bleiben unangetastet. Bei fehlendem Web Lock, zwischenzeitlichen Änderungen oder Speicherfehlern wird kein Erfolg behauptet; nach einem Teilerfolg nennt die App verbliebene Kopien. Der unveränderte Rohdatenexport ist weiterhin kein vollständiges Backup der Einstellungen.

## Wartung und Prüfung

Die CI führt für Pull Requests nach `main` die statische PWA-Prüfung und die
synthetischen Regressionen aus. Lokal können dieselben Prüfungen ohne
Paketmanager ausgeführt werden:

```bash
node scripts/check-static-pwa.mjs
node --test tests/check-static-pwa.test.mjs
```

Vor einem Release zusätzlich manuell prüfen: frischen Start mit leerem Cache,
Offline-Neustart nach vollständigem Laden, Update mit geöffnetem Tab,
Datumsgrenzen (Monatsende, Schaltjahr, DST-Lücke und -Fold), Import/Export mit
synthetischen Testdaten sowie die Browserkonsole auf CSP- und
Service-Worker-Fehler. Änderungen an einer Datei der `APP_SHELL` erfordern
weiterhin in derselben Änderung eine erhöhte `CACHE_VERSION`.

## Migration

Die Herkunft, Dateizuordnung, CSP-Anpassung, lokale Schriftdateien,
Rettungsabläufe und Prüfschritte sind in [docs/MIGRATION.md](docs/MIGRATION.md) dokumentiert.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).
