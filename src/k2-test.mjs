// 第 51 批（Nick 2026-10-29 卡片「好，做進去」）：K2 小越野車＝第二台 terrain.js「offroad」那一級的車（跟 J4 吉普車一樣普通大小）
//   跟 jeep-test.mjs 同一趟（車庫頁是你的車、3D 駕駛座、越野車行 60 萬 → 開上斜坡到 3 樓 → 電梯到 B1 停好 → 回 1 樓開出去 → 快速道路 → 泥巴池 → 駕駛座視角、draw calls），換成 K2
// node k2-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/k2/k2）
process.env.OFFCAR = 'k2';
await import('./jeep-test.mjs');
