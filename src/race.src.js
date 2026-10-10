// ---- 賽道：400 公尺直線加速賽（你開車庫裡現在這台，對手是一個一個的人，各開各的車）----
// 物理：每台車的馬力、重量、驅動方式、紅線、極速大約照真車（PERF，在車庫那段；裝了引擎零件馬力會加），六速變速箱，
// 起步的抓地力有上限（四驅最好起步，引擎在中間的後驅次之），輪胎可以買更抓地的；外觀不影響速度
// 贏了拿對手的獎金（GAME.money），第一次贏過一個對手，下一個才會出現
// 要自己開車去（town.src.js）：開進起跑區，車子停到起跑線就交給這裡（enterRace）；「開回村子」「直接回車庫」也在 town.src.js
// 賽道和小村莊（village.js）在同一個場景（TR.scene）：村子在起跑線西邊（x < −55）
// build-art.mjs 把這個檔案接在車庫頁的程式裡（用得到 renderer、scene、CARS、PERF、GAME、loadCar⋯）
const RACE_M = 400, LANE = 2.4;
const GEARS = [3.3, 2.2, 1.62, 1.28, 1.05, 0.86];
const GREEN = [0.88, 0.985]; // 換檔的綠色區（轉速÷紅線）
const torqueAt = (x) => 0.8 + 0.4 * x - 0.4 * x * x;
const $ = (id) => document.getElementById(id);
const hudEl = $('hud'), raceEl = $('race'), oppsEl = $('opps'), resultEl = $('result'), goBtn = $('goBtn'), nitroBtn = $('nitroBtn');
const toastEl = $('toast'), clockEl = $('clock'), spdEl = $('spd'), tachEl = $('tach'), treeEls = [...document.querySelectorAll('#tree i')];
const pMe = $('pMe'), pOpp = $('pOpp');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

const TYRE_GRIP = [0, 0.08, 0.16]; // 原廠胎、半熱熔胎、直線加速胎
// s：{ key, hp, tyre }（你的車照車庫裝的零件和輪胎，對手的車寫在 OPPS）
function racer(s) {
  const P = PERF[s.key], W = CARS[s.key].spec.wheels;
  const r = W.RR ?? W.R, m = P.kg + 75, wr = (P.red * 2 * Math.PI) / 60, grip = 1.35 * (1 + TYRE_GRIP[s.tyre || 0]);
  return {
    key: s.key, P, m, r, wr, fd: (wr * r) / (GEARS[5] * (P.vmax / 3.6)), Tpk: (s.hp * 745.7) / (wr * 0.95 * torqueAt(0.95)),
    tract: grip * m * 9.81 * (P.awd ? 0.9 : P.drive ?? 0.74), cda: P.cda,
    x: 0, v: 0, gear: 0, shiftT: 0, cut: 0, nitro: 0, nitroUsed: false, go: null, react: null, fin: null, trap: 0, rpm: 0.12, spin: 0,
  };
}
const mySetup = () => ({ key: cur, hp: hpOf(cur), tyre: tyreOf(cur) });
const statLine = (key) => { const P = PERF[key]; return `${hpOf(key).toLocaleString('en-US')} 匹 · ${P.kg.toLocaleString('en-US')} 公斤 · ${P.awd ? '四驅' : '後驅'}`; };

// ---- 對手：從隔壁同學到大魔王，越後面越快、獎金越多（萬）----
// drv：開車的功力（反應秒數、幾轉換檔、幾秒放氮氣）；look：車子的樣子（沒寫的用那台車原本的）
const DRIVERS = {
  rookie: { react: [0.45, 0.7], shift: [0.78, 0.93], nitro: null },
  ok: { react: [0.3, 0.5], shift: [0.84, 0.97], nitro: [2.5, 5] },
  good: { react: [0.22, 0.38], shift: [0.87, 0.98], nitro: [1.5, 4] },
  pro: { react: [0.17, 0.28], shift: [0.89, 0.975], nitro: [1.2, 2.5] },
};
const OPPS = [
  { id: 'classmate', name: '隔壁同學', sub: '剛拿到駕照', key: 'gc8', hp: 280, tyre: 0, drv: 'rookie', prize: 5, look: { paint: '#f2f3f5', rim: 'chrome', wing: 'none', livery: 'none' } },
  { id: 'uncle', name: '巷口阿伯', sub: '開 Yaris 去買菜', key: 'yaris', hp: 300, tyre: 0, drv: 'ok', prize: 12, look: { paint: '#0e0f11', rim: 'black', wing: 'stock', livery: 'none' } },
  { id: 'courier', name: '送貨小哥', sub: '趕著送貨', key: 'gc8', hp: 400, tyre: 1, drv: 'good', prize: 25, parts: ['exhaust', 'turbo'], look: { paint: '#c3c8ce', rim: 'gunmetal', wing: 'lip', livery: 'none' } },
  { id: 'nightmarket', name: '夜市小霸王', sub: '車子整台都是紫的', key: 'supra', hp: 650, tyre: 1, drv: 'good', prize: 60, parts: ['exhaust', 'intake', 'ecu'], look: { paint: '#5b2d9e', rim: 'chrome', rimStyle: 'fan', glow: '#9b4dff', wing: 'gt', kit: 'bomex', livery: 'flames' } },
  { id: 'shop', name: '修車廠老闆', sub: '自己改的 R34', key: 'gtr', hp: 750, tyre: 1, drv: 'good', prize: 150, parts: ['exhaust', 'turbo', 'ecu'], look: { paint: '#141518', rim: 'gunmetal', rimStyle: 'mesh', wing: 'swan', kit: 'stock', livery: 'none' } },
  { id: 'club', name: '超跑俱樂部會長', sub: '車庫停滿超跑', key: 'p918', hp: 887, tyre: 1, drv: 'good', prize: 800, look: { paint: '#c5c9ce', finish: 'pearl', livery: 'none' } },
  { id: 'touge', name: '山道之王', sub: '山路沒輸過', key: 'gtr', hp: 900, tyre: 2, drv: 'pro', prize: 1200, parts: ['exhaust', 'intake', 'turbo', 'ecu', 'cams'], look: { paint: '#1d4fc9', rimStyle: 'six', wing: 'gt', kit: 'track', livery: 'ff' } },
  { id: 'racer', name: '職業賽車手', sub: '每個週末都在比賽', key: 'sp3', hp: 1100, tyre: 2, drv: 'pro', prize: 2000, look: { livery: 'daytona' } },
  { id: 'boss', name: '大魔王', sub: '最後一關', key: 'jesko', hp: 1920, tyre: 2, drv: 'good', prize: 3000, parts: ['exhaust', 'turbo', 'ecu'], look: { paint: '#16171a', finish: 'matte', glow: '#ff2d3d', livery: 'red' } },
];
const unlocked = (i) => i === 0 || (GAME.wins[OPPS[i - 1].id] || 0) > 0;
const oppById = (id) => OPPS.find((o) => o.id === id);
// 對手的車長什麼樣子：那台車原本的樣子＋對手自己的（不合的選項不用）
function oppLook(o) {
  const look = { ...DEFAULT_LOOK[o.key] };
  for (const [k, v] of Object.entries(o.look || {})) if (k in look && okValue(o.key, k, v)) look[k] = v;
  return look;
}
const mean = (r) => (r[0] + r[1]) / 2;
const PLAYER_SIM = { react: 0.3, shift: 0.93, nitro: 2 }; // 試算你的秒數：普通玩家大概這樣開
// 引擎聲：你一個、對手一個（engineAudio 在車庫那段）；進賽道就怠速，比賽時跟著轉速、油門、換檔
const snd = { me: null, op: null, opId: null };
function sndOpp(o) {
  if (snd.opId === o.id && snd.op?.alive) return;
  snd.op?.dispose(); snd.op = engineAudio.voice(o.key, { gain: 0.5, pan: -0.25, parts: o.parts || [] }); snd.opId = o.id;
}
function sndStop() { snd.me?.dispose(); snd.op?.dispose(); snd.me = snd.op = snd.opId = null; }

