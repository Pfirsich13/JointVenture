#!/bin/sh
# Hängt an CSS und JavaScript in index.html eine neue Versionsnummer (?v=...).
# Vor jedem Hochladen ausführen, damit Browser und GitHub-Zwischenspeicher
# sofort die neuen Dateien laden statt bis zu 10 Minuten die alten.
cd "$(dirname "$0")/.." || exit 1
v=$(date +%Y%m%d%H%M)
sed -i -E "s#(href=\"css/[a-z0-9_-]+\.css)(\?v=[0-9]+)?\"#\1?v=$v\"#g; s#(src=\"js/[a-z0-9_/-]+\.js)(\?v=[0-9]+)?\"#\1?v=$v\"#g" index.html
echo "Version $v gesetzt"
