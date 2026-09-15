# Tageszähler & Rechner

Eine deutschsprachige, installierbare Progressive Web App zum Verwalten kommender und vergangener Ereignisse sowie zum kalendergenauen Berechnen von Zeitabständen.

Nach Aktivierung von GitHub Pages ist die Web-App unter <https://sl3ndrr.github.io/tagesz-hler/> erreichbar.

## Funktionen

- sekundengenaue Zähler für zukünftige und vergangene Ereignisse
- Datumsrechner mit Jahren, Monaten, Wochen, Tagen, Stunden, Minuten und Sekunden
- optionale Beschreibungen und Hintergrundbilder
- Karten- und Kompaktansicht sowie System-, Hell- und Dunkelmodus
- ausschließlich lokale Datenhaltung im Browser über `localStorage`
- JSON-Import und -Export mit Validierung und Größenlimits
- installierbare PWA mit Offline-App-Shell
- strikte Content-Security-Policy ohne Inline-JavaScript

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

Die CSP steht als Meta-Policy in `index.html`. Ausführbarer Code und Stylesheets liegen in externen, gleichursprünglichen Dateien; daher sind keine SHA-256-Hashes für Inline-Blöcke mehr nötig. Inline-Event-Handler bleiben durch `script-src-attr 'none'` gesperrt. Google Fonts sind ausschließlich über `fonts.googleapis.com` und `fonts.gstatic.com` freigegeben. Vom Nutzer hinterlegte HTTPS-Bilder bleiben über `img-src` zulässig.

Trusted Types bleiben für Script-Sinks erzwungen. Ausschließlich die benannte Policy `tageszaehler-sw` ist zugelassen; sie erzeugt nur für den fest codierten Pfad `./sw.js` eine `TrustedScriptURL`. Dadurch kann der Service Worker registriert werden, ohne die Trusted-Types-Erzwingung aufzugeben.

Bei Änderungen keine Inline-Skripte oder Inline-Stylesheet-Blöcke hinzufügen. Die dynamisch gesetzten Style-Attribute der bestehenden UI benötigen weiterhin `style-src-attr 'unsafe-inline'`.

## PWA und Offline-Cache

`manifest.webmanifest` enthält relative `start_url`- und `scope`-Werte, damit die App auch unter dem GitHub-Pages-Unterpfad funktioniert. `sw.js` speichert die vollständige lokale App-Shell in einem Cache pro Worker-Version. Ein kontrollierter Tab erhält Navigation, JavaScript und CSS ausschließlich aus diesem aktiven Versionscache; dadurch kann ein bereitstehendes Update keine Shell-Versionen mischen. Navigationen verwenden die gespeicherte Shell auch bei HTTP-Fehlern, Netzabbruch oder langsamem Netz ohne darauf zu warten.

Ein neuer Worker überspringt die Wartephase nicht. Er wird erst aktiv, wenn keine Tabs der bisherigen Version mehr geöffnet sind. Die App meldet ein bereitstehendes Update zugänglich über die vorhandene Statusmeldung. Falls eine Aktivierung außerhalb dieses Ablaufs erzwungen wird, lädt die App nicht automatisch neu und lässt offene Eingaben bestehen. Sonstige gleichursprüngliche GET-Anfragen werden ohne Runtime-Cache direkt aus dem Netz geladen; fehlgeschlagene oder unvollständige Precache-Installationen werden verworfen. Bei Änderungen an ausgelieferten statischen Dateien muss `CACHE_VERSION` in `sw.js` erhöht werden.

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

## Schreibsicherheit und mehrere Tabs

Alle Änderungen am Ereignisbestand laufen über denselben exklusiven Web Lock. Innerhalb der Sperre wird der aktuelle `localStorage`-Stand erneut gelesen, der fachliche Konflikt geprüft und erst danach geschrieben. Neue Ereignisse und Änderungen an unterschiedlichen Ereignissen werden dadurch auf dem frischen Gesamtbestand zusammengeführt. Bei Änderungen desselben Ereignisses, Bearbeiten gegen Löschen sowie einem Import oder dem Löschen aktiver Ereignisse gegen eine parallele Änderung wird der Vorgang abgebrochen; ein geöffneter Bearbeitungsentwurf bleibt erhalten.

