# v6 測試

- `node v6/tests/core.test.js`：平台核心規則（每天的點與歸零、生命週期與作廢、提早結束、條件判定、查詢、預約名額、對接寫帳、兌現與兌現失敗自動空窗、純資料檢查）。
- `node v6/tests/t_nothree.js <test6_nothree.html>`：擋掉 Three.js（用 `NO_THREE=1 v6/build.sh fragment` 組的頁面，外部請求也全擋）時，提示正常、分頁列和表世界照常能用。
- `node v6/tests/t_v6.js <test6.html>`：瀏覽器整段（走代號傳送、看規則建築、接受村規、預約、那一微秒對接、兌現、兌現失敗與空窗、查詢、開時段、建角色草稿到創角色、結束並重創、下一步、世界頁、存檔）。

Three.js r128 已經打包在 `v6/src/vendor/three.min.js`（MIT），組出來的頁面不連 CDN：

```sh
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; v6/build.sh fragment; echo '</body></html>'; } > test6.html
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; NO_THREE=1 v6/build.sh fragment; echo '</body></html>'; } > test6_nothree.html
node v6/tests/t_v6.js test6.html shots
node v6/tests/t_nothree.js test6_nothree.html
```
