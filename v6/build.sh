#!/bin/sh
# 把 src/ 組成單一 HTML。
#   v5/build.sh            → v5/index.html（完整網頁，可直接用瀏覽器開）
#   v5/build.sh fragment   → 印到標準輸出，沒有 doctype/html/body 外殼（發布成 Artifact 用）
#   NO_THREE=1             → 不打包 Three.js（測「引擎沒載入」用）
# Three.js r128 直接打包進去（vendor/three.min.js，MIT），不依賴 CDN。
set -e
cd "$(dirname "$0")/src"
body() {
  cat head.html
  if [ -z "$NO_THREE" ]; then echo '<script>'; cat vendor/three.min.js; echo; echo '</script>'; fi
  echo '<script>'
  for f in core.js world.js ui.js sheets.js; do cat "$f"; echo; done
  echo '</script>'
}
if [ "$1" = "fragment" ]; then
  body
else
  {
    echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>'
    body
    echo '</body></html>'
  } > ../index.html
  echo "built ../index.html $(wc -c < ../index.html) bytes"
fi