Fehlt die Web-Locks-Unterstützung, blockiert die App Schreibvorgänge, statt einen unkoordinierten Erfolg zu melden. Tabs mit einer älteren App-Version beachten die Sperre nicht und können daher nicht vollständig geschützt werden. Meldet sich ein solcher Tab über den bestehenden Broadcast-Kanal, sperrt die aktuelle Sitzung weitere Schreibvorgänge bis zum Neuladen. Alte Tabs ohne Broadcast-Unterstützung lassen sich nicht zuverlässig erkennen; vor Änderungen sollten deshalb alle bereits geöffneten Tabs aktualisiert oder geschlossen werden.

Falls Pages für das Repository noch nicht aktiviert ist:

1. In GitHub `Settings` → `Pages` öffnen.
2. Unter `Build and deployment` als Quelle `GitHub Actions` auswählen.
3. Den Workflow `Deploy static PWA to GitHub Pages` erneut ausführen.

## Daten und Datenschutz

Ereignisse und Einstellungen verbleiben im jeweiligen Browserprofil. Das Projekt besitzt kein Backend und überträgt keine Ereignisdaten. Netzwerkzugriffe entstehen für Google Fonts sowie für externe Bild-URLs, die Nutzer selbst hinterlegen.

Import, lokaler Ereignisbestand und formatierter JSON-Export teilen ein Limit von 8 MiB UTF-8-Daten. Dadurch bleibt jeder regulär speicherbare Bestand auch wieder exportier- und importierbar; nichtlateinische Zeichen und Emoji werden nach ihrer tatsächlichen Bytegröße bewertet.

Bilddateien müssen PNG, JPEG, WebP oder GIF sein und dürfen höchstens 20 MiB, 24 Millionen Pixel und 10.000 Pixel je Achse umfassen. Format, Base64 und verfügbare Headerabmessungen werden vor der Dekodierung geprüft; eingebettete Bilder in JSON-Dateien müssen auch tatsächlich dekodierbar sein. Die Dateigröße eingebetteter Bilder bleibt zudem durch das Ereignislimit begrenzt. Eine vollständige Fehler- oder Speicherprognose vor der Browserdekodierung ist technisch nicht möglich.

Eine externe Bild-URL wird erst nach 400 ms ohne weitere Eingabe als Vorschau geladen, wenn sie vollständig und absolut ist. Für externe Vorschau- und Hintergrundbilder übermittelt die App keinen Referrer; Bilder bleiben bei Offline-Nutzung weiterhin vom externen Anbieter abhängig.

Über „Datenrettung und Rettungskopien“ im Menü oder die dauerhaft sichtbare Fehlermeldung lassen sich der unveränderte aktive Rohbestand und lesbare Quarantänekopien getrennt exportieren. Bei beschädigten oder teilweise ungültigen aktiven Daten bleiben Änderungen gesperrt, bis gültige Ereignisse aus einer ausdrücklich gewählten Quelle oder einer vollständig validierten JSON-Datei nach Bestätigung über den Web-Lock-Schreibpfad übernommen werden. Ungültige Einträge werden dabei nicht still in den neuen aktiven Bestand übernommen; exportiere die Rohdaten vorher. Frühere Rettungskopien bleiben nach erfolgreicher Wiederherstellung erhalten.

„Daten gezielt löschen“ bietet nach einer zweiten Bestätigung drei Varianten: nur aktive Ereignisse, nur die beiden zugehörigen Rettungsschlüssel (Kopien und Metadaten) oder beides in dieser Reihenfolge. Andere Origin-Daten und Einstellungen bleiben unangetastet. Bei fehlendem Web Lock, zwischenzeitlichen Änderungen oder Speicherfehlern wird kein Erfolg behauptet; nach einem Teilerfolg nennt die App verbliebene Kopien. Der Rohdatenexport ist kein vollständiges Backup der Einstellungen.

## Migration

Die Herkunft, Dateizuordnung, CSP-Anpassung und Prüfschritte sind in [docs/MIGRATION.md](docs/MIGRATION.md) dokumentiert.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).
