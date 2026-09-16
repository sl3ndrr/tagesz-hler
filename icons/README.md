# App-Icons

Die SVG-Dateien sind die editierbaren Quellen. Die PNG-Dateien werden daraus ohne externe Design-Abhängigkeit erzeugt.

- `icon-source.svg`: reguläres Icon mit abgerundeter Grundfläche
- `icon-maskable-source.svg`: vollflächige Variante mit Inhalt innerhalb der Maskable-Safe-Zone
- `icon-192.png` und `icon-512.png`: reguläre PWA-Icons
- `icon-maskable-192.png` und `icon-maskable-512.png`: Android-/Maskable-Icons
- `apple-touch-icon-180.png`: iOS-Home-Screen-Icon
- `favicon-32.png`: Browser-Favicon

Bei einer späteren Markenänderung zuerst die SVG-Quellen bearbeiten und danach alle PNG-Größen neu exportieren.


## PNGs reproduzierbar erzeugen

Die folgenden optionalen Befehle werden im Repository-Stammverzeichnis mit
[Inkscape](https://inkscape.org/) ab Version 1.0 ausgeführt. Sie erzeugen nur
die vorhandenen PNG-Ziele aus den vorhandenen SVG-Quellen; eine
Markenänderung ist damit nicht verbunden.

```bash
inkscape icons/icon-source.svg --export-type=png --export-filename=icons/icon-192.png -w 192 -h 192
inkscape icons/icon-source.svg --export-type=png --export-filename=icons/icon-512.png -w 512 -h 512
inkscape icons/icon-maskable-source.svg --export-type=png --export-filename=icons/icon-maskable-192.png -w 192 -h 192
inkscape icons/icon-maskable-source.svg --export-type=png --export-filename=icons/icon-maskable-512.png -w 512 -h 512
inkscape icons/icon-source.svg --export-type=png --export-filename=icons/apple-touch-icon-180.png -w 180 -h 180
inkscape icons/icon-source.svg --export-type=png --export-filename=icons/favicon-32.png -w 32 -h 32
```

Danach `node scripts/check-static-pwa.mjs` ausführen und die PNG-Abmessungen
sowie transparente Ränder manuell prüfen. Inkscape und die grafische Prüfung
sind in CI nicht installiert beziehungsweise nicht automatisiert.
