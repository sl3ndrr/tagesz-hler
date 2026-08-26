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

## CSP-Anpassung

Die drei SHA-256-Freigaben der ehemaligen Inline-Blöcke wurden entfernt. `script-src 'self'` und `style-src-elem 'self' https://fonts.googleapis.com` erlauben die neuen externen Dateien. `script-src-attr 'none'`, Trusted-Types-Vorgaben und die übrigen restriktiven Direktiven bleiben erhalten. `style-src-attr 'unsafe-inline'` bleibt erforderlich, weil die vorhandene UI dynamisch einzelne Style-Eigenschaften setzt.

## Freigegebener PWA-Kompatibilitätsfix

Der erste Live-Test zeigte, dass die bereits in der Ausgangsdatei kombinierte Policy `require-trusted-types-for 'script'; trusted-types 'none'` in Chromium die Übergabe des String-Pfads an `navigator.serviceWorker.register()` blockiert. Nach ausdrücklicher Freigabe wurde deshalb die einzelne Policy `tageszaehler-sw` zugelassen. Sie akzeptiert ausschließlich den fest codierten Pfad `./sw.js` und erzeugt dafür eine `TrustedScriptURL`. Die Trusted-Types-Erzwingung bleibt aktiv; die Änderung stellt die vorgesehene Service-Worker- und Offline-Funktion her. Gleichzeitig wurde die Cache-Version auf `v2` erhöht.

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
