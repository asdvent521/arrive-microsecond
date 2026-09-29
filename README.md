# 到達那微秒

用現實中的難題當關卡的合作遊戲。

- **設計定案**：[docs/DESIGN.md](docs/DESIGN.md)
- **v5（3D 灰盒原型，現行設計）**：`v5/index.html` 用手機瀏覽器打開就能玩。原始碼在 `v5/src/`：`data.js` 是規則與資料（序號、走法解碼、世界資料），`fusion.js` 是相遇之後的融合流程，`exchange.js` 是點數兌換與每日額度，`world.js` 是 Three.js 畫面，`ui.js` 裡世界的接線，`sheets.js` 表世界活頁簿；`v5/build.sh` 組成單一 HTML；`v5/tests/` 是自動測試。
- **v4（表世界，舊設計）**：`index.html` 可直接用瀏覽器打開遊玩；原始碼在 `v4/src/`，用 `v4/build.sh` 組成單一 HTML，`v4/tests/` 是自動測試。
