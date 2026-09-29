#!/bin/sh
# 把 src/ 的各段組成單一 HTML：v4/app.html
set -e
cd "$(dirname "$0")/src"
{ cat head.html; for f in core.js seed.js ui_base.js ui_sheets.js ui_views.js ui_special.js paper.js ui_main.js; do cat $f; echo; done; echo '</script>'; echo '</body></html>'; } > ../app.html
echo built $(wc -c < ../app.html) bytes
