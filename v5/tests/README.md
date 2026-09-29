# v5 測試

- `node v5/tests/data.test.js`：資料層（序號縮寫、走法解碼、預設世界）。
- `node v5/tests/t_walk.js <test.html> [截圖資料夾]`：整段流程（靠近顯示功能、繞圈走出 J、走到走出 2、傳送門、到別人的世界看規則、站在終點等那一微秒、相遇、改外觀不影響走法）。

`test.html` 是用本機的 Three.js 組出來的版本，因為測試機可能連不到 CDN：

```sh
npm install three@0.170.0            # 任何資料夾都行
{ echo 'var THREE=(function(){var exports={};var module={exports:exports};'; cat node_modules/three/build/three.cjs; echo ';return module.exports;})();'; } > three.global.js
{ echo '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body>'; THREE_SRC=three.global.js v5/build.sh fragment; echo '</body></html>'; } > test.html
node v5/tests/t_walk.js test.html shots
```
