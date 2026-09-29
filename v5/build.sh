#!/bin/sh
# 把 src/ 組成單一 HTML。
#   v5/build.sh            → v5/index.html（完整網頁，可直接用瀏覽器開）
#   v5/build.sh fragment   → 印到標準輸出，沒有 doctype/html/body 外殼（發布成 Artifact 用）
#   THREE_SRC=路徑         → 換掉 Three.js 的來源（本機測試用）
set -e
cd "$(dirname "$0")/src"
THREE_SRC="${THREE_SRC:-https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js}"
body() {
  cat head.html
  echo "<script src=\"$THREE_SRC\"></script>"
  echo '<script>'
  for f in data.js fusion.js world.js ui.js sheets.js; do cat "$f"; echo; done
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
