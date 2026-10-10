# 到達那微秒

每個角色每天發自己的點，規則公開透明；在約好的那一微秒相遇，規則有一方通就對接。

- **平台核心設計**：[docs/DESIGN.md](docs/DESIGN.md)
- **東恆村規（難題融合拆解，原 v5 設計）**：[docs/VILLAGE-donghen.md](docs/VILLAGE-donghen.md)
- **v8（一人一角色、每天一版、收點就選好東西；照 2026-10-09 改版的 DESIGN.md 做）**：`v8/index.html` 用手機瀏覽器打開就能玩。原始碼在 `v8/src/`：`core.js` 規則與資料（重寫：每天一版「明天起」、資源分可換／已保留、那一微秒兩兩照選好的成交、保留與兌現、不玩了），`world.js` Three.js 畫面，`app.js` 共用狀態與判定，`game.js` 裡世界，`sheet.js` 表世界；介面沿用 v7。`v8/build.sh` 組成單一 HTML；`v8/tests/` 是自動測試（規則層、7-3 逐列對照、裡世界、表世界、切換、無 3D、走代號手感、多人同一時段、新手教學、一起成交的時段）。第一次打開從創角色開始，跟引路人（J4）用「空的」換「空的」走一遍流程（可跳過）。改版計畫見 [docs/PLAN-v8.md](docs/PLAN-v8.md)。
- **v7（兩種介面，同一套功能，照 DESIGN.md 第 7 節做）**：`v7/index.html` 用手機瀏覽器打開就能玩。原始碼在 `v7/src/`：`core.js` 規則與資料（v6 原封不動，只加到場與判定），`world.js` Three.js 畫面，`app.js` 兩種介面共用的狀態、存檔、待辦與那一微秒的判定，`game.js` 裡世界（像遊戲：建築旁升起對話框、地圖、指引光點、建造模式、交換滑桿），`sheet.js` 表世界（簡單的 Excel 表：20 張工作表、一張表一張工作表、連結跳轉）；右上角「表 ⇄ 裡」切換。`v7/build.sh` 組成單一 HTML；`v7/tests/` 是自動測試（含 7-3 功能對照的逐列對照測試）。改版計畫見 [docs/PLAN-v7.md](docs/PLAN-v7.md)。
- **v6（平台核心，照 DESIGN.md 做）**：`v6/index.html` 用手機瀏覽器打開就能玩。原始碼在 `v6/src/`：`core.js` 是規則與資料（角色、每天的點、生命週期、空窗、條件判定、查詢、預約、對接、點數帳、兌現；序號、走法解碼、世界檢查沿用 v5），`world.js` 是 Three.js 畫面（沿用 v5），`ui.js` 裡世界的接線，`sheets.js` 表世界活頁簿；`v6/build.sh` 組成單一 HTML；`v6/tests/` 是自動測試。改版計畫見 [docs/PLAN-v6.md](docs/PLAN-v6.md)。
- **v5（3D 灰盒原型，照東恆村規做，留作村規參考實作）**：`v5/index.html` 用手機瀏覽器打開就能玩。原始碼在 `v5/src/`：`data.js` 是規則與資料（序號、走法解碼、世界資料），`fusion.js` 是相遇之後的融合流程，`exchange.js` 是點數兌換與每日額度，`world.js` 是 Three.js 畫面，`ui.js` 裡世界的接線，`sheets.js` 表世界活頁簿；`v5/build.sh` 組成單一 HTML；`v5/tests/` 是自動測試。
- **v4（表世界，舊設計）**：`index.html` 可直接用瀏覽器打開遊玩；原始碼在 `v4/src/`，用 `v4/build.sh` 組成單一 HTML，`v4/tests/` 是自動測試。
