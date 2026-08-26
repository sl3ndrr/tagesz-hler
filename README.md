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

`manifest.webmanifest` enthält relative `start_url`- und `scope`-Werte, damit die App auch unter dem GitHub-Pages-Unterpfad funktioniert. `sw.js` speichert die lokale App-Shell vorab. Bei Änderungen an ausgelieferten statischen Dateien muss `CACHE_VERSION` in `sw.js` erhöht werden.

## GitHub Pages

Jeder Push auf `main` startet `.github/workflows/deploy-pages.yml`. Der Workflow paketiert nur die statischen Laufzeitdateien; ein Build findet nicht statt.

Falls Pages für das Repository noch nicht aktiviert ist:

1. In GitHub `Settings` → `Pages` öffnen.
2. Unter `Build and deployment` als Quelle `GitHub Actions` auswählen.
3. Den Workflow `Deploy static PWA to GitHub Pages` erneut ausführen.

## Daten und Datenschutz

Ereignisse und Einstellungen verbleiben im jeweiligen Browserprofil. Das Projekt besitzt kein Backend und überträgt keine Ereignisdaten. Netzwerkzugriffe entstehen für Google Fonts sowie für externe Bild-URLs, die Nutzer selbst hinterlegen.

## Migration

Die Herkunft, Dateizuordnung, CSP-Anpassung und Prüfschritte sind in [docs/MIGRATION.md](docs/MIGRATION.md) dokumentiert.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).
