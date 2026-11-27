#!/bin/sh
# Hängt an CSS und JavaScript in index.html und konsole/index.html eine neue
# Versionsnummer (?v=...). Vor jedem Hochladen ausführen, damit Browser und
# GitHub-Zwischenspeicher sofort die neuen Dateien laden statt bis zu 10 Minuten die alten.
cd "$(dirname "$0")/.." || exit 1
v=$(date +%Y%m%d%H%M)
for f in index.html konsole/index.html; do
  sed -i -E "s#((href|src)=\"(\.\./)?[a-z0-9_/-]+\.(css|js))(\?v=[0-9]+)?\"#\1?v=$v\"#g" "$f"
done
echo "Version $v gesetzt"
