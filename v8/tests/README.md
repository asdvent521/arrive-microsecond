# v8 測試

一次跑一個檔（同時開好幾個 3D 會逾時）。所有按鈕都用手指按：先確認 `elementFromPoint` 打到的就是那個按鈕，再點那個座標（`lib.js`）。

- `node v8/tests/core.test.js`：規則層（照新規則重寫）：預設 2000、一人一角色、每天一版（明天起、今天不變、版本留著、對接紀錄記版本）、改價錢隔天生效且已保留的照舊、可換隨時加減不能小於 0、已保留不能減、沒貨給不出點、收的點等於選的價錢、超過上限或當天剩的點那個方向不成立、沒選只給不收、三個人兩兩成交、沒到場錯過、站在終點上算到場、判定窗過了算錯過、一方通與兩個開關、保留與兌現、到期作廢貨回可換、沒寫保留天數不到期、改版下架不影響已保留、沒有轉手的路、不玩了、新的條件欄位、換點比例、純資料檢查。
- `node v8/tests/t_parity.js <test8.html>`：DESIGN.md 7-3（v8）每一列，裡世界做一次、表世界做一次，state 一樣。
- `node v8/tests/t_game.js <test8.html> [截圖資料夾]`：裡世界。角色碑的新選項；預約後選要換主人的什麼；交換對話框列出我要他的、他要我的、每人最多給；那一微秒照選好的成交、能量條下降、貨當場留起來；沒到場錯過；其他沿用 v7。
- `node v8/tests/t_sheet.js <test8.html> [截圖資料夾]`：表世界。「我預約的」選東西、最多給、勾到場對接；點數表多一筆保留；其他沿用 v7。
- `node v8/tests/t_switch.js <test8.html>`：切換（沿用 v7）。
- `node v8/tests/t_nothree.js <test8_nothree.html>`：擋掉 Three.js 時表世界完整可用（含選東西、到場對接）。
- `node v8/tests/t_arrive.js <test8.html>`：走代號手感（沿用 v7）；市集「補貨、減貨」開著，表世界補 1 份 → 切回寫「可換 2」→ 再補 1 份 → 切回寫「可換 3」。
- `node v8/tests/t_multi.js <test8.html>`：多人。J1 開時段，J2、J3 預約並到場（換人在表世界勾），各自選要換誰的什麼，那一微秒 J1↔J2、J1↔J3、J2↔J3 照選好的成交。

```sh
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; v8/build.sh fragment; echo '</body></html>'; } > test8.html
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; NO_THREE=1 v8/build.sh fragment; echo '</body></html>'; } > test8_nothree.html
node v8/tests/core.test.js
node v8/tests/t_parity.js test8.html
node v8/tests/t_game.js test8.html shots
node v8/tests/t_sheet.js test8.html shots
node v8/tests/t_switch.js test8.html
node v8/tests/t_nothree.js test8_nothree.html
node v8/tests/t_arrive.js test8.html
node v8/tests/t_multi.js test8.html
```
