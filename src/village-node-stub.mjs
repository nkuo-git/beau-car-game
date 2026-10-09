// 在 node 裡跑 village.js／drive.js（不用瀏覽器）：假的 document、canvas（畫圖的函式都不做事）
// 用法：import './village-node-stub.mjs'（要在 import village.js 之前）
const noop = () => {};
const grad = () => ({ addColorStop: noop });
function ctx2d(c) {
  const st = { font: '10px sans-serif' };
  return new Proxy(st, {
    get(t, k) {
      if (k === 'canvas') return c;
      if (k === 'measureText') return (s) => { const px = +(/(\d+(?:\.\d+)?)px/.exec(t.font) || [0, 10])[1]; return { width: String(s).length * px * 0.9 }; };
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return grad;
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function canvas() { const c = { width: 300, height: 150, style: {}, getContext: () => ctx2d(c), toDataURL: () => '', addEventListener: noop }; return c; }
globalThis.document = { createElement: (t) => (t === 'canvas' ? canvas() : { style: {}, appendChild: noop, append: noop, setAttribute: noop, addEventListener: noop, classList: { add: noop, remove: noop, toggle: noop } }), fonts: null };
globalThis.window = globalThis.window || { addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1 };
