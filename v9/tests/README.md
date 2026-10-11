# v9 測試（第 1 輪）

一次跑一個檔。所有按鈕都用手指按：先確認 `elementFromPoint` 打到的就是那個按鈕，再點那個座標（`lib.js`）。換表也是按下方的組、上方的表。畫面測試預設手機轉橫（780×360）。

- `node v9/tests/core.test.js`：規則層。v8 原本的規則測試照樣全過（照新規則改：預約時預設確認到達、家規、到達的字樣），加上：到達（預約時預設確認、選不要、取消、再確認、取消預約清掉、舊存檔的 declined 讀得進來）；家規網站只收 https、明天起生效；序號（簡寫、11 位數、找不到）、隨機不挑自己和不玩了的人；公告欄（掛、撤、過期拿掉、上限和期限存得住、可以給要從自己的資源表選）；搜尋同時查公告和資源、通不通跟預約的判斷一樣；引路人的公告沒有期限、成交也不拿掉；存檔新名字、讀得到 v8 就搬過來、讀不了從頭開始。
- `node v9/tests/t_table.js <test9.html> [截圖資料夾]`：表格世界。沒有 3D、裡世界、切換鈕；四組十二張表都打得開，780×360 每張不用左右滑；他的表格世界四張（角色、規則表、資源表、時段）也不用左右滑、不能改；看定義到定義表再回來；序號框（簡寫、11 位數、找不到、自己）、隨機、回我自己；360×780 有「轉橫看整張表」、表可以左右滑；用手指走一遍：找人 → 看他的時段 → 約他（到達預設勾著）→ 選東西 → 那一微秒白光、成交結果、能量往下降 → 背包兌現 → 日曆；讀得到 v8 存檔就搬過來，讀不了從創角色開始。
- `node v9/tests/t_board.js <test9.html>`：公告欄。引路人的教學公告；掛公告（需要、種類、可以給兩樣、上限、期限）、沒寫需要掛不上去；全部／我的、篩種類；通不通跟預約的判斷一樣（小樂要接受家規 → 不通）；搜尋（需要、可以給、種類）、別人資源表裡有的到找人一起列出來；找人的我可以去找／可能來找我／全部；點公告上的序號跳過去；撤掉；過了期限自動拿掉。
- `node v9/tests/t_multi.js <test9.html>`：多人。J1 開時段，J2、J3 在 J1 的時段裡約（換人用「我的／角色」最下面的選單），各自選要換誰的什麼，那一微秒三對照選好的成交、背包、日曆。
- `node v9/tests/t_together.js <test9.html>`：一起成交。開時段勾一起成交、約之前看得到標示、還差誰、都選好了、三人湊一圈全部成交；有一對沒選整個時段不成交（點、貨、保留不動，結果寫是哪一對）；刪沒人預約的時段。
- `node v9/tests/t_present.js <test9.html>`：到達與補判。拿掉到達的勾再約 → 今天提醒；我預約的勾到達、重新整理還在、取消、再確認、取消預約；約好後關掉頁面、那一微秒過了再打開 →「你不在的時候」、今天也列出來、背包多一筆；頁面停住（CDP Debugger.pause）再打開一樣；沒確認記錯過。
- `node v9/tests/t_tutorial.js <test9.html>`：新手教學 1～7 步用手指走完（創角色、隨機、公告欄找到 J4 用序號框跳過去、看家規、約他選空的、那一微秒、背包兌現），教學的對接不算數、標教學；跳過（只做創角色、空物件提醒照樣出現）；教學中跳過；全部還原又從創角色開始。

```sh
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>'; v9/build.sh fragment; echo '</body></html>'; } > test9.html
node v9/tests/core.test.js
node v9/tests/t_table.js test9.html shots
node v9/tests/t_board.js test9.html
node v9/tests/t_multi.js test9.html
node v9/tests/t_together.js test9.html
node v9/tests/t_present.js test9.html
node v9/tests/t_tutorial.js test9.html
```
