# v6 測試

- `node v6/tests/core.test.js`：平台核心規則（每天的點與歸零、生命週期與作廢、提早結束、條件判定、查詢、預約名額、對接寫帳、兌現與兌現失敗自動空窗、純資料檢查）。
- `node v6/tests/t_v6.js <test6.html>`：瀏覽器整段（走代號傳送、看規則建築、接受村規、預約、那一微秒對接、兌現、兌現失敗與空窗、查詢、開時段、建角色草稿到創角色、結束並重創、下一步、世界頁、存檔）。

`test6.html` 用本機的 Three.js 組（作法同 `v5/tests/README.md`）：

```sh
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; THREE_SRC=three.global.js v6/build.sh fragment; echo '</body></html>'; } > test6.html
node v6/tests/t_v6.js test6.html shots
```
