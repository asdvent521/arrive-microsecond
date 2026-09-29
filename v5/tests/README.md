# v5 測試

- `node v5/tests/data.test.js`：資料層（序號縮寫、走法解碼、預設世界）。
- `node v5/tests/fusion.test.js`：融合流程規則（約出發點、階段、判定與爭議、熱量、加入、退出、擱置）。
- `node v5/tests/t_fusion.js <test.html>`：在表世界把整輪融合走一遍（切換角色輪流操作）。
- `node v5/tests/t_sheets.js <test.html>`：表世界活頁簿（分頁順序、下一步、名稱方塊、連結跳轉與返回、角色／難題／規則／世界／走法／出發點各頁的操作）。
- `node v5/tests/t_walk.js <test.html> [截圖資料夾]`：整段流程（靠近顯示功能、繞圈走出 J、走到走出 2、傳送門、到別人的世界看規則、站在終點等那一微秒、相遇、改外觀不影響走法）。

`test.html` 是用本機的 Three.js 組出來的版本，因為測試機可能連不到 CDN：

```sh
npm install three@0.170.0            # 任何資料夾都行
{ echo 'var THREE=(function(){var exports={};var module={exports:exports};'; cat node_modules/three/build/three.cjs; echo ';return module.exports;})();'; } > three.global.js
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; THREE_SRC=three.global.js v5/build.sh fragment; echo '</body></html>'; } > test.html
node v5/tests/t_walk.js test.html shots
```
