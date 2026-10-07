# v7 測試

- `node v7/tests/core.test.js`：規則層（沿用 v6，全部要過；v7 只在 core.js 後面加了到場與判定）。
- `node v7/tests/t_parity.js <test7.html>`：**對照測試**。DESIGN.md 7-3 的每一列，在裡世界做一次、在表世界做一次，兩邊的結果（state）要一樣。
- `node v7/tests/t_game.js <test7.html> [截圖資料夾]`：裡世界。沒有表格元素；對話框貼底、不超過畫面 40%；地圖亮暗；指引光點走完一段熄一段；建造模式改外觀、搬移後走法照樣走得出 J2；那一微秒的倒數、交換滑桿、對接、能量條下降；沒站在終點上就錯過。
- `node v7/tests/t_sheet.js <test7.html> [截圖資料夾]`：表世界。20 張工作表每張只有一張表、沒有 3D；連結跳轉與 ← 返回；最下面一列新增；「到場」對接成功與錯過。
- `node v7/tests/t_switch.js <test7.html>`：切換。裡世界站在 J2 規則屋 → 表世界是 J2 的規則用途；表世界看 J3 的資源 → 裡世界走到 J3 的市集旁；地圖點 J3 亮出指引；兩邊共用同一份狀態。
- `node v7/tests/t_nothree.js <test7_nothree.html>`：擋掉 Three.js 時表世界完整可用（含預約、到場對接），裡世界顯示「3D 引擎沒載入」。

`lib.js` 是這些測試共用的小工具（開頁、走到建築旁、按對話框選項、改格子）。測試用 Playwright（Chromium）。

```sh
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; v7/build.sh fragment; echo '</body></html>'; } > test7.html
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; NO_THREE=1 v7/build.sh fragment; echo '</body></html>'; } > test7_nothree.html
node v7/tests/core.test.js
node v7/tests/t_parity.js test7.html
node v7/tests/t_game.js test7.html shots
node v7/tests/t_sheet.js test7.html shots
node v7/tests/t_switch.js test7.html
node v7/tests/t_nothree.js test7_nothree.html
```
