# v8 測試

一次跑一個檔（同時開好幾個 3D 會逾時）。所有按鈕都用手指按：先確認 `elementFromPoint` 打到的就是那個按鈕，再點那個座標（`lib.js`）。

- `node v8/tests/core.test.js`：規則層（含新手教學：示範版沒有「我」、引路人、創角色當下生效、預設走法走得出 J4、教學的對接不算數）（照新規則重寫）：預設 2000、一人一角色、每天一版（明天起、今天不變、版本留著、對接紀錄記版本）、改價錢隔天生效且已保留的照舊、可換隨時加減不能小於 0、已保留不能減、沒貨給不出點、收的點等於選的價錢、超過上限或當天剩的點那個方向不成立、沒選只給不收、三個人兩兩成交、沒到場錯過、站在終點上算到場、判定窗過了算錯過、一方通與兩個開關、保留與兌現、到期作廢貨回可換、沒寫保留天數不到期、改版下架不影響已保留、沒有轉手的路、不玩了、新的條件欄位、換點比例、純資料檢查；選的東西有一部分那天已經下架時下架的不算、剩下的照成交且紀錄寫沒換到、全部下架 0 點、下架後還能改選、一對出錯不影響其他對；「對方可換的貨」只算當天版本裡有的；一換一：價格 0 可以上架、保留、兌現、到期且不扣點；只有一邊選不成交；任一邊上限、點或貨不夠整對不成交且貨都不動；只給不收（試用品 ↔ 空物件）成交；部分下架剩下的照算、全部下架一換一不成交；三人時段只成交兩邊都選的那幾對；補貨一次加很多份；改規則不溯及既往 (a)～(e)：預約後改開關或條件照預約時判、預約後才要求接受村規照樣成立、接受村規記版本換日後要重新接受、事實照那一微秒、兩個預約的人之間照比較晚預約的那一刻。
- `node v8/tests/t_parity.js <test8.html>`：DESIGN.md 7-3（v8）每一列，裡世界做一次、表世界做一次，state 一樣；含「新手教學」一列（兩邊各從創角色走完整套、選「不要」看完對照）。
- `node v8/tests/t_game.js <test8.html> [截圖資料夾]`：裡世界。角色碑的新選項；預約後選要換主人的什麼；交換對話框列出我要他的、他要我的、每人最多給；時刻表開著不關，倒數到 60 秒內交換對話框蓋過它升起；那一微秒照選好的成交、能量條下降、貨當場留起來；選的東西有一部分下架時交換對話框有小字、結果對話框寫沒換到；沒到場錯過；其他沿用 v7。
- `node v8/tests/t_sheet.js <test8.html> [截圖資料夾]`：表世界。「我預約的」選東西、最多給、勾到場對接；點數表多一筆保留；改早餐價格後換人去看，表世界資源表和裡世界商店都標「明天起 120 點」；選的東西有一部分下架時「我要的」「他要我的」有小字、那一微秒剩下的照成交；村規改了以後規則屋第 3 頁和表世界都寫「要重新接受」、按了接受就好；一換一：兩邊都還沒選看得到提醒、換人成主人去選、成交訊息以東西為主；建 0 點空物件並一次補 500 份、選阿澄的試聽換人成阿澄選我的空物件那一微秒成交、帳房多一筆 0 點的試聽；沒建空物件或可換 0 份時待辦有提醒；只有一邊選看得到提醒且不成交；其他沿用 v7。
- `node v8/tests/t_switch.js <test8.html>`：切換（沿用 v7）。
- `node v8/tests/t_nothree.js <test8_nothree.html>`：擋掉 Three.js 時表世界完整可用（含選東西、到場對接）；新手教學也能在表世界走完，「不要」的對照在沒有 3D 的裡世界只用對話框帶看。
- `node v8/tests/t_arrive.js <test8.html>`：走代號手感（沿用 v7）；市集「補貨、減貨」開著，表世界補 1 份 → 切回寫「可換 2」→ 再補 1 份 → 切回寫「可換 3」。
- `node v8/tests/t_tutorial.js <test8.html>`：新手教學（7-4）。示範版沒有「我」；裡世界從創角色走完整套（找引路人、預約選他的空的、站上終點台那一微秒、帳房、兌現）→ 問 → 不要 → 表世界帶看對照 → 切回；表世界走完整套 → 要 → 裡世界從「補 1 份空的」再走一次、走完就結束；裡世界做到找到引路人就切到表世界，從第 ③ 步接著走完；跳過只做創角色、空物件的提醒照樣出現；全部還原成預設又從創角色開始。教學的對接不算進對接過幾次和換點比例、紀錄標「教學」。（`tut.js` 是兩個世界的走法，和 t_parity、t_nothree 共用。）
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
node v8/tests/t_tutorial.js test8.html
```

瀏覽器測試的 `H.fresh()` 預設會放一個示範的「我」（`APP.demo()`）並跳過教學；`H.fresh({ raw: true })` 才是真的第一次打開（從創角色開始）。
