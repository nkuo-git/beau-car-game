// 第 53 批（Nick 2026-10-29「越野車 繼續做」→ 看圖卡片「好，做進去」）：P8 皮卡＝第三台 terrain.js「offroad」那一級的普通大小越野車（5.3 公尺，最長的一台）
//   跟 jeep-test.mjs 同一趟（車庫頁是你的車、3D 駕駛座、越野車行 90 萬 → 開上斜坡到 3 樓 → 電梯到 B1 停好 → 回 1 樓開出去 → 快速道路 → 泥巴池 → 駕駛座視角、draw calls），換成 P8
// node p8-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/p8/p8）
process.env.OFFCAR = 'p8';
await import('./jeep-test.mjs');