// ---- 賽道場景（第一次上賽道才做）----
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function buildTrack() {
  const T = new THREE.Scene();
  const sky = new THREE.Color(0xb4cde2);
  T.background = sky; T.fog = new THREE.Fog(sky, 80, 560);
  // 反射用的天空：上面藍、地平線亮、下面灰綠，加一顆太陽
  const E = new THREE.Scene();
  E.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3f78bd'); gr.addColorStop(0.47, '#e4ecf2'); gr.addColorStop(0.53, '#72786a'); gr.addColorStop(1, '#3a3e36');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }) })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 13, 11) }));
  sun.position.set(-18, 30, 24); E.add(sun);
  T.environment = pmrem.fromScene(E, 0.03).texture;
  T.add(new THREE.HemisphereLight(0xdfeeff, 0x4d5a3c, 0.6));
  const dl = new THREE.DirectionalLight(0xfff4e0, 1.4); dl.position.set(-18, 30, 24); T.add(dl);

  const L0 = -60, L1 = 760, LEN = L1 - L0, MID = (L0 + L1) / 2;
  const mat = (o) => new THREE.MeshStandardMaterial(o);
  const plane = (w, h, m, x, y, z, sx = 1, sz = 1) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h, sx, sz), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); T.add(p); return p; };
  // 草地：只鋪 x −62…1250（西邊是小村莊自己的草地，village.js）；切成 60 公尺左右的格子
  plane(1312, 900, mat({ color: 0x62704a, roughness: 1, map: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#7d8c5d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${60 + Math.random() * 50},${25 + Math.random() * 25},0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [190, 130]) }), 594, -0.02, 0, 22, 15);
  // 柏油：兩條車道、中間白線、兩邊白線（貼圖 16 公尺 × 12 公尺一格）
  plane(LEN, 12, mat({ roughness: 0.92, map: canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const k = 40 + Math.random() * 60; g.fillStyle = `rgba(${k},${k},${k + 4},0.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    g.fillStyle = '#e9ebee';
    for (const zz of [-5.6, 5.6]) g.fillRect(0, (zz + 6) * 32 - 2.5, w, 5);
    g.fillRect(0, 6 * 32 - 2, w, 4);
  }, [LEN / 16, 1]) }), MID, 0, 0);
  // 起跑那段輪胎印（黑色，越往前越淡）
  const rub = plane(90, 12, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, map: canvasTex(512, 128, (g, w, h) => {
    for (const zz of [LANE - 0.78, LANE + 0.78, -LANE - 0.78, -LANE + 0.78]) {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(8,8,9,0.85)'); gr.addColorStop(0.35, 'rgba(8,8,9,0.45)'); gr.addColorStop(1, 'rgba(8,8,9,0)');
      g.fillStyle = gr; g.fillRect(0, ((zz + 6) / 12) * h - 5, w, 10);
    }
  }) }), 40, 0.003, 0);
  rub.renderOrder = 1;
  // 起跑線、終點線（黑白格）
  plane(0.3, 11.2, new THREE.MeshBasicMaterial({ color: 0xf2f3f5 }), 0, 0.004, 0);
  plane(1.6, 11.2, new THREE.MeshBasicMaterial({ map: canvasTex(64, 448, (g, w, h) => {
    const s = 32; for (let i = 0; i < w / s; i++) for (let j = 0; j < h / s; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f2f3f5'; g.fillRect(i * s, j * s, s, s); }
  }) }), RACE_M, 0.004, 0);
  // 兩邊水泥護欄（上面紅白）
  const wallMat = mat({ roughness: 0.85, map: canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f2f3f5' : '#d0342c'; g.fillRect((i * w) / 4, 0, w / 4, h * 0.28); }
    for (let i = 0; i < 600; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(Math.random() * w, h * 0.3 + Math.random() * h * 0.7, 2, 2); }
  }, [LEN / 8, 1]) });
  for (const [x0, x1, s] of [[L0, L1, 1], [L0, -57.5, -1], [-37, L1, -1]]) { // 南邊的牆不開口了（內湖改從村子南邊的口過去）；北邊的牆在 x −57.5…−37 開一個口：往北的路去賽車場（circuit.js）
    const g = new THREE.BoxGeometry(x1 - x0, 0.9, 0.4), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * (x1 - x0)) / LEN); // 貼圖照長度（短的不要擠）
    const wl = new THREE.Mesh(g, wallMat); wl.position.set((x0 + x1) / 2, 0.45, s * 6.3); T.add(wl);
  }
  // 距離牌：100、200、300 公尺
  for (const d of [100, 200, 300]) for (const s of [1, -1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb31a'; g.fillRect(0, 0, w, 10);
      g.fillStyle = '#f2f3f5'; g.font = '700 64px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${d} M`, w / 2, h / 2 + 6);
    }) }));
    sign.rotation.y = -Math.PI / 2; sign.position.set(d, 1.75, s * 6.6); T.add(sign);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), mat({ color: 0x2a2c30 })); post.position.set(d + 0.02, 0.7, s * 6.6); T.add(post);
  }
  // 看台（起跑那邊，左邊）：一階一階，上面是觀眾（彩色點）
  const crowd = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#5b5f66'; g.fillRect(0, 0, w, h);
    const cs = ['#d0342c', '#f2f3f5', '#2f6fd6', '#ffb31a', '#1d1f23', '#3ddc84', '#ff6a1f', '#8a5cd6'];
    for (let i = 0; i < 700; i++) { g.fillStyle = cs[(Math.random() * cs.length) | 0]; g.beginPath(); g.arc(Math.random() * w, 8 + Math.random() * (h - 16), 2.2, 0, Math.PI * 2); g.fill(); }
  }, [12, 1]);
  const standMat = mat({ roughness: 0.9, map: crowd }), concrete = mat({ color: 0xb9bcc1, roughness: 0.9 });
  for (let k = 0; k < 6; k++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(130, 0.7, 1.3), [concrete, concrete, standMat, concrete, standMat, concrete]);
    st.position.set(30, 0.35 + k * 0.7, -(9.5 + k * 1.3)); T.add(st);
    const back = new THREE.Mesh(new THREE.BoxGeometry(130, 0.7 * (k + 1), 1.3), concrete); back.position.set(30, 0.35 * (k + 1) - 0.36, -(9.5 + k * 1.3)); T.add(back);
  }
  // 起跑燈樹（兩條車道中間）：三個黃燈、綠燈、紅燈
  const tree = new THREE.Group(); tree.position.set(3.2, 0, 0); T.add(tree);
  const dark = mat({ color: 0x1b1d21, roughness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 12), dark); pole.position.y = 0.6; tree.add(pole);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.45, 0.62), dark); box.position.y = 1.85; tree.add(box);
  const bulbs = { amber: [], green: [], red: [] }, bulbGeo = new THREE.SphereGeometry(0.075, 16, 10);
  const bulb = (kind, y) => {
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0x222222 })); m.position.set(-0.16, y, s * 0.16); tree.add(m);
      (bulbs[kind][s > 0 ? 0 : 1] ||= []).push(m);
    }
  };
  bulb('amber', 2.35); bulb('amber', 2.1); bulb('amber', 1.85); bulb('green', 1.55); bulb('red', 1.3);
  // 終點門：兩根柱子、上面黑白格橫幅
  const gantry = new THREE.Group(); gantry.position.x = RACE_M; T.add(gantry);
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.4, 0.45), dark); p.position.set(0, 3.2, s * 6.9); gantry.add(p); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 14.2), [dark, new THREE.MeshBasicMaterial({ map: canvasTex(1024, 96, (g, w, h) => {
    const s = 24; for (let i = 0; i < w / s; i++) for (let j = 0; j < h / s; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f2f3f5'; g.fillRect(i * s, j * s, s, s); }
    g.fillStyle = '#16181c'; g.fillRect(w * 0.32, 8, w * 0.36, h - 16);
    g.fillStyle = '#ffb31a'; g.font = '700 58px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('終點 400 M', w / 2, h / 2 + 3);
  }) }), dark, dark, dark, dark]); // 有字的那面朝起點（-x）
  banner.position.set(0, 6.2, 0); gantry.add(banner);
  // 路燈（兩邊，每 60 公尺一支）
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 9, 8); poleGeo.translate(0, 4.5, 0);
  const lampGeo = new THREE.BoxGeometry(1.4, 0.25, 0.5); lampGeo.translate(0, 9, 0);
  const n = Math.ceil(LEN / 60) * 2, poles = new THREE.InstancedMesh(poleGeo, mat({ color: 0x8d9197, roughness: 0.5, metalness: 0.5 }), n), lamps = new THREE.InstancedMesh(lampGeo, dark, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const x = L0 + 30 + 60 * (i >> 1), z = i % 2 ? 8 : -8; m4.makeTranslation(x, 0, z); poles.setMatrixAt(i, m4); lamps.setMatrixAt(i, m4); }
  T.add(poles, lamps);
  // 樹（遠一點，兩邊；村子那邊 x < −55 不種，村子有自己的樹）＋遠山
  const NT = 170, cone = new THREE.ConeGeometry(1.6, 5, 7); cone.translate(0, 4.2, 0);
  const trunk = new THREE.CylinderGeometry(0.18, 0.25, 1.8, 6); trunk.translate(0, 0.9, 0);
  const trees = new THREE.InstancedMesh(cone, mat({ color: 0x3f5a32, roughness: 1 }), NT), trunks = new THREE.InstancedMesh(trunk, mat({ color: 0x5a4332, roughness: 1 }), NT);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < NT; i++) {
    const s = i % 2 ? 1 : -1, k = 0.7 + Math.random() * 0.8; let x, z;
    do { x = -55 + Math.random() * (L1 + 80 + 55); z = s * (20 + Math.random() * 50); } while (CIRCUIT_KEEP.some(([a, b, c, d]) => x > a && x < c && z > b && z < d) || NEIHU_KEEP.some(([a, b, c, d]) => x > a && x < c && z > b && z < d)); // 內湖的聯外道路上也不種 // 賽車場的聯外道路上不種
    m4.compose(pv.set(x, 0, z), q, sc.set(k, k * (0.8 + Math.random() * 0.5), k)); trees.setMatrixAt(i, m4); trunks.setMatrixAt(i, m4);
  }
  T.add(trees, trunks);
  const hillMat = mat({ color: 0x7c8a78, roughness: 1 });
  // 賽車場（circuit.js）：北邊三座本來在 (80, −300)、(420, −330)、(760, −280)，會蓋到賽車場：往北移到賽車場後面
  // 南邊三座（(200, 365)、(600, 360)、(1000, 330)）拿掉：內湖（neihu.js）搬到越野車場南邊（z 330 以南），那邊是內湖北邊的山脊
  for (const [x, z, r] of [[120, -940, 150], [560, -960, 170], [1000, -930, 140]]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), hillMat); h.scale.y = 0.28; h.position.set(x, -r * 0.05, z); T.add(h);
  }
  // 車子底下的影子（兩台）
  const shadows = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.3), new THREE.MeshBasicMaterial({ map: sh.material.map, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.006; T.add(m); return m; });
  // 氮氣的藍色火焰（車尾中間下面）
  const fm = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const outerGeo = new THREE.ConeGeometry(0.15, 1.1, 16, 1, true), coreGeo = new THREE.ConeGeometry(0.07, 0.6, 12, 1, true), outerMat = fm(0x3f7dff, 0.75), coreMat = fm(0xe6efff, 0.9);
  const flames = [0, 1].map(() => {
    const f = new THREE.Group();
    const o = new THREE.Mesh(outerGeo, outerMat), k = new THREE.Mesh(coreGeo, coreMat);
    o.rotation.z = k.rotation.z = Math.PI / 2; o.position.x = -0.55; k.position.x = -0.3; // 尖端朝後
    f.add(o, k); f.visible = false; T.add(f); return f;
  });
  return { scene: T, bulbs, shadows, flames };
}

