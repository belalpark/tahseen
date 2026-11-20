#!/usr/bin/env bash
# Builds the generated assets: Quran text (verified), fonts from their npm packages, and app icons.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cd "$TMP"
npm pack --silent @quran.ws/text@0.1.0 quran-json@3.1.2 quran@0.0.9 @fontsource/amiri@5.3.0 @fontsource/aref-ruqaa@5.3.0 >/dev/null
for t in *.tgz; do mkdir -p "${t%.tgz}"; tar -xzf "$t" -C "${t%.tgz}"; done
mkdir -p "$ROOT/fonts" "$ROOT/icons" "$ROOT/data"
# Quran text: KFGQPC Hafs v3.0, then cross-check against QuranEnc and Tanzil
node "$ROOT/tools/extract.mjs" quran.ws-text-0.1.0/package "$TMP/sel_hafs.json"
python3 "$ROOT/tools/verify.py" "$TMP/sel_hafs.json" quran-json-3.1.2/package/dist/quran.json quran-0.0.9/package/data/qurandb
python3 "$ROOT/tools/build_data.py" "$TMP/sel_hafs.json" "$ROOT/data/ruqyah.json"
# Quran font (King Fahd Complex) — copied unmodified, checksum verified
cp quran.ws-text-0.1.0/package/data/UthmanicHafs-v-3.0.ttf "$ROOT/fonts/"
echo "5c47602425fb4190327ab9e1a2e8ed2f53dceaf595d8ccc29ac32b8b209ad398  $ROOT/fonts/UthmanicHafs-v-3.0.ttf" | sha256sum -c -
A=fontsource-amiri-5.3.0/package; R=fontsource-aref-ruqaa-5.3.0/package
cp $A/files/amiri-arabic-700-normal.woff2 "$ROOT/fonts/amiri-700.woff2"
cp $A/files/amiri-latin-700-normal.woff2 "$ROOT/fonts/amiri-latin-700.woff2"
cp $R/files/aref-ruqaa-arabic-700-normal.woff2 "$ROOT/fonts/ruqaa-700.woff2"
cp $R/files/aref-ruqaa-latin-700-normal.woff2 "$ROOT/fonts/ruqaa-latin-700.woff2"
cp $A/LICENSE "$ROOT/fonts/OFL-Amiri.txt"; cp $R/LICENSE "$ROOT/fonts/OFL-ArefRuqaa.txt"
# Icons
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser)}"
OPTS=(--headless=new --disable-gpu --no-sandbox --hide-scrollbars --force-device-scale-factor=2 --window-size=512,512 --virtual-time-budget=4000 --allow-file-access-from-files)
"$CHROME" "${OPTS[@]}" --screenshot="$TMP/icon.png" "file://$ROOT/tools/logo.html" 2>/dev/null
"$CHROME" "${OPTS[@]}" --default-background-color=00000000 --screenshot="$TMP/mark.png" "file://$ROOT/tools/logo.html#mark" 2>/dev/null
python3 - "$TMP" "$ROOT/icons" <<'PY'
import sys
from PIL import Image
t, o = sys.argv[1], sys.argv[2]
im = Image.open(t + '/icon.png').convert('RGB')
assert im.size[0] >= 1000, im.size
for s, n in [(512,'icon-512.png'),(192,'icon-192.png'),(180,'apple-touch-icon.png'),(64,'favicon-64.png'),(32,'favicon-32.png')]:
    im.resize((s, s), Image.LANCZOS).save(f'{o}/{n}')
mk = Image.open(t + '/mark.png').convert('RGBA')
assert mk.getpixel((5, 5))[3] == 0, 'mark background not transparent'
mk.resize((320, 320), Image.LANCZOS).save(f'{o}/logo-mark.png')
PY
rm -rf "$TMP"
echo "assets built"
