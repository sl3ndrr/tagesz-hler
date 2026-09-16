# Strukturelle Migration

## Ausgangsbasis

- Quelle: `index(2)(1)(2)(2).html`
- Größe: 206.447 Byte
- SHA-256: `de65ac5ec4119121692a761d02f5fba53bd53c02f4690aea87115edea9668eb1`
- Ausgangszustand: eine funktionsfähige Single-File-Web-App mit zwei Inline-Skripten und einem Inline-Stylesheet

## Zuordnung

| Ausgangsblock | Zieldatei | Ladeposition |
| --- | --- | --- |
| erstes Inline-Skript | `theme.js` | synchron im `<head>` |
| Inline-Stylesheet | `styles.css` | im `<head>` |
| zweites Inline-Skript | `app.js` | am Ende des `<body>` |
| HTML-Struktur und Metadaten | `index.html` | Dokumentwurzel |

Die Inhalte der JavaScript- und CSS-Blöcke wurden bei der Extraktion nicht fachlich verändert. Insbesondere Datenmodell, `localStorage`-Schlüssel, Import-/Exportlogik, Bildbehandlung, Rendering, Zeitberechnung und Service-Worker-Registrierung bleiben bestehen.

## Laufzeitstand und Wartung

Die Anwendung bleibt eine statische Vanilla-PWA ohne Paketmanager, Build-Schritt
oder Backend. `theme.js` wird früh im `head` geladen, `app.js` am Ende
des `body`. Die App-Shell umfasst HTML, CSS, Skripte, Manifest, Icons und die
lokalen WOFF2-Dateien. Jede Änderung an diesen Dateien verlangt eine erhöhte
`CACHE_VERSION` in `sw.js`; der Pages-Workflow kopiert `icons/` und
`fonts/` in das Artefakt.

### Reproduzierbare Prüfung

Im Repository-Stammverzeichnis:

```bash
node scripts/check-static-pwa.mjs
node --test tests/check-static-pwa.test.mjs
python3 -m http.server 8080
```

Danach `http://localhost:8080/` mit einem aktuellen Browser öffnen. Vor
einem Merge ergänzend den Service-Worker-Cache, Offline-Neustart, die
CSP-Konsole und synthetische Import-/Rettungsdaten prüfen. Browserprüfungen
sind manuell und nicht durch die Node-Regressionen ersetzt.

## CSP-Anpassung

Die drei SHA-256-Freigaben der ehemaligen Inline-Blöcke wurden entfernt. `script-src 'self'` und `style-src-elem 'self'` erlauben die gleichursprünglichen externen Dateien. Roboto Flex wird ausschließlich aus lokalen relativen WOFF2-Dateien geladen; externe Google-Fonts-Hosts sind nicht freigegeben. `script-src-attr 'none'`, Trusted-Types-Vorgaben und die übrigen restriktiven Direktiven bleiben erhalten. `style-src-attr 'unsafe-inline'` bleibt erforderlich, weil die vorhandene UI dynamisch einzelne Style-Eigenschaften setzt.

## Freigegebener PWA-Kompatibilitätsfix

Der erste Live-Test zeigte, dass die bereits in der Ausgangsdatei kombinierte Policy `require-trusted-types-for 'script'; trusted-types 'none'` in Chromium die Übergabe des String-Pfads an `navigator.serviceWorker.register()` blockiert. Nach ausdrücklicher Freigabe wurde deshalb die einzelne Policy `tageszaehler-sw` zugelassen. Sie akzeptiert ausschließlich den fest codierten Pfad `./sw.js` und erzeugt dafür eine `TrustedScriptURL`. Die Trusted-Types-Erzwingung bleibt aktiv; die Änderung stellt die vorgesehene Service-Worker- und Offline-Funktion her. Gleichzeitig wurde die Cache-Version auf `v2` erhöht.

## Lokale Schriftarten und Offline-Paket

Roboto Flex liegt als Latin- und Latin-Extended-WOFF2-Teilmenge in `fonts/`.
Lizenz und Herkunft stehen in `fonts/RobotoFlex-OFL.txt` und
`fonts/RobotoFlex-SOURCE.md`. Beide Dateien sind in `APP_SHELL` und im
Pages-Artefakt enthalten. Neue Schriften brauchen lokale, relative URLs,
Lizenz/Herkunft, einen App-Shell-Eintrag und den Versionsabgleich.

## Datenmigration und Rettung

Bestehende Ereignisse bleiben lokale Browserdaten. Import, aktiver Bestand und
formatierter Export sind auf 8 MiB UTF-8 begrenzt. Bei beschädigten oder
teilweise ungültigen Daten zuerst den unveränderten Rohbestand exportieren;
danach im Rettungsdialog eine validierte Quelle ausdrücklich auswählen und die
Wiederherstellung bestätigen. Ungültige Einträge werden nicht still in den
aktiven Bestand übernommen. Rettungskopien werden nach erfolgreicher
Wiederherstellung nicht automatisch gelöscht; der Rohdatenexport enthält keine
vollständigen Einstellungen. Alte installationsweite Daten werden nur nach
expliziter Auswahl übernommen und nie automatisch gelöscht.

## Ergänzte PWA-Dateien

Das Repository war vor der Migration leer. Deshalb wurden die bereits referenzierten Dateien `manifest.webmanifest`, `sw.js` und die Icon-Sätze neu angelegt. Alle Pfade sind relativ und damit sowohl lokal als auch unter `/tagesz-hler/` auf GitHub Pages verwendbar.

## Bewusste Abgrenzung

- kein Build-Tool und keine `package.json`
- keine fachliche Aufteilung von `app.js` in ES-Module
- keine Änderung der gespeicherten Daten oder ihres Schemas
- keine neue Telemetrie, Cloud-Synchronisierung oder Backend-Komponente
- keine Android-/TWA-Projektdateien in Ziel 1

## Verifikation

- JavaScript-Syntaxprüfung für `theme.js`, `app.js` und `sw.js`
- JSON-Validierung des Web-App-Manifests
- Prüfung auf verbliebene Inline-Skript- und Inline-Stylesheet-Blöcke
- Vergleich der extrahierten CSS-/JavaScript-Inhalte mit den Ausgangsblöcken
- Prüfung aller lokalen HTML-, Manifest- und Service-Worker-Referenzen
- HTTP-Smoke-Test und Offline-Cache-Test
- Prüfung der generierten PNG-Abmessungen

Die Ergebnisse dieser Prüfungen werden vor dem Upload kontrolliert; der Commit-Verlauf trennt Migration, PWA-Ergänzungen, Dokumentation und Deployment-Konfiguration.