// ---- 比賽狀態 ----
let TR = null, race = null, rcam = null, raceOpp = null, oppFor = null, lastT = 0, orbitA = 0, oppCar = null;
const RACE = { on: false, frame: raceFrame };
function carSize(Sx) { const b = new THREE.Box3().setFromObject(Sx.body); return { nose: b.max.x, len: b.max.x - b.min.x, tail: b.min.x }; }
function putCar(Sx, c, z, info) {
  Sx.car.position.set(c.x - info.nose, 0, z);
}
function setWheels(Sx, c) {
  const W = Sx.spec.wheels;
  Sx.wheels.forEach((wh, i) => { const R = i < 2 ? W.RF ?? W.R : W.RR ?? W.R; wh.rotation.z = (i % 2 === 0 ? 1 : -1) * (c.spin / R); });
}
// 對手的車：另外組一台（跟你開同一款也沒關係），換對手或離開賽道就釋放
// 載入要一點時間：等的時候又換了對手，舊的那台做好就直接丟掉（'stale'）
let oppLoading = null;
function getOppCar(o) {
  if (oppCar && oppCar.id === o.id) return Promise.resolve(oppCar.S);
  if (oppLoading && oppLoading.id === o.id) return oppLoading.p;
  dropOppCar();
  status.hidden = false; msg.textContent = `${o.name}開著 ${CARS[o.key].btn[0]} 來了⋯`; prog.parentElement.hidden = false; prog.style.width = glbs[o.key] ? '100%' : '0%';
  const job = { id: o.id };
  job.p = loadCar(o.key, oppLook(o)).then((S2) => {
    if (oppLoading !== job) { disposeCar(S2); throw new Error('stale'); }
    oppLoading = null; oppCar = { id: o.id, S: S2 }; status.hidden = true;
    return S2;
  }, (e) => { if (oppLoading === job) oppLoading = null; throw e; });
  oppLoading = job;
  return job.p;
}
function dropOppCar() {
  oppLoading = null;
  if (!oppCar) return;
  disposeCar(oppCar.S); oppCar = null;
}
// 挑好的對手先開到旁邊車道等你（比完換對手就兩台都回起跑線）
async function showOpp() {
  if (!race) return;
  if (race.phase === 'done') lineUp();
  if (race.phase !== 'idle') return;
  const o = oppById(raceOpp), p = getOppCar(o);
  if (race.oppS && race.oppS !== oppCar?.S) race.oppS = null; // 換了對手：上一台已經釋放了
  let O;
  try { O = await p; } catch (e) {
    if (e.message !== 'stale') { status.hidden = false; msg.textContent = '對手沒載入成功，按「開始比賽」再試一次'; prog.parentElement.hidden = true; }
    return;
  }
  if (!RACE.on || !race || race.phase !== 'idle' || raceOpp !== o.id) return;
  race.oppS = O; race.oppInfo = carSize(O); race.park = { x: 0, spin: 0, nitro: 0, fin: null };
  TR.scene.add(O.car); O.car.visible = true; O.body.position.y = +oppLook(o).height;
  putCar(O, race.park, -LANE, race.oppInfo); setWheels(O, race.park);
  sndOpp(o);
}
// 回到起跑線等下一場
function lineUp() {
  Object.assign(race, { phase: 'idle', t: 0, me: racer(mySetup()), opp: null, green: null, snap: true });
  race.me.spin = 0; putCar(S, race.me, LANE, race.meInfo); setWheels(S, race.me);
  lights(0, false, false); hudIdle(); for (const f of TR.flames) f.visible = false;
  $('raceGo').textContent = '開始比賽'; resultEl.hidden = true; // 上一場的結果收起來（換了對手）
  ghHide();
}
function toast(text, ms = 900) {
  toastEl.textContent = text; toastEl.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function oppChoices() {
  oppsEl.replaceChildren();
  const sig = `${cur}|${hpOf(cur)}|${tyreOf(cur)}|${OPPS.filter((o, i) => unlocked(i)).length}`;
  if (oppFor !== sig || !raceOpp) { // 換車、裝了零件、多了對手就重選預設：你開得普通就贏得了的裡面，獎金最多的那個；都贏不了就選最慢的
    const mine = simET(mySetup(), PLAYER_SIM), open = OPPS.filter((o, i) => unlocked(i)), et = new Map(open.map((o) => [o, oppET(o)]));
    const can = open.filter((o) => et.get(o) >= mine + 0.05);
    raceOpp = (can.length ? can.reduce((a, b) => (b.prize > a.prize ? b : a)) : open.reduce((a, b) => (et.get(b) > et.get(a) ? b : a))).id;
    oppFor = sig;
  }
  OPPS.forEach((o, i) => {
    const open = unlocked(i), b = document.createElement('button');
    b.type = 'button'; b.disabled = !open; b.setAttribute('aria-pressed', String(o.id === raceOpp));
    if (GAME.wins['dr:' + o.id]) b.classList.add('beaten');
    const t = document.createElement('b'), s2 = document.createElement('span'), s3 = document.createElement('small');
    if (open) { t.textContent = o.name; s2.textContent = `${CARS[o.key].btn[0]} · ${o.hp.toLocaleString('en-US')} 匹`; s3.textContent = `獎金 ${money(o.prize)}`; }
    else { t.textContent = '？？？'; s2.textContent = unlocked(i - 1) ? `賽車場先贏${OPPS[i - 1].name}` : '還沒出現'; }
    b.append(t, s2, s3);
    b.addEventListener('click', () => {
      if (race && ['intro', 'stage', 'run'].includes(race.phase)) return;
      raceOpp = o.id; oppsEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      showOpp();
    });
    oppsEl.append(b);
    if (o.id === raceOpp) requestAnimationFrame(() => { oppsEl.scrollLeft = b.offsetLeft - (oppsEl.clientWidth - b.offsetWidth) / 2; }); // 預設的對手捲到看得到
  });
  $('meStat').textContent = `你開 ${CARS[cur].btn[0]}（${statLine(cur)}${tyreOf(cur) ? ` · ${TYRES[tyreOf(cur)][1]}` : ''}）`;
}
async function enterRace() {
  if (!S || RACE.on || enterRace.busy) return;
  stopRev(); getOut(); engineAudio.resume(); // 在點擊裡、await 之前；坐在車裡就先下車
  if (!TR) {
    enterRace.busy = true;
    await Promise.race([document.fonts.load('700 58px "Noto Sans TC"', '終點').catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
    enterRace.busy = false;
    if (!S) return;
    TR = buildTrack();
  }
  if (!rcam) rcam = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  RACE.on = true; controls.enabled = false;
  document.body.classList.add('racing');
  raceEl.hidden = false; hudEl.hidden = false; resultEl.hidden = true;
  $('raceGo').textContent = '開始比賽';
  oppChoices();
  race = { phase: 'idle', t: 0, me: racer(mySetup()), opp: null, meS: S, oppS: null, green: null, snap: true };
  race.meInfo = carSize(S);
  snd.me?.dispose(); snd.me = engineAudio.voice(cur, { parts: partsOf(cur) });
  TR.scene.add(S.car); S.car.visible = true; S.body.position.y = +CARS[cur].state.height;
  putCar(S, race.me, LANE, race.meInfo);
  hudIdle();
  if (!netDragInit(race)) showOpp(); // 一起比賽（net.src.js）：對手是朋友，不放 AI
  lastT = performance.now();
  stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}
// village＝開回村子（車子留在賽道的場景，town.src.js 的開車接手）；沒有＝車子放回車庫
function exitRace(village = false) {
  if (!RACE.on) return;
  RACE.on = false; controls.enabled = !village;
  document.body.classList.remove('racing'); raceLive(false);
  raceEl.hidden = true; hudEl.hidden = true;
  if (!village) for (const Sx of [race.meS]) {
    if (!Sx || !Object.values(built).includes(Sx)) continue;
    scene.add(Sx.car); Sx.car.position.set(0, 0, 0); Sx.car.visible = Sx === S; Sx.wheels.forEach((w) => (w.rotation.z = 0));
  }
  if (race.net) netDragDrop(race); // 一起比賽：朋友的車收掉（還沒跑完＝沒跑完）
  dropOppCar(); sndStop(); ghHide();
  for (const f of TR.flames) f.visible = false;
  for (const s of TR.shadows) s.visible = false; // 開車的時候看得到賽道：比賽的影子收掉、燈樹熄掉
  lights(0, false, false);
  race = null;
  renderOptions(); refreshCarBtns(); // 錢可能變多了：零件、車子買不買得起要重畫
}
async function startRace() {
  if (!race || race.net || ['intro', 'stage', 'run'].includes(race.phase)) return;
  engineAudio.resume();
  const o = oppById(raceOpp);
  if (race.oppS && (!oppCar || race.oppS !== oppCar.S || oppCar.id !== o.id)) race.oppS = null; // 換了對手：舊的那台 getOppCar 會釋放
  $('raceGo').disabled = true;
  let O;
  try { O = await getOppCar(o); } catch (e) {
    $('raceGo').disabled = false;
    if (e.message !== 'stale') { status.hidden = false; msg.textContent = '對手沒載入成功，再按一次'; prog.parentElement.hidden = true; }
    return;
  }
  $('raceGo').disabled = false;
  if (!RACE.on || !race) { dropOppCar(); return; }
  race.me = racer(mySetup()); race.opp = racer(o); race.oppDef = o; race.oppS = O; race.oppInfo = carSize(O);
  sndOpp(o); if (!snd.me?.alive) snd.me = engineAudio.voice(cur, { parts: partsOf(cur) });
  race.phase = 'intro'; raceLive(true); race.t = 0; race.green = null; race.greenAt = null; race.foul = false; race.doneT = null; race.paid = false;
  ghDragStart(race); // 鬼影車（ghost.src.js）：排行榜選了 400 公尺的鬼影車才有；這一趟也錄下來
  const d = DRIVERS[o.drv], U = (r) => r[0] + Math.random() * (r[1] - r[0]);
  race.ai = { d, react: U(d.react), shiftAt: U(d.shift), nitroAt: d.nitro ? U(d.nitro) : null };
  TR.scene.add(O.car); O.car.visible = true; O.body.position.y = +oppLook(o).height;
  putCar(S, race.me, LANE, race.meInfo); putCar(O, race.opp, -LANE, race.oppInfo);
  race.me.spin = 0; race.opp.spin = 0; setWheels(S, race.me); setWheels(O, race.opp);
  resultEl.hidden = true; nitroBtn.disabled = false; goBtn.textContent = '起步'; goBtn.disabled = false;
  for (const e of treeEls) e.className = e.dataset.k;
}
// 按鈕：起步／換檔、氮氣
function pressGo() {
  if (!race) return;
  const c = race.me;
  if (race.phase === 'stage' || race.phase === 'intro') { // 綠燈前按＝偷跑
    if (race.phase === 'intro') return;
    if (race.net) { netDragFoul(race); return; } // 一起比賽：偷跑＝沒跑完
    race.foul = true; finishRace(); toast('偷跑！', 1500); return;
  }
  if (race.phase !== 'run') return;
  if (c.go == null) { launch(c); toast(c.react < 0.2 ? '起步超快！' : '起步！', 700); goBtn.textContent = '換檔'; return; }
  const q = shift(c);
  if (q) snd.me?.shift();
  if (q) toast(q === 'good' ? '完美換檔' : q === 'early' ? '太早換檔' : '太晚換檔', 650);
}
function pressNitro() {
  if (!race || race.phase !== 'run' || race.me.go == null || race.me.nitroUsed || race.me.fin != null) return;
  useNitro(race.me); nitroBtn.disabled = true; toast('氮氣！', 700);
}
function launch(c) { c.go = race.t; c.react = race.t - race.green; }
function shift(c) {
  if (c.gear >= 5 || c.shiftT > 0 || c.go == null || c.fin != null) return null;
  const x = c.rpm, q = c.cut > 0 || x > GREEN[1] ? 'late' : x < GREEN[0] ? 'early' : 'good';
  c.gear++; c.shiftT = q === 'good' ? 0.1 : 0.2;
  return q;
}
function useNitro(c) { c.nitroUsed = true; c.nitro = 3; }
function stepRacer(c, dt, R) {
  const gr = GEARS[c.gear] * c.fd, xw = ((c.v / c.r) * gr) / c.wr;
  if (c.go == null) { // 還沒起步：怠速；燈樹亮了就踩油門等
    const want = R.phase === 'stage' || R.phase === 'run' ? 0.6 + Math.sin(R.t * 29) * 0.025 : 0.14;
    c.rpm += (want - c.rpm) * Math.min(1, dt * 7); return;
  }
  let F = 0;
  if (c.shiftT > 0) c.shiftT -= dt;
  else if (c.cut > 0) c.cut -= dt;
  else if (xw >= 1) c.cut = 0.08; // 撞到紅線斷油
  else F = Math.min((c.Tpk * torqueAt(Math.max(xw, c.gear === 0 ? 0.6 : 0.2)) * (c.nitro > 0 ? 1.35 : 1) * gr * 0.88) / c.r, c.tract * (c.nitro > 0 ? 1.06 : 1));
  if (c.fin != null) F = 0;
  const drag = 0.5 * 1.2 * c.cda * c.v * c.v + 0.015 * c.m * 9.81 + (c.fin != null ? c.m * 8.5 : 0); // 過終點就煞車
  c.v = Math.max(0, c.v + ((F - drag) / c.m) * dt);
  c.x += c.v * dt; c.spin += c.v * dt;
  if (c.nitro > 0) c.nitro -= dt;
  const target = c.cut > 0 ? 0.99 + Math.random() * 0.02 : c.gear === 0 ? Math.max(0.6, xw) : Math.max(0.2, xw);
  c.rpm += (Math.min(1.03, target) - c.rpm) * Math.min(1, dt * (c.shiftT > 0 ? 14 : 30));
  if (c.fin == null && c.x >= RACE_M) { c.fin = R.ts - R.green - (c.x - RACE_M) / Math.max(c.v, 1); c.trap = c.v; }
}
// 試算一場（不隨機）：d＝{ react, shift, nitro }（秒、轉速、起步後幾秒放氮氣，null＝不放），回傳從綠燈到過終點幾秒
function simET(s, d) {
  const R = { phase: 'run', t: 0, ts: 0, green: 0 }, c = racer(s), h = 1 / 240;
  c.rpm = 0.6;
  while (c.fin == null && R.t < 40) {
    R.t += h; R.ts = R.t;
    if (c.go == null && R.t >= d.react) { c.go = R.t; c.react = d.react; }
    if (c.go != null) {
      if (c.rpm >= d.shift && c.shiftT <= 0 && c.gear < 5) shift(c);
      if (d.nitro != null && !c.nitroUsed && R.t - c.go > d.nitro) useNitro(c);
    }
    stepRacer(c, h, R);
  }
  return c.fin ?? 99;
}
const oppET = (o) => { const d = DRIVERS[o.drv]; return simET(o, { react: mean(d.react), shift: mean(d.shift), nitro: d.nitro && mean(d.nitro) }); };
function finishRace() {
  race.phase = 'done'; race.doneT = race.t; raceLive(false, 1300); // 全螢幕：看完衝線再把成績拉上來
  const me = race.me, op = race.opp;
  const win = !race.foul && me.fin != null && (op.fin == null || me.fin < op.fin);
  const gap = me.fin != null && op.fin != null ? Math.abs(me.fin - op.fin) : null;
  if (!race.foul) toast(win ? '你贏了！' : '輸了', 1800);
  const f = (v, d = 3) => (v == null ? '—' : v.toFixed(d));
  const head = race.foul ? '偷跑，這場算輸' : win ? (gap == null ? '你贏了！' : `你贏了！快 ${f(gap, 2)} 秒`)
    : gap == null ? '輸了' : gap < 0.3 ? `差一點，慢 ${f(gap, 2)} 秒` : `輸了，慢 ${f(gap, 2)} 秒`;
  const et = (c) => (c.fin == null || c.react == null ? null : c.fin - c.react);
  resultEl.replaceChildren();
  const h = document.createElement('p'); h.className = 'res-head' + (win ? ' win' : ''); h.textContent = head; resultEl.append(h);
  $('raceGo').textContent = '再比一次'; goBtn.disabled = true; nitroBtn.disabled = true;
  // 獎金：贏了才有；第一次贏過這個對手，下一個就出現
  const o = race.oppDef, i = OPPS.indexOf(o), note = document.createElement('p');
  if (win && !race.paid) {
    race.paid = true;
    const first = !GAME.wins['dr:' + o.id] && OPPS[i + 1] && !unlocked(i + 1); // 賽車場：直線加速贏了只記 'dr:<id>'（不算獎盃、不開新的對手；賽車場贏了才開）
    GAME.wins['dr:' + o.id] = (GAME.wins['dr:' + o.id] || 0) + 1; GAME.money += o.prize; save(true); renderWallet(); room?.setTrophies(trophyCount());
    note.className = 'res-prize';
    const a = document.createElement('b'); a.textContent = `獎金 +${money(o.prize)}`;
    note.append(a, `　你現在有 NT$ ${money(GAME.money)}`);
    resultEl.append(note);
    if (first) {
      const nx = document.createElement('p'); nx.className = 'res-note';
      nx.textContent = `去賽車場也贏${o.name}，下一個對手才會出現`;
      resultEl.append(nx);
    }
    oppChoices();
  } else if (!win) {
    note.className = 'res-note';
    note.textContent = race.foul ? '綠燈還沒亮就按了起步。等三個黃燈亮完、綠燈一亮再按。' : '沒拿到獎金。開去改車廠裝零件、換輪胎，或先挑一個慢一點的對手賺錢。';
    resultEl.append(note);
  }
  if (race.foul) { resultEl.hidden = false; lights(0, false, true); showResult(); return; }
  if (me.fin != null) { // 跑完了：交給網站的排行榜（ghost.src.js）；有鬼影車就說比它快還是慢
    const vs = ghVs('drag', et(me)); ghDragEnd(race, et(me));
    if (vs) { const gp = document.createElement('p'); gp.className = 'res-note'; gp.textContent = `👻 ${GH.arm.name} ${GH.arm.t.toFixed(2)} 秒：你${vs.trim()}`; resultEl.append(gp); }
  }
  const tb = document.createElement('table');
  const rows = [['', `你 · ${CARS[me.key].btn[0]}`, `${o.name} · ${CARS[op.key].btn[0]}`],
    ['反應時間', `${f(me.react)} 秒`, `${f(op.react)} 秒`], ['400 公尺', `${f(et(me), 2)} 秒`, `${f(et(op), 2)} 秒`],
    ['過終點（含反應）', `${f(me.fin, 2)} 秒`, `${f(op.fin, 2)} 秒`], ['尾速', `${me.fin == null ? '—' : Math.round(me.trap * 3.6)} km/h`, `${op.fin == null ? '—' : Math.round(op.trap * 3.6)} km/h`]];
  rows.forEach((r, i) => { const tr = document.createElement('tr'); r.forEach((v, j) => { const td = document.createElement(i === 0 || j === 0 ? 'th' : 'td'); td.textContent = v; tr.append(td); }); tb.append(tr); });
  resultEl.append(tb); resultEl.hidden = false;
  showResult();
}
// 結果在賽道下面：手機上捲一下讓它看得到（賽道還留在畫面上方）
// 全螢幕的時候（garage.css 的 body.fs）：跑的時候（進場、燈樹、跑）下面那片收起來，起步、換檔、氮氣才按得到；ms＝過一下再換
function raceLive(on, ms = 0) {
  clearTimeout(raceLive.t);
  if (ms) raceLive.t = setTimeout(() => raceLive(on), ms); else document.body.classList.toggle('race-live', on);
}
function showResult() { setTimeout(() => { if (!resultEl.hidden) resultEl.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }); }, 1300); }

// ---- 每一幀 ----
function hudIdle() { clockEl.textContent = '0.000'; spdEl.textContent = '0'; for (const e of treeEls) e.className = e.dataset.k; drawTach(0.14, 'N'); pMe.style.left = '0%'; pOpp.style.left = '0%'; goBtn.disabled = true; nitroBtn.disabled = true; goBtn.textContent = '起步'; }
function lights(n, green, red) { // 燈樹：HUD＋賽道上那棵
  treeEls.forEach((e, i) => { e.className = e.dataset.k + ((i < 3 && i < n) || (i === 3 && green) || (i === 4 && red) ? ' on' : ''); });
  const B = TR.bulbs, set = (m, on, col) => m.material.color.set(on ? col : 0x222222);
  for (const lane of [0, 1]) {
    B.amber[lane].forEach((m, i) => set(m, i < n && !green, new THREE.Color(3, 1.9, 0.2)));
    B.green[lane].forEach((m) => set(m, green, new THREE.Color(0.3, 3, 0.9)));
    B.red[lane].forEach((m) => set(m, red && lane === 0, new THREE.Color(3, 0.25, 0.2)));
  }
}
function drawTach(x, gear) {
  const d = Math.min(2, devicePixelRatio || 1), W = tachEl.clientWidth || 120, H = tachEl.clientHeight || 72;
  if (tachEl.width !== Math.round(W * d)) { tachEl.width = Math.round(W * d); tachEl.height = Math.round(H * d); }
  const g = tachEl.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H - 8, R = Math.min(W / 2 - 6, H - 14), A0 = Math.PI, A1 = Math.PI * 2, MAX = 1.05;
  const ang = (v) => A0 + ((A1 - A0) * Math.min(MAX, Math.max(0, v))) / MAX;
  const arc = (a, b, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, R, ang(a), ang(b)); g.stroke(); };
  arc(0, MAX, 'rgba(255,255,255,0.16)', 7); arc(GREEN[0], GREEN[1], '#3ddc84', 7); arc(GREEN[1], MAX, '#ff3b30', 7);
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) { const a = ang(i / 10); g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9)); g.lineTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); g.stroke(); }
  const a = ang(x);
  // 指針用主色
  g.strokeStyle = drawTach.ac ||= getComputedStyle(hudEl).getPropertyValue('--accent').trim() || '#FF6A1F'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); g.stroke();
  g.fillStyle = '#F2F3F5'; g.font = '700 24px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(String(gear), cx, cy - 6);
}
function raceFrame(now) {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (rcam.userData.w !== w || rcam.userData.h !== h) { rcam.aspect = w / h; rcam.updateProjectionMatrix(); rcam.userData.w = w; rcam.userData.h = h; }
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now;
  const R = race, me = R.me, op = R.opp;
  R.t += dt;
  if (R.net) netDragTick(R, dt); // 一起比賽：綠燈照大家約好的時間
  // 燈樹：進場 1.6 秒 → 隨機等一下 → 三個黃燈每 0.5 秒亮一個 → 綠燈
  if (R.phase === 'intro' && R.t > 1.6 && !R.net) { R.phase = 'stage'; R.stageT = R.t; R.greenAt = R.t + 1.0 + Math.random() * 0.9 + 1.5; toast('準備', 800); }
  if (R.phase === 'stage') {
    const n = Math.max(0, Math.min(3, Math.floor((R.t - (R.greenAt - 1.5)) / 0.5) + 1));
    lights(R.t >= R.greenAt - 1.5 ? n : 0, false, false);
    goBtn.disabled = false;
    if (R.t >= R.greenAt) { R.phase = 'run'; R.green = R.t; lights(3, true, false); }
  }
  if (R.phase === 'run' || R.phase === 'done' || R.phase === 'stage' || R.phase === 'intro') {
    if (op && (R.phase === 'run' || (R.phase === 'done' && !R.foul))) { // 對手：反應時間、換檔點、氮氣時機有點隨機
      const ai = R.ai;
      if (op.go == null && R.t - R.green >= ai.react) launch(op);
      if (op.go != null && op.fin == null) {
        if (op.shiftT <= 0 && op.gear < 5 && op.rpm >= ai.shiftAt) { if (shift(op)) snd.op?.shift(); ai.shiftAt = ai.d.shift[0] + Math.random() * (ai.d.shift[1] - ai.d.shift[0]); }
        if (ai.nitroAt != null && !op.nitroUsed && R.t - op.go > ai.nitroAt) useNitro(op);
      }
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 240))), hs = dt / steps;
    for (let i = 0; i < steps; i++) { R.ts = R.t - dt + (i + 1) * hs; stepRacer(me, hs, R); if (op) stepRacer(op, hs, R); }
    if (R.phase === 'run' && op && me.fin != null && (op.fin != null || R.t - R.green - me.fin > 4)) finishRace();
    if (R.phase === 'run' && op && me.go == null && op.fin != null && R.t - R.green > op.fin + 2) finishRace();
  }
  ghDragFrame(R); // 鬼影車：錄你的、播鬼影的
  if (R.net) netDragFrame(R); // 一起比賽：朋友的車（照他送來跑多遠）、跑完了沒
  // 引擎聲：起跑線上踩著等（起步控制頂在 0.6）、跑的時候全油門、換檔和過終點放油門；對手離越遠越小聲
  const feed = (v, c) => v?.set({ rpm: c.rpm, speed: c.v, limit: c.go == null ? 0.6 : 1,
    throttle: c.go == null ? (R.phase === 'stage' || R.phase === 'run' ? 1 : 0) : c.fin != null || c.shiftT > 0 ? 0 : 1 });
  if (R.phase === 'idle') { snd.me?.set({ rpm: 0.13, throttle: 0 }); snd.op?.set({ rpm: 0.13, throttle: 0 }); snd.op?.setGain(0.5); }
  else { feed(snd.me, me); if (op) { feed(snd.op, op); snd.op?.setGain(0.5 / (1 + Math.abs(op.x - me.x) / 25)); } }
  // 車子位置、輪子、影子、氮氣火焰
  const pairs = [[R.meS, me, LANE, R.meInfo], [R.oppS, op || R.park, -LANE, R.oppInfo]];
  pairs.forEach(([Sx, c, z, info], k) => {
    if (!Sx || !c) { TR.shadows[k].visible = false; TR.flames[k].visible = false; return; }
    putCar(Sx, c, z, info); setWheels(Sx, c);
    const shd = TR.shadows[k]; shd.visible = true; shd.position.set(c.x - info.nose + (info.nose + info.tail) / 2, 0.006, z); shd.scale.set(info.len / 4.6, 1, 1);
    const fl = TR.flames[k]; fl.visible = c.nitro > 0 && c.fin == null;
    if (fl.visible) { const j = 0.75 + Math.random() * 0.5; fl.position.set(c.x - info.nose + info.tail + 0.04, 0.34, z); fl.scale.set(j, 0.85 + j * 0.2, 0.85 + j * 0.2); }
  });
  // 鏡頭：位置用「相對你的車」的偏移，車子再快也不會落後；等待和比完時在車子外側來回擺（不會被燈樹擋住）
  const base = new THREE.Vector3(me.x - R.meInfo.nose, 0, LANE);
  // 直的長畫面（手機全螢幕，寬÷高 0.9 以下；0.45 以下算到底）：視角放大、繞著車子中間轉、圈大一點，跑的時候往對手那邊看一點，左右才放得下（方的、橫的畫面照舊）
  //   跑的時候鏡頭還是在你的車道這邊（兩條車道中間有燈樹，鏡頭擺中間會撞進燈樹）
  const tk = Math.min(1, Math.max(0, 0.9 - rcam.aspect) / 0.45), fov0 = 55 + 22 * tk, far = 1 + 0.3 * tk, oc = 1.2 * (1 - tk);
  const orbit = (r, y) => { const a = Math.PI / 2 + 1.15 * Math.sin(orbitA); return [new THREE.Vector3(oc + Math.cos(a) * r, y, Math.sin(a) * r), new THREE.Vector3(oc, 0.5, 0)]; };
  let off, aim, fov = fov0;
  if (R.phase === 'idle') { orbitA += dt * 0.3; [off, aim] = orbit(7.5 * far, 2.6); } // 高一點，從護欄上面看得到整台車
  else if (R.phase === 'done' && R.t - R.doneT > 1.2) { orbitA += dt * 0.22; [off, aim] = orbit(8 * far, 2.8); }
  else {
    const v = me.v, back = 6.4 + Math.max(0, 1.4 - rcam.aspect) * 4; // 畫面窄（手機）就退後一點，兩台車都看得到
    off = new THREE.Vector3(-back - v * 0.03, 1.75 + v * 0.004 + 0.4 * tk, -1.1); aim = new THREE.Vector3(8, 0.75, LANE * 0.3 - LANE - 1.55 * tk);
    fov = fov0 + Math.min(12, v * 0.12) + (me.nitro > 0 ? 5 : 0);
    if (R.phase === 'intro') { // 從起跑線前面旁邊看兩台車，再滑到車後面
      const k = Math.min(1, R.t / 1.6), e = k * k * (3 - 2 * k);
      off = new THREE.Vector3(9 * far, 1.5, 5.1 * far).lerp(off, e); aim = new THREE.Vector3(1.2, 0.6, -LANE).lerp(aim, e);
    }
  }
  const follow = R.phase === 'run' || R.snap ? 1 : Math.min(1, dt * 3);
  if (R.snap || !R.off) { R.off = off.clone(); R.aim = aim.clone(); rcam.fov = fov; R.snap = false; }
  R.off.lerp(off, follow); R.aim.lerp(aim, follow);
  rcam.position.copy(base).add(R.off);
  if (R.phase === 'run' && !calm) rcam.position.y += Math.sin(R.t * 40) * Math.min(0.012, me.v * 0.0002); // 高速有點抖
  // 全螢幕：下面拉上來那片（成績、選對手）蓋住的地方不算，車子擺在上面露出來那塊的中間（畫面往上移一半，慢慢移）
  const cover = document.body.classList.contains('fs') && !document.body.classList.contains('race-live') && !raceEl.hidden ? raceEl.offsetHeight : 0;
  R.lift = R.lift == null ? cover / 2 : R.lift + (cover / 2 - R.lift) * Math.min(1, dt * 5);
  if (R.lift > 0.5) rcam.setViewOffset(w, h, 0, R.lift, w, h); else if (rcam.view?.enabled) rcam.clearViewOffset();
  rcam.fov += (fov - rcam.fov) * Math.min(1, dt * 4); rcam.updateProjectionMatrix();
  rcam.lookAt(base.add(R.aim));
  // HUD
  const tt = R.green == null ? 0 : me.fin != null ? me.fin : Math.max(0, (R.phase === 'done' ? R.doneT : R.t) - R.green);
  clockEl.textContent = tt.toFixed(3);
  spdEl.textContent = String(Math.round(me.v * 3.6));
  pMe.style.left = `${Math.min(100, (me.x / RACE_M) * 100)}%`; if (op) pOpp.style.left = `${Math.min(100, (op.x / RACE_M) * 100)}%`;
  drawTach(me.rpm, me.go == null ? 'N' : me.gear + 1);
  renderer.render(TR.scene, rcam);
}
goBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pressGo(); });
nitroBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pressNitro(); });
document.addEventListener('keydown', (e) => {
  if (!RACE.on) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); pressGo(); }
  if (e.code === 'KeyN') pressNitro();
});
$('raceGo').addEventListener('click', startRace); // 「開回村子」「直接回車庫」在 town.src.js
