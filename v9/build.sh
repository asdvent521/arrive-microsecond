#!/bin/sh
# 把 src/ 組成單一 HTML。
#   v9/build.sh            → v9/index.html（完整網頁，可直接用瀏覽器開）
#   v9/build.sh fragment   → 印到標準輸出，沒有 doctype/html/body 外殼（發布成 Artifact 用）
# 第 1 輪只有表格世界，不打包 Three.js；world.js 和 vendor/three.min.js 留著，第 2 輪改成畫達秒屋。
set -e
cd "$(dirname "$0")/src"
body() {
  cat head.html
  echo '<script>'
  for f in core.js app.js table.js; do cat "$f"; echo; done
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
