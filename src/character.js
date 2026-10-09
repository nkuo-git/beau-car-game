// ---- 角色（第 2 批）：你自己（自訂角色）和村子裡的居民；全部用程式做的低多邊形「真人」 ----
// Nick 2026-09-28：「⋯人要可以下車走來走去⋯要有居民也要有別人在開車⋯可以自訂角色⋯城市做越真越好」
// 看起來像真人（不是方塊人、不是木頭人）：頭、臉（眼白、虹膜、瞳孔、眉毛、鼻子、嘴唇、耳朵）、脖子、有大拇指的手、
//   衣服有領子、袖口、下擺、縫線、陰影，頭髮是真的形狀；沒有下載任何模型、圖片（貼圖是 canvas 畫的）
// 【API】跟 b2-contract/charstub.js 一模一樣（直接換掉替身就好）；多出來的東西前面標「＋」
//   buildCharacter(look = {}, opts = {}) → C
//     C.group       THREE.Group：腳底在 y = 0、臉朝本地 +x（跟車子一樣，rotation.y＝heading）；裡面是一個 SkinnedMesh（大家共用同一個材質）＋腳下淡淡的圓影子
//     C.height      公尺（＝look.height：頭頂，不算帽子、頭髮）；C.radius：碰撞圓柱的半徑
//     C.look        現在完整的樣子（沒給的欄位是預設）
//     C.setLook(p)  只給要換的欄位：只換顏色＝重新上色（不重做）；換衣服、髮型、鞋子⋯＝只重做那幾塊；性別、年紀、身高、身材＝整個重做
//     C.update(dt, { speed = 0, state })   每格叫一次（不會 new 任何東西）
//       speed       公尺／秒：步伐照速度走，腳踩在地上不會滑；group 原地轉彎的時候踩著的腳也不動（會自己換腳踏步）
//       state       不給＝維持現在的；'getup' 1.2 秒、'punch' 0.45 秒、'wave' 1.5 秒播完會自己回 'idle'（播的時候只有 'fall'、'sit' 可以打斷）
//       ＋ dir       要 'fall' 的時候往哪邊倒：數字＝本地角度（0 往前趴、π 往後躺（預設）、正的往左）｜世界方向 { x, z }（例如撞過來那台車的速度）
//       ＋ weapon    'aim'／'shoot' 拿什麼：'pistol' 手槍（單手，預設）｜'long' 長槍（兩手）
//       ＋ aimPitch  'aim'／'shoot' 槍口往上幾弧度（負＝往下；大約 −0.6～0.8）
//       ＋ support   長槍：左手扶在右手前面幾公尺（預設 0.32）
//       ＋ hands     'sit' 的時候手放哪：'lap' 放腿上（預設）｜'bars' 機車把手（右手 [0.62, 0.8, 0.3]、左手 z 相反）｜'wheel' 方向盤｜[x, y, z]（本地公尺，右手；左手 z 相反）
//                    手搆不到的時候身體會往前傾（最多 0.9 弧度）
//     C.state       現在的狀態
//     C.dispose()   從場景拿掉、釋放幾何（材質、貼圖大家共用，不會釋放）
//   state：'idle' 站 | 'walk' 走 | 'run' 跑 | 'sit' 坐（屁股 0.45 公尺高）| 'fall' 倒下、躺著不動 | 'getup' 爬起來 | 'punch' 右手直拳
//          | 'wave' 右手揮手（替身是左手）| 'talk' 站著聊天 | ＋ 'aim' 拿槍瞄準（speed > 0 會邊走邊瞄）| ＋ 'shoot' 開一槍（瞄準加上 0.25 秒的後座力，播完回 'aim'）
//     躺著（'fall'）的時候要別的狀態：再躺 0.6 秒會自己 'getup'，爬起來再換過去；直接要 'getup' 就馬上爬起來
//   ＋ C.hand      右手的掛點（Object3D，在握起來的拳頭中間）：+x 順著手指（瞄準的時候＝槍口的方向）、+y 大拇指那邊（上）、+z 手背那邊
//                  → 槍的模型：握把放原點、槍管朝 +x、上面朝 +y，直接 C.hand.add(gun)
//   ＋ C.handL     左手的掛點（一樣的方向）；拿長槍的時候左手會自己去扶在右手前面 support 公尺
//   ＋ C.eyes      兩眼中間（Object3D，+x＝看的方向）：第一人稱鏡頭、頭上的名字、對話框
//   ＋ C.lookAt(x, y, z)｜C.lookAt(Vector3)｜C.lookAt(null)   頭轉過去看世界座標的一點（轉不過去就轉到最多）；null＝不看
//   ＋ C.recoil()  再來一次後座力（連發的時候每一發叫一次）
//   ＋ C.onState = (新狀態, 舊狀態) => {}   狀態換的時候叫（包括播完自己回 'idle'）
//   ＋ C.yaw       倒下的時候身體在地上轉了多少（弧度，本地；group 不會被轉）
//   ＋ C.info      { tris, verts, draws, buildMs }；＋ C.mesh、C.bones（29 根，名字：root hips spine chest neck head clavL/R upL/R foreL/R handL/R fingL/R tipL/R thumbL/R
//                  thighL/R shinL/R footL/R toeL/R tail）、C.skeleton
//   opts：{ state: 一開始的狀態（例如 'sit'，第一格直接坐好、不用混）, shadow: false（不要腳下的影子：騎車、開車的時候）, plant: false（腳不固定在地上） }
//   randomLook(rng = Math.random) → look：村子裡的人（上學的學生、上班族、戴斗笠穿雨鞋的農夫、穿白色汗衫藍白拖的阿伯、燙頭髮的阿嬤、小孩、戴安全帽口罩的騎士⋯）
//   CHARACTER_OPTIONS：自訂角色畫面的選項（照畫面順序）[{ key, label, type?, choices: [{ value, label, swatch?, … }] }]
//     type：沒有＝選一個｜'color' 色塊（swatch）｜'range' 身高（min、max、小孩 minKid、maxKid、step）｜'toggle' 口罩；fixedColor：這個選項不用顏色（藍白拖、斗笠）
//   ＋ PLAYER_LOOK：你自己一開始的樣子
//   look：{ body 'm'|'f', age 'kid'|'adult'|'elder', height 公尺（沒給：照年紀、性別的平均）, build 'slim'|'mid'|'big', skin '#hex', face 0|1（兩種長相）,
//           hair 'short'|'buzz'|'side'|'long'|'ponytail'|'bun'|'curly'|'bald'|'perm', hairColor, top 'tee'|'shirt'|'polo'|'hoodie'|'jacket'|'vest'|'undershirt'|'uniform'|'floral', topColor,
//           bottom 'jeans'|'shorts'|'pants'|'skirt'|'track', bottomColor, shoes 'sneakers'|'slippers'|'leather'|'boots', shoesColor,
//           hat 'none'|'cap'|'bucket'|'helmet'|'straw', hatColor, glasses 'none'|'glasses'|'sunglasses', mask true|false, maskColor, seed 整數（頭髮的小變化） }
//   效能：一個人 3.4～4.5 千個三角形（平均 3.9 千）、2 個 draw call（身體＋影子）；材質、貼圖（1024²，程式畫的）全部共用；
//         第一個人會先畫貼圖（手機大概 0.1～0.5 秒）；之後做一個人 3～10 ms（桌機）；update 一個人大概 0.04 ms
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）會拿掉 import、把 export 變成一般宣告、所有檔接在同一個 script 裡：
// 這個檔全部包在一個函式裡，只露出下面幾個名字，不會跟別的檔撞名（跟 village.js、carlod.js 一樣）
export const { buildCharacter, randomLook, CHARACTER_OPTIONS, PLAYER_LOOK } = (() => {
const PI = Math.PI, TAU = PI * 2, D2R = PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gs = (d, s) => { const x = (d * d) / (s * s); return x > 12 ? 0 : Math.exp(-x); }; // 高斯形狀的小凸起（離很遠＝0，省得算 exp）
const sgn = (x) => (x < 0 ? -1 : 1);
const spow = (x, p) => (x < 0 ? -Math.pow(-x, p) : Math.pow(x, p));
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (a, b = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 表格曲線：rows＝[[鍵, 值…], …]（鍵由小到大），中間用 Catmull-Rom（平順、不會有折角）
function curve(rows) {
  const n = rows.length, m = rows[0].length - 1;
  return (y, out) => {
    let i = 0;
    while (i < n - 2 && y > rows[i + 1][0]) i++;
    const p1 = rows[i], p2 = rows[i + 1], p0 = rows[i > 0 ? i - 1 : 0], p3 = rows[i + 2 < n ? i + 2 : n - 1];
    const h = p2[0] - p1[0], t = clamp((y - p1[0]) / h, 0, 1), t2 = t * t, t3 = t2 * t;
    const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = 3 * t2 - 2 * t3, d = t3 - t2;
    const d0 = p2[0] - p0[0] || h, d1 = p3[0] - p1[0] || h;
    for (let k = 1; k <= m; k++) out[k - 1] = a * p1[k] + b * ((p2[k] - p0[k]) / d0) * h + c * p2[k] + d * ((p3[k] - p1[k]) / d1) * h;
    return out;
  };
}
const lin = (rows) => (x) => { // 一維折線（角度 → 值）
  if (x <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) if (x <= rows[i][0]) { const t = (x - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]); return lerp(rows[i - 1][1], rows[i][1], t * t * (3 - 2 * t)); }
  return rows[rows.length - 1][1];
};

// ---- 樣子（look）：預設跟替身 charstub.js 一模一樣 ----
const DEF = { body: 'm', age: 'adult', height: 1.72, build: 'mid', skin: '#e0b48f', hair: 'short', hairColor: '#1b1612', top: 'tee', topColor: '#2f6fd6', bottom: 'jeans', bottomColor: '#2b3a55', shoes: 'sneakers', shoesColor: '#eeeeee', hat: 'none', hatColor: '#222222', glasses: 'none', mask: false, face: 0, maskColor: '#9cc7e4' };
// 你自己一開始的樣子（自訂角色畫面的預設）
const PLAYER_LOOK = { body: 'm', age: 'adult', height: 1.74, build: 'mid', skin: '#dcae88', hair: 'side', hairColor: '#17120f', top: 'tee', topColor: '#e8742c', bottom: 'jeans', bottomColor: '#2a3b5a', shoes: 'sneakers', shoesColor: '#f1f1ee', hat: 'none', hatColor: '#1d2a44', glasses: 'none', mask: false, face: 0, maskColor: '#9cc7e4' };
const ONCE = { getup: 1.2, punch: 0.45, wave: 1.5 }; // 播一次就自己回 idle（秒數跟替身一樣）

// ---- 骨頭：29 根（手指 3 根一組、馬尾 1 根、腳趾各 1 根）；本地座標 x 往前（臉朝的方向）、y 往上、z 往右 ----
const BN = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'upL', 'foreL', 'handL', 'fingL', 'tipL', 'thumbL', 'clavR', 'upR', 'foreR', 'handR', 'fingR', 'tipR', 'thumbR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'tail', 'toeL', 'toeR'];
const B = Object.fromEntries(BN.map((n, i) => [n, i]));
const NB = BN.length;
const PARENT = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 9, 10, 9, 3, 13, 14, 15, 16, 17, 16, 1, 20, 21, 1, 23, 24, 5, 22, 25];
const ORDER = BN.map((n) => (/^(up|fore|hand|fing|tip|thumb|thigh|shin|foot|toe)/.test(n) ? 'ZXY' : 'YXZ'));

// ---- 身體比例：身高的幾倍（成人：成年男生 1.72 公尺量的；小孩：8 歲左右 1.3 公尺）----
const PROP = {
  adult: { hips: 0.552, hipJ: 0.51, hipZ: 0.05, knee: 0.285, ankle: 0.045, spine: 0.599, chest: 0.698, neckBase: 0.842, shY: 0.8, shZ: 0.106, upper: 0.172, fore: 0.148, palm: 0.055, finger: 0.047, foot: 0.148, waist: 0.595 },
  kid: { hips: 0.535, hipJ: 0.49, hipZ: 0.052, knee: 0.28, ankle: 0.05, spine: 0.582, chest: 0.672, neckBase: 0.812, shY: 0.776, shZ: 0.1, upper: 0.166, fore: 0.14, palm: 0.055, finger: 0.045, foot: 0.15, waist: 0.58 },
};
// 軀幹一圈一圈：[y／身高, 中心 x, 半寬 w（左右）, 前 df, 後 db]（公尺，成年男生 1.72、中等身材）
const TORSO_M = [
  [0.462, -0.010, 0.140, 0.080, 0.088],
  [0.49, -0.012, 0.163, 0.090, 0.104],
  [0.525, -0.008, 0.172, 0.095, 0.106],
  [0.56, -0.002, 0.160, 0.097, 0.096],
  [0.595, 0.004, 0.146, 0.099, 0.088],
  [0.64, 0.008, 0.150, 0.101, 0.092],
  [0.695, 0.012, 0.160, 0.108, 0.098],
  [0.745, 0.010, 0.171, 0.104, 0.100],
  [0.785, 0.003, 0.180, 0.094, 0.097],
  [0.806, -0.005, 0.183, 0.082, 0.089],
  [0.816, -0.011, 0.172, 0.073, 0.081],
  [0.826, -0.016, 0.143, 0.066, 0.074],
  [0.835, -0.021, 0.104, 0.061, 0.067],
  [0.842, -0.024, 0.070, 0.058, 0.062],
  [0.852, -0.026, 0.050, 0.050, 0.050],
];
// 手臂：[s／臂長（肩關節 0 → 手腕 1）, rx 前後, rz 左右, cz 往外]
const ARM_M = [
  [-0.066, 0.006, 0.006, -0.012],
  [-0.058, 0.026, 0.027, -0.009],
  [-0.042, 0.040, 0.043, -0.004],
  [-0.018, 0.049, 0.053, 0.002],
  [0.04, 0.051, 0.055, 0.005],
  [0.12, 0.047, 0.049, 0.004],
  [0.25, 0.044, 0.044, 0.002],
  [0.42, 0.039, 0.038, 0.0],
  [0.545, 0.036, 0.036, 0.0],
  [0.62, 0.040, 0.039, 0.0],
  [0.76, 0.034, 0.033, 0.0],
  [0.9, 0.027, 0.027, 0.0],
  [1.0, 0.028, 0.020, 0.0],
  [1.04, 0.027, 0.019, 0.0],
];
// 腿：[s／腿長（髖關節 0 → 腳踝 1）, rx 前後, rz 左右, cx 往前, cz 往外]
const LEG_M = [
  [-0.11, 0.010, 0.010, -0.004, 0.0],
  [-0.08, 0.060, 0.058, -0.006, 0.006],
  [-0.03, 0.085, 0.082, -0.008, 0.010],
  [0.03, 0.091, 0.086, -0.008, 0.012],
  [0.12, 0.086, 0.080, -0.005, 0.008],
  [0.25, 0.078, 0.071, -0.002, 0.004],
  [0.38, 0.066, 0.060, 0.002, 0.001],
  [0.46, 0.057, 0.054, 0.005, 0],
  [0.49, 0.055, 0.052, 0.006, 0],
  [0.54, 0.054, 0.050, 0.0, 0],
  [0.61, 0.058, 0.052, -0.010, 0],
  [0.71, 0.051, 0.046, -0.008, 0],
  [0.83, 0.039, 0.037, -0.004, 0],
  [0.93, 0.032, 0.032, -0.002, 0],
  [1.0, 0.030, 0.034, 0.0, 0],
  [1.05, 0.029, 0.033, 0.0, 0],
];
// 頭（參考：成年男生，頭頂到下巴 0.224）：[Y（眼睛那條線上下）, 中心 x, 半寬 W, 前 Df, 後 Db, 前面的形狀 pf（大＝平）]
const HEAD_M = [
  [-0.113, 0.030, 0.0, 0.0, 0.0, 2],
  [-0.110, 0.028, 0.020, 0.036, 0.030, 2],
  [-0.105, 0.021, 0.033, 0.060, 0.036, 2.2],
  [-0.097, 0.015, 0.043, 0.076, 0.040, 2.3],
  [-0.085, 0.010, 0.052, 0.085, 0.044, 2.2],
  [-0.070, 0.008, 0.059, 0.089, 0.050, 2.1],
  [-0.055, 0.006, 0.065, 0.091, 0.058, 2.0],
  [-0.040, 0.004, 0.070, 0.093, 0.070, 2.0],
  [-0.022, 0.002, 0.075, 0.095, 0.084, 2.0],
  [0.000, 0.000, 0.077, 0.097, 0.093, 2.0],
  [0.020, -0.002, 0.078, 0.099, 0.098, 2.1],
  [0.045, -0.004, 0.078, 0.097, 0.099, 2.2],
  [0.068, -0.006, 0.075, 0.088, 0.096, 2.2],
  [0.088, -0.008, 0.067, 0.072, 0.086, 2.1],
  [0.104, -0.010, 0.051, 0.050, 0.064, 2.0],
  [0.113, -0.011, 0.030, 0.028, 0.038, 2.0],
  [0.117, -0.012, 0.0, 0.0, 0.0, 2],
];
// 臉的位置（參考頭的公尺）：眼睛、眉毛、鼻子、嘴巴、下巴；畫臉的貼圖跟做頭的形狀用同一份
const FACE_M = { eyeX: 0.032, eyeW: 1, browY: 0.018, noseTop: 0.006, noseTip: -0.037, noseBase: -0.047, nose: 0.021, noseW: 0.0105, mouth: -0.068, lipW: 0.024, lip: 1, chin: -0.098, chinB: -0.107, brow: 0.0035, cheek: 1, crown: 0.117 };
// 髮際線（|方位角| 度 → Y）
const HAIRLINE = {
  m: lin([[0, 0.066], [25, 0.066], [45, 0.058], [60, 0.046], [70, 0.026], [78, -0.006], [86, 0.002], [96, 0.012], [108, -0.012], [122, -0.036], [145, -0.052], [180, -0.058]]),
  f: lin([[0, 0.064], [30, 0.062], [50, 0.052], [63, 0.036], [74, 0.018], [84, 0.004], [96, 0.01], [110, -0.02], [130, -0.042], [180, -0.056]]),
};
// 頭的種類：男、女、小孩（小孩的臉比較短、頭殼比較大）
function headKind(fem, kid) {
  const faceK = kid ? 0.78 : fem ? 0.945 : 1, cranK = kid ? 1.07 : 1, key = kid ? 'k' : fem ? 'f' : 'm';
  if (HEAD_KINDS[key]) return HEAD_KINDS[key];
  const rows = HEAD_M.map(([Y, xc, W, Df, Db, pf]) => {
    const y = Y < 0 ? Y * faceK : Y * cranK, low = sstep(-0.02, -0.09, Y); // low：下巴那邊
    const wk = (kid ? 0.99 - 0.06 * low : fem ? 0.97 - 0.04 * low : 1), dk = kid ? (Y < 0 ? 0.96 : 1.02) : fem ? 0.98 : 1;
    return [y, xc * (Y < 0 ? faceK : 1), W * wk, Df * dk, Db * (kid ? 1.03 : 1), pf];
  });
  const F = { ...FACE_M };
  for (const k of ['noseTop', 'noseTip', 'noseBase', 'mouth', 'chin', 'chinB']) F[k] = FACE_M[k] * faceK;
  F.crown = FACE_M.crown * cranK;
  if (kid) Object.assign(F, { eyeX: 0.0295, eyeW: 1.08, nose: 0.012, noseW: 0.0095, lipW: 0.019, brow: 0.001, cheek: 1.2 });
  else if (fem) Object.assign(F, { eyeX: 0.0312, eyeW: 1.02, nose: 0.018, noseW: 0.0095, lipW: 0.0225, brow: 0.0016, lip: 1.15 });
  const hl = HAIRLINE[fem ? 'f' : 'm'];
  return (HEAD_KINDS[key] = { key, tab: curve(rows), F, faceK, cranK, hairline: (deg) => { const y = hl(deg); return y < 0 ? y * faceK : y * cranK; } });
}
const HEAD_KINDS = {};
// 頭一圈的方位角（前面密、後面疏）
const HEAD_PHI = [-156, -128, -104, -84, -66, -52, -40, -29, -19, -10, -4, 0, 4, 10, 19, 29, 40, 52, 66, 84, 104, 128, 156, 180].map((d) => d * D2R);
const TORSO_PHI = [-156, -132, -114, -98, -83, -68, -53, -38, -23, -10, 0, 10, 23, 38, 53, 68, 83, 98, 114, 132, 156, 180].map((d) => d * D2R);
const LIMB_PHI_C = {}, LIMB_PHI = (n) => LIMB_PHI_C[n] || (LIMB_PHI_C[n] = Array.from({ length: n }, (_, i) => (i / n) * TAU - PI));

// ---- 量身體：look → 骨頭位置、各部位的尺寸（公尺）----
function measure(L) {
  const kid = L.age === 'kid', eld = L.age === 'elder', fem = L.body === 'f';
  const H = clamp(+L.height || 1.7, 0.9, 2.3), s = H / 1.72, P = kid ? PROP.kid : PROP.adult;
  const bw = { slim: 0.9, mid: 1, big: 1.13 }[L.build] || 1; // 胖瘦
  const hk = headKind(fem, kid);
  const hs = kid ? Math.pow(H / 1.3, 0.45) * 0.97 : (fem ? 0.955 * Math.pow(H / 1.6, 0.5) : Math.pow(H / 1.72, 0.5)) * 1.04; // 頭的大小（跟身高不成正比）
  const M = { L, H, s, kid, eld, fem, bw, hk, hs };
  M.eyeY = H - hk.F.crown * hs; M.headX = 0.004 * s;
  M.chinY = M.eyeY + hk.F.chinB * hs;
  M.hipsY = P.hips * H; M.hipJY = P.hipJ * H; M.hipZ = P.hipZ * H * (fem ? 1.07 : 1) * (0.94 + 0.06 * bw);
  M.kneeY = P.knee * H; M.ankleY = P.ankle * H; M.thigh = M.hipJY - M.kneeY; M.shin = M.kneeY - M.ankleY;
  M.spineY = P.spine * H; M.chestY = P.chest * H; M.waistY = P.waist * H;
  M.neckBaseY = Math.min(P.neckBase * H, M.chinY - 0.03 * s);
  M.shY = P.shY * H; M.shZ = P.shZ * H * (fem ? 0.915 : 1) * (0.95 + 0.05 * bw) * (kid ? 1 : 1);
  M.upper = P.upper * H; M.fore = P.fore * H; M.palm = P.palm * H; M.finger = P.finger * H;
  M.footLen = P.foot * H * (fem ? 0.95 : 1); M.heelBack = 0.2 * M.footLen; M.ballFwd = 0.55 * M.footLen; M.toeFwd = 0.8 * M.footLen;
  M.headPivot = [M.headX - 0.014 * hs, M.eyeY - 0.05 * hs]; // 頭的關節（頭骨底下）
  M.neckX = -0.026 * s; M.neckR = 0.06 * s * (fem ? 0.87 : 1) * (kid ? 0.95 : 1) * (0.92 + 0.08 * bw);
  // 軀幹：照身材、男女改寬度
  const rows = TORSO_M.map(([yf, xc, w, df, db]) => {
    const f = yf; let wk = bw, dfk = bw, dbk = bw;
    if (fem) { wk *= f < 0.54 ? 1.07 : f < 0.62 ? 0.87 : f < 0.72 ? 0.93 : 0.9; dfk *= f > 0.66 && f < 0.76 ? 1.02 : 0.95; dbk *= f < 0.56 ? 1.06 : 0.94; }
    if (kid) { wk *= f < 0.62 ? 1.03 : 0.95; dfk *= f > 0.56 && f < 0.66 ? 1.1 : 1; }
    if (L.build === 'big') { const belly = gs(f - 0.6, 0.06); dfk *= 1 + 0.32 * belly; wk *= 1 + 0.08 * belly; }
    if (L.build === 'slim') { const waist = gs(f - 0.6, 0.05); wk *= 1 - 0.05 * waist; dfk *= 1 - 0.06 * waist; }
    if (eld && L.build !== 'slim') { const belly = gs(f - 0.6, 0.05); dfk *= 1 + 0.12 * belly; }
    if (f > 0.84) { wk = dfk = dbk = 1; } // 脖子那一圈跟著脖子
    return [f * H, xc * s, w * s * wk, df * s * dfk, db * s * dbk];
  });
  const nr = M.neckR * 0.95; rows[rows.length - 1] = [M.neckBaseY + 0.012 * s, M.neckX, nr, nr, nr];
  rows[rows.length - 2][0] = M.neckBaseY; rows[rows.length - 2][1] = M.neckX + 0.002 * s;
  M.torso = curve(rows); M.torsoY0 = rows[0][0]; M.torsoY1 = rows[rows.length - 1][0];
  M.bust = fem && !kid ? 0.022 * s * (0.85 + 0.25 * (bw - 0.9) / 0.23) : 0;
  M.limbK = (fem ? 0.88 : 1) * (kid ? 0.93 : 1) * (bw === 1 ? 1 : bw < 1 ? 0.9 : 1.12) * (eld && !fem ? 0.95 : 1);
  M.arm = curve(ARM_M.map(([f, rx, rz, cz]) => [f, rx * s * M.limbK, rz * s * M.limbK, cz * s]));
  M.leg = curve(LEG_M.map(([f, rx, rz, cx, cz]) => [f, rx * s * M.limbK * (fem && f < 0.3 ? 1.06 : 1), rz * s * M.limbK * (fem && f < 0.3 ? 1.05 : 1), cx * s, cz * s]));
  M.handK = s * (fem ? 0.9 : 1) * (kid ? 1.03 : 1);
  M.footK = s * (fem ? 0.93 : 1);
  return M;
}

// ---- 骨頭（rest pose：站直、手垂在兩邊、手心朝大腿）----
function restBones(M) { // 每根骨頭相對父骨頭的位置 [x, y, z]
  const R = new Float32Array(NB * 3), set = (b, x, y, z) => { R[b * 3] = x; R[b * 3 + 1] = y; R[b * 3 + 2] = z; };
  const W = [0, 0, 0], abs = (b) => { const p = [0, 0, 0]; for (let k = b; k >= 0; k = PARENT[k]) { p[0] += R[k * 3]; p[1] += R[k * 3 + 1]; p[2] += R[k * 3 + 2]; } return p; };
  set(B.root, 0, 0, 0);
  set(B.hips, 0, M.hipsY, 0);
  set(B.spine, -0.01 * M.s, M.spineY - M.hipsY, 0);
  set(B.chest, -0.006 * M.s, M.chestY - M.spineY, 0);
  const chest = abs(B.chest);
  set(B.neck, M.neckX - chest[0], M.neckBaseY - chest[1], 0);
  const neck = abs(B.neck);
  set(B.head, M.headPivot[0] - neck[0], M.headPivot[1] - neck[1], 0);
  for (const [c, u, f, h, g, t, th, sd] of [[B.clavL, B.upL, B.foreL, B.handL, B.fingL, B.tipL, B.thumbL, -1], [B.clavR, B.upR, B.foreR, B.handR, B.fingR, B.tipR, B.thumbR, 1]]) {
    const cx = -0.004 * M.s, cy = M.shY + 0.012 * M.s;
    set(c, cx - chest[0], cy - chest[1], sd * 0.02 * M.s);
    set(u, -0.006 * M.s, M.shY - cy, sd * (M.shZ - 0.02 * M.s));
    set(f, 0, -M.upper, 0);
    set(h, 0, -M.fore, 0);
    set(g, 0, -M.palm * 0.93, 0);
    set(t, 0, -M.finger * 0.52, 0);
    set(th, 0.018 * M.handK, -0.022 * M.handK, -sd * 0.007 * M.handK);
  }
  for (const [t, sh, ft, to, sd] of [[B.thighL, B.shinL, B.footL, B.toeL, -1], [B.thighR, B.shinR, B.footR, B.toeR, 1]]) {
    set(t, 0, M.hipJY - M.hipsY, sd * M.hipZ);
    set(sh, 0, -M.thigh, 0);
    set(ft, 0, -M.shin, 0);
    set(to, M.ballFwd, -M.ankleY, 0); // 腳趾的關節放在前腳掌著地的那一點（腳跟抬起來時鞋頭平貼地面）
    void sd;
  }
  set(B.tail, -0.1 * M.hs, 0.07 * M.hs, 0);
  const A = new Float32Array(NB * 3); // 絕對位置（rest）
  for (let b = 0; b < NB; b++) { const p = abs(b); A[b * 3] = p[0]; A[b * 3 + 1] = p[1]; A[b * 3 + 2] = p[2]; }
  M.rest = R; M.restAbs = A; void W;
  return R;
}

// ---- 網格工具：一個部位做成一段（chunk），屬性先放暫存陣列，做完複製出來 ----
// 角色（顏色從哪裡來）：0 皮膚、1 頭髮、2 上衣、3 褲子／裙子、4 鞋子、5 帽子、6 固定顏色（明暗欄位直接放顏色）
const R_SKIN = 0, R_HAIR = 1, R_TOP = 2, R_BOT = 3, R_SHOE = 4, R_HAT = 5, R_FIX = 6;
let CAP = 0, VN = 0, IN = 0, vP, vN, vU, vR, vS, vG, vI, vW, iB;
function ensure(nv, ni) {
  if (CAP && VN + nv <= CAP && IN + ni <= iB.length) return;
  const cap = Math.max(4096, (VN + nv) * 2), icap = Math.max(cap * 6, (IN + ni) * 2);
  const g = (A, T, k) => { const a = new T(cap * k); if (A) a.set(A.subarray(0, VN * k)); return a; };
  vP = g(vP, Float32Array, 3); vN = g(vN, Float32Array, 3); vU = g(vU, Float32Array, 2); vR = g(vR, Uint8Array, 1); vS = g(vS, Float32Array, 3);
  vG = g(vG, Float32Array, 1); vI = g(vI, Uint8Array, 4); vW = g(vW, Float32Array, 4);
  const ib = new Uint32Array(icap); if (iB) ib.set(iB.subarray(0, IN)); iB = ib; CAP = cap;
}
let cRole = 0, cRough = 0.7; const cS = [1, 1, 1], cBI = [0, 0, 0, 0], cBW = [1, 0, 0, 0];
function wt(b0, w0 = 1, b1 = 0, w1 = 0, b2 = 0, w2 = 0, b3 = 0, w3 = 0) { // 這個點跟著哪些骨頭（權重自動加成 1）
  const t = w0 + w1 + w2 + w3 || 1;
  cBI[0] = b0; cBW[0] = w0 / t; cBI[1] = b1; cBW[1] = w1 / t; cBI[2] = b2; cBW[2] = w2 / t; cBI[3] = b3; cBW[3] = w3 / t;
}
const mat = (role, rough, r = 1, g = r, b = r) => { cRole = role; cRough = rough; cS[0] = r; cS[1] = g; cS[2] = b; };
const shade = (r, g = r, b = r) => { cS[0] = r; cS[1] = g; cS[2] = b; };
function vtx(x, y, z, nx, ny, nz, u, v) {
  ensure(1, 0);
  const i = VN++, i3 = i * 3, i4 = i * 4;
  vP[i3] = x; vP[i3 + 1] = y; vP[i3 + 2] = z;
  const l = Math.hypot(nx, ny, nz) || 1; vN[i3] = nx / l; vN[i3 + 1] = ny / l; vN[i3 + 2] = nz / l;
  vU[i * 2] = u; vU[i * 2 + 1] = v; vR[i] = cRole; vG[i] = cRough;
  vS[i3] = cS[0]; vS[i3 + 1] = cS[1]; vS[i3 + 2] = cS[2];
  for (let k = 0; k < 4; k++) { vI[i4 + k] = cBI[k]; vW[i4 + k] = cBW[k]; }
  return i;
}
function tri(a, b, c) {
  ensure(0, 3);
  const ax = vP[a * 3], ay = vP[a * 3 + 1], az = vP[a * 3 + 2];
  const ux = vP[b * 3] - ax, uy = vP[b * 3 + 1] - ay, uz = vP[b * 3 + 2] - az, wx = vP[c * 3] - ax, wy = vP[c * 3 + 1] - ay, wz = vP[c * 3 + 2] - az;
  const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
  if (cx * cx + cy * cy + cz * cz < 1e-14) return; // 縮成一點、一條線的不要
  iB[IN++] = a; iB[IN++] = b; iB[IN++] = c;
}
function chunkStart() { ensure(64, 64); VN = 0; IN = 0; }
function chunkEnd() {
  const n = VN, ni = IN;
  return { n, ni, pos: vP.slice(0, n * 3), nor: vN.slice(0, n * 3), uv: vU.slice(0, n * 2), role: vR.slice(0, n), shade: vS.slice(0, n * 3), rough: vG.slice(0, n), si: vI.slice(0, n * 4), sw: vW.slice(0, n * 4), idx: iB.slice(0, ni) };
}
// 格子：nu × nv 個點（位置先放在 GP），attr(i, j) 設角色／權重，uv 放 GU、GV；法線用格子的鄰居算；
//   closed：u 方向接成一圈；out：一個在裡面的點 [x, y, z]（或 (j) → 點），用來確定法線朝外（不然整片翻過來）
let GP = new Float32Array(3 * 64 * 64), GU = 0, GV = 0;
const gpSize = (n) => { if (GP.length < n * 3) GP = new Float32Array(n * 3); };
function gridEmit(nu, nv, closed, attr, inside, invert) {
  const base = VN, P = GP;
  ensure(nu * nv, nu * nv * 6);
  const nrm = [0, 0, 0];
  let flip = 0, votes = 0;
  const normAt = (i, j) => {
    const i0 = i > 0 ? i - 1 : closed ? nu - 1 : i, i1 = i < nu - 1 ? i + 1 : closed ? 0 : i;
    const j0 = j > 0 ? j - 1 : j, j1 = j < nv - 1 ? j + 1 : j;
    const a = (j * nu + i0) * 3, b = (j * nu + i1) * 3, c = (j0 * nu + i) * 3, d = (j1 * nu + i) * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[d] - P[c], vy = P[d + 1] - P[c + 1], vz = P[d + 2] - P[c + 2];
    nrm[0] = vy * uz - vz * uy; nrm[1] = vz * ux - vx * uz; nrm[2] = vx * uy - vy * ux;
    return Math.hypot(nrm[0], nrm[1], nrm[2]);
  };
  // 先看法線大多朝外還是朝裡
  if (inside) {
    for (let j = 0; j < nv; j += Math.max(1, nv >> 2)) for (let i = 0; i < nu; i += Math.max(1, nu >> 3)) {
      if (normAt(i, j) < 1e-12) continue;
      const k = (j * nu + i) * 3, c = typeof inside === 'function' ? inside(j) : inside;
      votes += (P[k] - c[0]) * nrm[0] + (P[k + 1] - c[1]) * nrm[1] + (P[k + 2] - c[2]) * nrm[2] > 0 ? 1 : -1;
    }
    flip = votes < 0 ? 1 : 0;
  }
  if (invert) flip ^= 1; // 反過來（例如頭髮裡面那層：看得到的是朝頭的那面）
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = (j * nu + i) * 3;
    let l = normAt(i, j);
    if (l < 1e-12) { // 縮成一點（頭頂、手指尖）：用旁邊那一圈的平均方向
      const jj = j > 0 ? j - 1 : j + 1, c = typeof inside === 'function' ? inside(j) : inside || [0, 0, 0];
      nrm[0] = P[k] - c[0]; nrm[1] = P[k + 1] - c[1]; nrm[2] = P[k + 2] - c[2];
      if (Math.hypot(nrm[0], nrm[1], nrm[2]) < 1e-9) { const q = (jj * nu + i) * 3; nrm[0] = P[k] - P[q]; nrm[1] = P[k + 1] - P[q + 1]; nrm[2] = P[k + 2] - P[q + 2]; }
      l = 1; flip && (nrm[0] = -nrm[0], nrm[1] = -nrm[1], nrm[2] = -nrm[2]);
    }
    const f = flip ? -1 : 1;
    attr(i, j);
    vtx(P[k], P[k + 1], P[k + 2], nrm[0] * f, nrm[1] * f, nrm[2] * f, GU, GV);
  }
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < (closed ? nu : nu - 1); i++) {
    const i1 = i + 1 < nu ? i + 1 : 0;
    const a = base + j * nu + i, b = base + j * nu + i1, c = base + (j + 1) * nu + i1, d = base + (j + 1) * nu + i;
    if (flip) { tri(a, b, c); tri(a, c, d); } else { tri(a, c, b); tri(a, d, c); }
  }
  return base;
}
const gset = (i, x, y, z) => { GP[i * 3] = x; GP[i * 3 + 1] = y; GP[i * 3 + 2] = z; };

// ---- 權重：一個點最多跟 4 根骨頭（加起來 1）----
const WA = new Float32Array(NB), WL = [];
function wAdd(b, w) { if (w > 1e-4) { if (WA[b] === 0) WL.push(b); WA[b] += w; } }
function wFlush() {
  if (!WL.length) wAdd(B.hips, 1);
  WL.sort((a, b) => WA[b] - WA[a]);
  let t = 0; for (let k = 0; k < 4 && k < WL.length; k++) t += WA[WL[k]];
  for (let k = 0; k < 4; k++) { if (k < WL.length) { cBI[k] = WL[k]; cBW[k] = WA[WL[k]] / t; } else { cBI[k] = 0; cBW[k] = 0; } }
  for (const b of WL) WA[b] = 0; WL.length = 0;
}

// ---- 衣服、褲子、鞋子、帽子、頭髮的種類 ----
// 上衣：off＝離身體多厚、hem＝下擺（身高的比例；tuck＝紮進褲子）、sleeve＝袖子到上臂的幾成（'long' 到手腕、0 無袖）、neck＝領口
const TOPS = {
  tee: { off: 0.007, hem: 0.478, sleeve: 0.46, neck: 'crew' },
  shirt: { off: 0.008, tuck: true, sleeve: 'long', neck: 'collar', cuff: 1 },
  polo: { off: 0.0075, hem: 0.476, sleeve: 0.48, neck: 'polo', rib: 1 },
  hoodie: { off: 0.015, hem: 0.49, sleeve: 'long', neck: 'hood', cuff: 2, band: 1 },
  jacket: { off: 0.017, hem: 0.502, sleeve: 'long', neck: 'stand', cuff: 2, band: 1 },
  vest: { off: 0.005, hem: 0.482, sleeve: 0, neck: 'scoop' },
  undershirt: { off: 0.004, hem: 0.49, sleeve: 0, neck: 'deep' },
  uniform: { off: 0.008, tuck: true, sleeve: 0.5, neck: 'collar' },
  floral: { off: 0.009, hem: 0.492, sleeve: 0.56, neck: 'blouse' },
};
// 褲子：off＝骨盆那段、leg＝腿、hem＝褲管到腿的幾成（1＝腳踝）、flare＝褲管口多寬
const BOTTOMS = {
  jeans: { off: 0.006, leg: 0.007, hem: 0.985, flare: 0.004 },
  pants: { off: 0.008, leg: 0.012, hem: 0.985, flare: 0.007, crease: 1 },
  track: { off: 0.011, leg: 0.015, hem: 0.975, flare: 0.0, cuff: 1 },
  shorts: { off: 0.01, leg: 0.013, hem: 0.3, flare: 0.024 },
  skirt: { off: 0.004, leg: 0, hem: 0.08, skirt: 1 },
};
const SHOES = { sneakers: { sole: 0.028 }, slippers: { sole: 0.014 }, leather: { sole: 0.02 }, boots: { sole: 0.026 } };

// ---- 表面：軀幹、手臂、腿、頭（都是 rest pose 的角色座標）----
const TT = new Float64Array(6), AT = new Float64Array(6), HT = new Float64Array(6), Q3 = [0, 0, 0], Q3b = [0, 0, 0], Q3c = [0, 0, 0];
function torsoPt(M, phi, y, o) {
  M.torso(y, TT); const xc = TT[0], w = TT[1], df = TT[2], db = TT[3];
  const c = Math.cos(phi), sn = Math.sin(phi), ex = 0.93, ap = Math.abs(phi), f = y / M.H;
  let x = c >= 0 ? xc + df * Math.pow(c, ex) : xc - db * Math.pow(-c, ex);
  const z = w * spow(sn, ex);
  if (c > 0) {
    if (M.bust) x += M.bust * gs(ap - 0.4, 0.36) * gs(f - 0.712, 0.036);
    else if (!M.kid) x += 0.005 * M.s * gs(ap - 0.45, 0.4) * gs(f - 0.715, 0.03);
  } else {
    x -= 0.02 * M.s * M.bw * (M.fem ? 1.2 : 1) * gs(ap - (PI - 0.48), 0.42) * gs(f - 0.5, 0.03); // 屁股
    x -= 0.006 * M.s * gs(ap - (PI - 0.62), 0.34) * gs(f - 0.765, 0.03); // 肩胛骨
    x += 0.005 * M.s * gs(ap - PI, 0.16) * sstep(0.56, 0.62, f) * sstep(0.83, 0.78, f); // 背中間那條溝
  }
  o[0] = x; o[1] = y; o[2] = z;
}
// 表面往外推 off（沿著法線：用旁邊兩點算）；fn(a, b, out)，center＝在裡面的一點（決定朝外）
function offPt(fn, M, a, b, ea, eb, off, cx, cy, cz, o) {
  fn(M, a, b, o); if (!off) return o;
  fn(M, a + ea, b, Q3b); fn(M, a, b + eb, Q3c);
  const ux = Q3b[0] - o[0], uy = Q3b[1] - o[1], uz = Q3b[2] - o[2], vx = Q3c[0] - o[0], vy = Q3c[1] - o[1], vz = Q3c[2] - o[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  if ((o[0] - cx) * nx + (o[1] - cy) * ny + (o[2] - cz) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  o[0] += nx * off; o[1] += ny * off; o[2] += nz * off;
  return o;
}
const torsoOff = (M, phi, y, off, o) => { M.torso(y, TT); return offPt(torsoPt, M, phi, y, 0.02, 0.004, off, TT[0], y, 0, o); };
// 手臂：sd −1 左、1 右；f＝肩關節 0 → 手腕 1（負的是肩膀的圓頂）
function armPt(M, sd, phi, f, o) {
  const J = M.shJ[sd < 0 ? 0 : 1], La = M.upper + M.fore;
  M.arm(f, AT);
  const cy = J[1] - f * La;
  o[0] = J[0] + AT[0] * Math.cos(phi); o[1] = cy; o[2] = J[2] + sd * (AT[2] + AT[1] * Math.sin(phi));
}
const armOff = (M, sd, phi, f, off, o) => { const J = M.shJ[sd < 0 ? 0 : 1]; return offPt((m, a, b, oo) => armPt(m, sd, a, b, oo), M, phi, f, 0.02, 0.01, off, J[0], J[1] - f * (M.upper + M.fore) - (f < 0 ? 0.02 : 0), J[2] + sd * 0.004, o); };
// 腿：f＝髖關節 0 → 腳踝 1
function legPt(M, sd, phi, f, o) {
  const J = M.hipJ[sd < 0 ? 0 : 1], Ll = M.thigh + M.shin;
  M.leg(f, AT);
  const sn = Math.sin(phi), inner = sn < 0 ? 0.25 * sstep(0.32, 0.05, f) : 0; // 大腿內側上面：兩腿靠在一起（看不到褲襠那個洞）
  o[0] = J[0] + AT[2] + AT[0] * Math.cos(phi); o[1] = J[1] - f * Ll; o[2] = J[2] + sd * (AT[3] + AT[1] * sn * (1 + inner));
}
const legOff = (M, sd, phi, f, off, o) => { const J = M.hipJ[sd < 0 ? 0 : 1]; M.leg(f, AT); return offPt((m, a, b, oo) => legPt(m, sd, a, b, oo), M, phi, f, 0.02, 0.01, off, J[0] + AT[2], J[1] - f * (M.thigh + M.shin) + (f < 0 ? 0.04 : 0), J[2] + sd * AT[3], o); };
// 頭：參考頭的座標（Y＝眼睛那條線上下）→ 角色座標
function headRef(M, phi, Y, o) {
  const K = M.hk, F = K.F; K.tab(Y, HT);
  const xc = HT[0], W = HT[1], Df = HT[2], Db = HT[3], pf = HT[4];
  const c = Math.cos(phi), sn = Math.sin(phi);
  let x, z;
  if (c >= 0) { x = xc + Df * Math.pow(c, 2 / pf); z = W * spow(sn, 2 / pf); } else { x = xc + Db * c; z = W * sn; }
  if (c > 0.05) { // 五官
    const az = Math.abs(z), fw = sstep(0.05, 0.45, c);
    let dx = 0;
    const n0 = F.noseTop, nt = F.noseTip, nb = F.noseBase - 0.006;
    if (Y <= n0 + 0.004 && Y >= nb) {
      const np = Y >= nt ? F.nose * (0.14 + 0.86 * Math.pow(clamp((n0 + 0.004 - Y) / (n0 + 0.004 - nt), 0, 1), 1.6)) : F.nose * (1 - Math.pow((nt - Y) / (nt - nb), 1.8));
      const nw = F.noseW * (Y >= nt ? lerp(0.5, 1, clamp((n0 - Y) / (n0 - nt), 0, 1)) : 1.08);
      dx += np * gs(z, nw);
    }
    dx += F.nose * 0.3 * gs(az - F.noseW * 1.2, F.noseW * 0.55) * gs(Y - (F.noseBase + 0.005), 0.0055); // 鼻翼
    dx -= 0.0055 * gs(az - F.eyeX, 0.015) * gs(Y - 0.002, 0.012); // 眼窩
    dx += 0.0028 * gs(az - F.eyeX, 0.0105 * F.eyeW) * gs(Y + 0.0005, 0.0065); // 眼球、眼皮
    dx += F.brow * gs(az - F.eyeX + 0.004, 0.022) * gs(Y - F.browY, 0.0075); // 眉骨
    dx += 0.004 * F.cheek * gs(az - 0.05, 0.013) * gs(Y + 0.022, 0.013); // 顴骨
    dx += 0.0042 * F.lip * gs(z, F.lipW * 0.72) * gs(Y - (F.mouth + 0.0072), 0.0042); // 上唇
    dx += 0.0046 * F.lip * gs(z, F.lipW * 0.62) * gs(Y - (F.mouth - 0.0065), 0.0045); // 下唇
    dx -= 0.0022 * gs(z, F.lipW * 0.85) * gs(Y - F.mouth, 0.0017); // 嘴巴那條線
    dx += 0.0055 * gs(z, 0.017) * gs(Y - F.chin, 0.0085); // 下巴
    dx -= 0.0018 * gs(z, 0.02) * gs(Y - (F.mouth - 0.016), 0.004);
    x += dx * fw;
    z += sgn(z) * 0.003 * F.cheek * gs(Y + 0.02, 0.014) * gs(Math.abs(phi) - 1.05, 0.25); // 顴骨往外
  }
  o[0] = M.headX + x * M.hs; o[1] = M.eyeY + Y * M.hs; o[2] = z * M.hs;
}

// ---- 部位：每個部位做成一段 chunk ----
// 頭（臉＋耳朵）：臉那段從下巴到髮際線（光頭到頭頂），頭髮那段在 genHair
const FACE_ROWS = [-0.113, -0.105, -0.096, -0.086, -0.077, -0.07, -0.064, -0.057, -0.05, -0.043, -0.035, -0.026, -0.016, -0.007, 0.002, 0.012, 0.024, 0.04, 0.058, 0.076, 0.095, 0.117];
function faceUV(M, phi, Y, zref) { // 臉的貼圖：正面平貼（X＝左右），後腦勺都到貼圖邊邊（沒有畫東西）
  const K = M.hk, T = M.tiles.face;
  M.hk.tab(Y, HT);
  const X = Math.abs(phi) <= PI / 2 ? zref : sgn(zref || phi) * (2 * HT[1] - Math.abs(zref));
  const u = clamp(0.5 + X / 0.16, 0.004, 0.996), v = clamp((Y - (K.F.chinB - 0.011)) / 0.2, 0.004, 0.996);
  GU = T[0] + u * (T[2] - T[0]); GV = T[1] + v * (T[3] - T[1]);
}
function hairlineY(M, phi) { // 這個方位角的髮際線（參考頭的 Y；光頭＝頭頂）
  const st = M.L.hair, K = M.hk, deg = Math.abs(phi) / D2R, F = K.F;
  if (st === 'bald') return F.crown;
  let y = K.hairline(deg);
  const longish = st === 'long' || (st === 'short' && M.fem) || st === 'curly' || st === 'perm';
  if (st === 'side') y -= 0.02 * K.cranK * sstep(-0.35, 0.5, phi) * gs(deg, 40) * 1.2; // 瀏海往右邊撥
  if (st === 'short' && M.fem) { y = deg < 50 ? Math.min(y, 0.035) : deg < 68 ? lerp(0.035, -0.06, sstep(50, 68, deg)) : -0.075 * K.faceK; } // 女生短髮（鮑伯頭）
  if (st === 'long') { y = deg < 42 ? Math.min(y, 0.052) : deg < 62 ? lerp(0.052, -0.07, sstep(42, 62, deg)) : -0.078 * K.faceK; }
  if (st === 'curly') { y = deg < 55 ? Math.min(y, 0.05) : lerp(0.02, -0.055, sstep(60, 110, deg)); }
  if (st === 'perm') { y = deg < 50 ? Math.min(y, 0.056) : lerp(0.03, -0.035, sstep(58, 120, deg)); }
  if (st === 'ponytail' || st === 'bun') y = Math.min(y, K.hairline(deg) + 0.004);
  void longish;
  return y;
}
function genHead(M) {
  chunkStart();
  const K = M.hk, nu = HEAD_PHI.length, rows = FACE_ROWS.map((y) => (y < 0 ? y * K.faceK : y * K.cranK)), nv = rows.length;
  gpSize(nu * nv);
  const Z = new Float32Array(nu * nv), YY = new Float32Array(nu * nv);
  for (let i = 0; i < nu; i++) {
    const phi = HEAD_PHI[i], hl = hairlineY(M, phi);
    for (let j = 0; j < nv; j++) {
      const Y = Math.min(rows[j], hl); headRef(M, phi, Y, Q3);
      gset(j * nu + i, Q3[0], Q3[1], Q3[2]); Z[j * nu + i] = Q3[2] / M.hs; YY[j * nu + i] = Y;
    }
  }
  wt(B.head);
  gridEmit(nu, nv, true, (i, j) => {
    const k = j * nu + i, Y = YY[k], phi = HEAD_PHI[i];
    const ao = 1 - 0.18 * gs(Y - K.F.chinB, 0.012) * sstep(0.2, -0.6, Math.cos(phi)); // 下巴底下暗一點
    mat(R_SKIN, 0.55, ao);
    faceUV(M, phi, Y, Z[k]);
  }, (j) => [M.headX, M.eyeY + (rows[j] < 0 ? rows[j] * 0.3 : rows[j] * 0.5) * M.hs, 0]);
  // 耳朵：兩邊各一片（有厚度，裡面凹一點）
  if (!(M.L.hair === 'long' || (M.L.hair === 'short' && M.fem) || M.L.hat === 'helmet')) for (const sd of [-1, 1]) genEar(M, sd); // 長髮、鮑伯頭、安全帽蓋住耳朵
  return chunkEnd();
}
function genEar(M, sd) {
  const K = M.hk, hs = M.hs, na = 7, nr = 3;
  gpSize(na * nr * 2);
  const top = 0.012 * K.cranK, bot = -0.045 * K.faceK, x0 = -0.004;
  K.tab((top + bot) / 2, HT); const W = HT[1];
  const T = M.tiles.ear;
  wt(B.head);
  for (const side of [0, 1]) { // 0 前面（看得到耳朵裡面）、1 後面
    for (let a = 0; a < na; a++) {
      const t = a / (na - 1), ang = lerp(-0.35, PI + 0.5, t); // 從上前方繞到耳垂
      const ey = lerp(top, bot, 0.5 - 0.5 * Math.cos(ang)) + (t > 0.85 ? -0.003 : 0);
      const ex = x0 - 0.008 - 0.016 * Math.sin(Math.min(ang, PI)) * (t < 0.9 ? 1 : 0.6);
      for (let r = 0; r < nr; r++) {
        const rr = r / (nr - 1), ax = x0 - 0.002 * rr, ay = lerp(top - 0.004, bot + 0.004, t);
        let px = lerp(ax, ex, rr), py = lerp(ay, ey, rr);
        let pz = W - 0.002 + (0.004 + 0.013 * rr * (0.65 + 0.35 * Math.sin(ang * 0.8))) ;
        if (side === 0) pz -= 0.0035 * Math.sin(rr * PI) * (t > 0.1 && t < 0.85 ? 1 : 0.3); // 耳窩
        else pz -= 0.003 + 0.003 * rr;
        gset((side * nr + r) * na + a, M.headX + px * hs, M.eyeY + py * hs, sd * pz * hs);
      }
    }
  }
  const base = VN;
  for (let side = 0; side < 2; side++) {
    const b0 = VN;
    for (let r = 0; r < nr; r++) for (let a = 0; a < na; a++) {
      const k = ((side * nr + r) * na + a) * 3;
      mat(R_SKIN, 0.6, 0.93 - (side === 0 ? 0.1 * Math.sin((r / (nr - 1)) * PI) : 0.05));
      GU = T[0] + (a / (na - 1)) * (T[2] - T[0]); GV = T[1] + ((side ? 1 - r / (nr - 1) : r / (nr - 1)) * 0.5 + side * 0.5) * (T[3] - T[1]);
      vtx(GP[k], GP[k + 1], GP[k + 2], (side ? -0.6 : 0.5) * 1, 0.1, sd * (side ? 0.3 : 1), GU, GV);
    }
    for (let r = 0; r < nr - 1; r++) for (let a = 0; a < na - 1; a++) {
      const p = b0 + r * na + a, q = p + 1, s2 = p + na, t2 = s2 + 1;
      if ((sd > 0) === (side === 0)) { tri(p, s2, q); tri(q, s2, t2); } else { tri(p, q, s2); tri(q, t2, s2); }
    }
  }
  // 耳朵外緣（前後接起來）
  for (let a = 0; a < na - 1; a++) {
    const f0 = base + (nr - 1) * na + a, f1 = f0 + 1, b0 = base + nr * na + (nr - 1) * na + a, b1 = b0 + 1;
    if (sd > 0) { tri(f0, f1, b1); tri(f0, b1, b0); } else { tri(f0, b1, f1); tri(f0, b0, b1); }
  }
}
// 脖子：最下面那圈就是軀幹最上面那圈（同樣的方位角、同樣的權重），接起來沒有縫
function genNeck(M) {
  chunkStart();
  const nu = TORSO_PHI.length, s = M.s, y0 = M.torsoY1, y1 = M.headPivot[1] + 0.035 * M.hs, x1 = M.headPivot[0] + 0.006 * M.hs;
  const TS = [0, 0.3, 0.62, 1], nv = TS.length;
  gpSize(nu * nv);
  M.torso(y0, TT); const x0 = TT[0];
  for (let j = 0; j < nv; j++) {
    const t = TS[j], y = lerp(y0, y1, t), xc = lerp(x0, x1, t), r = M.neckR * (0.985 - 0.06 * t);
    for (let i = 0; i < nu; i++) {
      const p = TORSO_PHI[i];
      if (j === 0) { torsoPt(M, p, y0, Q3); gset(i, Q3[0], Q3[1], Q3[2]); continue; }
      const adam = !M.fem && !M.kid ? 0.006 * s * gs(p, 0.35) * gs(t - 0.55, 0.2) : 0; // 喉結
      gset(j * nu + i, xc + (r * 0.97 + adam) * Math.cos(p), y, r * 1.03 * Math.sin(p));
    }
  }
  gridEmit(nu, nv, true, (i, j) => {
    const t = TS[j], k = (j * nu + i) * 3;
    if (j === 0) torsoWeights(M, y0, GP[k + 2]);
    else { wAdd(B.chest, 0.12 * (1 - t)); wAdd(B.neck, 1 - sstep(0.45, 1, t) * 0.85); wAdd(B.head, sstep(0.45, 1, t) * 0.85); wFlush(); }
    const front = Math.cos(TORSO_PHI[i]);
    mat(R_SKIN, 0.6, 0.97 - 0.22 * sstep(0.3, 1, t) * sstep(-0.2, 0.8, front)); // 下巴底下的影子
    GU = M.tiles.skin[0]; GV = M.tiles.skin[1];
  }, (j) => [lerp(x0, x1, TS[j]), lerp(y0, y1, TS[j]) - 0.01, 0]);
  return chunkEnd();
}
// 領口（上衣到哪裡，上面是皮膚）
function necklineY(M, top, phi) {
  const s = M.s, n = M.neckBaseY, ap = Math.abs(phi), c = Math.cos(phi);
  switch (top.neck) {
    case 'crew': return n - 0.016 * s + 0.018 * s * sstep(0.3, -0.9, c);
    case 'collar': return n - 0.012 * s + 0.016 * s * sstep(0.3, -0.9, c) - 0.05 * s * gs(ap, 0.2);
    case 'blouse': return n - 0.02 * s + 0.018 * s * sstep(0.3, -0.9, c) - 0.05 * s * gs(ap, 0.24);
    case 'polo': return n - 0.013 * s + 0.017 * s * sstep(0.3, -0.9, c) - 0.055 * s * gs(ap, 0.1);
    case 'hood': case 'stand': return n + 0.004 * s;
    case 'scoop': return n - 0.02 * s - 0.05 * s * gs(ap, 0.75) - 0.02 * s * gs(ap - PI, 0.6);
    case 'deep': return n - 0.025 * s - 0.07 * s * gs(ap, 0.7) - 0.035 * s * gs(ap - PI, 0.6) - 0.012 * s * gs(ap - PI / 2, 0.35);
  }
  return n;
}
// cf：這個點的方位角 cos（前面 1、後面 −1；不給＝前面）。屁股後面主要跟著骨盆（坐下、抬腿的時候屁股不會跟著大腿轉進去，衣服、褲子才不會互相穿過）
function torsoWeights(M, y, z, cf = 1) {
  const s = M.s, az = Math.abs(z);
  const a = sstep(M.waistY - 0.05 * s, M.waistY + 0.06 * s, y), b = sstep(M.spineY + 0.03 * s, M.chestY + 0.03 * s, y), c = sstep(M.neckBaseY - 0.015 * s, M.neckBaseY + 0.02 * s, y);
  const sh = sstep(M.shZ * 0.5, M.shZ * 0.95, az) * sstep(M.shY - 0.1 * s, M.shY - 0.01 * s, y) * 0.6 * (1 - c);
  const th = sstep(M.hipJY + 0.02 * s, M.torsoY0, y) * 0.5 * sstep(0.01 * s, M.hipZ * 0.9, az) * lerp(1, 0.2, sstep(-0.15, -0.7, cf));
  wAdd(B.hips, (1 - a) * (1 - th)); wAdd(z < 0 ? B.thighL : B.thighR, (1 - a) * th);
  wAdd(B.spine, a * (1 - b)); wAdd(B.chest, b * (1 - c) * (1 - sh)); wAdd(z < 0 ? B.clavL : B.clavR, b * sh); wAdd(B.neck, c);
  wFlush();
}
// 軀幹：褲子（骨盆那段）、上衣、領口上面的皮膚；下擺、領口的布邊；皮帶
function genTorso(M) {
  chunkStart();
  const L = M.L, top = TOPS[L.top] || TOPS.tee, bot = BOTTOMS[L.bottom] || BOTTOMS.jeans, s = M.s;
  const nu = TORSO_PHI.length, y0 = M.torsoY0, yTop = M.torsoY1;
  const waistTop = M.waistY + (L.bottom === 'jeans' ? -0.012 : 0.004) * s; // 褲頭
  const tucked = !!top.tuck;
  const hemY = tucked ? M.waistY - 0.05 * s : top.hem * M.H;
  const dB = bot.off * s, dT = top.off * s;
  const offTop = (y) => (!tucked ? lerp(dT, Math.max(dT, dB + 0.006 * s), sstep(waistTop + 0.04 * s, waistTop, y)) : y < waistTop + 0.01 * s ? Math.min(dT, dB * 0.4) : dT);
  const TB = M.tiles.bottom, TP = M.tiles.top;
  const ctr = (y) => { M.torso(y, TT); return [TT[0], y, 0]; };
  // 1) 褲子骨盆那段（到褲頭），底下收成一點（褲襠）
  {
    const ys = [y0, lerp(y0, waistTop, 0.33), lerp(y0, waistTop, 0.66), waistTop], nv = ys.length + 1;
    gpSize(nu * nv);
    M.torso(y0, TT); const cx = TT[0];
    for (let i = 0; i < nu; i++) {
      gset(i, cx, y0 - 0.02 * s, 0);
      for (let j = 0; j < ys.length; j++) { torsoOff(M, TORSO_PHI[i], ys[j], j === ys.length - 1 && !tucked ? Math.min(dB, 0.002 * s) : dB, Q3); gset((j + 1) * nu + i, Q3[0], Q3[1], Q3[2]); } // 上衣沒紮：褲頭在衣服裡面，縮進去（不會穿出來）
    }
    const pb = gridEmit(nu, nv, true, (i, j) => {
      const k = (j * nu + i) * 3, y = GP[k + 1];
      torsoWeights(M, y, GP[k + 2], Math.cos(TORSO_PHI[i]));
      // 前面亮一點：跟旁邊的褲管一樣亮（不然褲管穿出來的那條線很明顯，看起來像一件內褲）
      mat(R_BOT, 0.9, (j === 0 ? 0.94 : 1 - 0.03 * sstep(M.hipJY, y0, y)) * (1 + 0.14 * sstep(-0.2, 0.5, Math.cos(TORSO_PHI[i]))));
      const u = Math.abs(TORSO_PHI[i]) / PI, v = j === 0 ? 0 : (y - y0) / (waistTop - y0);
      GU = TB[0] + (0.03 + u * 0.94) * (TB[2] - TB[0]); GV = TB[1] + (0.02 + v * 0.23) * (TB[3] - TB[1]);
    }, (j) => ctr(j === 0 ? y0 + 0.05 : j === 1 ? y0 : ys[j - 1]));
    // 褲襠那塊朝下（照不到光，會變成一塊黑的，像內褲）：髖關節下面的法線改成水平往外（跟褲管一樣亮）
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const q = (pb + j * nu + i) * 3, c = Math.cos(TORSO_PHI[i]), sn = Math.sin(TORSO_PHI[i]), y = j === 0 ? y0 : ys[j - 1];
      const w = j === 0 ? 0.85 : 0.85 * sstep(M.hipJY + 0.03 * s, M.hipJY - 0.03 * s, y);
      if (w <= 0) continue;
      vN[q] = lerp(vN[q], c, w); vN[q + 1] = lerp(vN[q + 1], 0, w); vN[q + 2] = lerp(vN[q + 2], sn, w); const l = Math.hypot(vN[q], vN[q + 1], vN[q + 2]) || 1; vN[q] /= l; vN[q + 1] /= l; vN[q + 2] /= l;
    }
    // 褲頭的邊
    if (tucked) lipRing(M, nu, (i, o) => torsoOff(M, TORSO_PHI[i], waistTop, dB, o), (i, o) => torsoOff(M, TORSO_PHI[i], waistTop, 0.0005 * s, o), [0, 1, 0], (i, y, z) => { torsoWeights(M, y, z, Math.cos(TORSO_PHI[i])); mat(R_BOT, 0.9, 0.7); GU = TB[0] + 0.5 * (TB[2] - TB[0]); GV = TB[1] + 0.26 * (TB[3] - TB[1]); });
  }
  // 2) 上衣：下擺 → 領口（越上面圈越密：肩膀的形狀在最上面那幾公分）
  //    沒紮的：從屁股最寬的地方直直垂下來，蓋住褲子、屁股、大腿（不會縮進胯下）
  const nvT = tucked ? 10 : 12, nvS = 3;
  gpSize(nu * (nvT + nvS));
  const neckY = TORSO_PHI.map((p) => necklineY(M, top, p));
  const tRow = (j) => Math.sin((j / (nvT - 1)) * PI / 2);
  const rowY = (i, j) => lerp(hemY, neckY[i], tRow(j));
  const ND = 5, DX = new Float32Array(nu), DZ = new Float32Array(nu), DE = new Float32Array(nu), DY = new Float32Array(nu);
  if (!tucked) for (let i = 0; i < nu; i++) { // 每個方位角：從第二圈往下量身體（褲子、屁股、大腿）最外面到哪裡，下面兩圈都掛在那裡
    const yD = rowY(i, 1); M.torso(yD, TT); const dcx = TT[0];
    torsoOff(M, TORSO_PHI[i], yD, offTop(yD), Q3);
    const dx = Q3[0] - dcx, dz = Q3[2], dl = Math.hypot(dx, dz) || 1; DX[i] = dx / dl; DZ[i] = dz / dl; DY[i] = dcx;
    let e = dl;
    for (let k = 0; k <= ND + 2; k++) {
      const y = lerp(yD + 0.03 * s, hemY - 0.01 * s, k / (ND + 2));
      torsoOff(M, TORSO_PHI[i], Math.max(y, M.torsoY0 + 0.005 * s), (y > waistTop ? dT : dB + 0.008 * s), Q3); e = Math.max(e, (Q3[0] - dcx) * DX[i] + Q3[2] * DZ[i]);
      const f = (M.hipJY - y) / (M.thigh + M.shin);
      if (f > 0) { // 大腿（橢圓）在這個方向最外面
        M.leg(f, AT); const rx = AT[0] + (bot.leg + 0.008) * s, rz = AT[1] + (bot.leg + 0.008) * s;
        for (let q = 0; q < 2; q++) { const J = M.hipJ[q], cx = J[0] + AT[2] - dcx, cz = J[2] + (q ? 1 : -1) * AT[3]; e = Math.max(e, cx * DX[i] + cz * DZ[i] + Math.hypot(rx * DX[i], rz * DZ[i])); }
      }
    }
    DE[i] = e;
  }
  const drapeRows = tucked ? 0 : 2;
  // 沒紮的上衣：屁股後面多留一點空間（大腿一彎，下擺跟著大腿往裡面收，褲子會從衣服穿出來）
  const backX = (i, y) => (tucked ? 0 : 0.006 * s * sstep(0.1, -0.6, Math.cos(TORSO_PHI[i])) * sstep(waistTop + 0.03 * s, waistTop - 0.03 * s, y));
  const topPt = (i, y, off, o, drape) => {
    if (!drape) return torsoOff(M, TORSO_PHI[i], y, off, o);
    const e = DE[i] + (off - offTop(y)) + 0.004 * M.s * sstep(rowY(i, 1), hemY, y);
    o[0] = DY[i] + DX[i] * e; o[1] = y; o[2] = DZ[i] * e; return o;
  };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nvT; j++) {
    const y = rowY(i, j); topPt(i, y, offTop(y) + backX(i, y), Q3, j < drapeRows); gset(j * nu + i, Q3[0], Q3[1], Q3[2]);
  }
  const vRange = [hemY, M.neckBaseY];
  gridEmit(nu, nvT, true, (i, j) => {
    const k = (j * nu + i) * 3, y = lerp(hemY, neckY[i], tRow(j));
    torsoWeights(M, y, GP[k + 2], Math.cos(TORSO_PHI[i]));
    const fixed = top.fixed;
    if (fixed) { const c = linColor(fixed); mat(R_FIX, 0.9, c[0], c[1], c[2]); } else mat(R_TOP, 0.88, 1);
    const ao = 1 - 0.1 * sstep(M.shY - 0.06 * s, M.shY - 0.16 * s, y) * gs(Math.abs(TORSO_PHI[i]) - PI / 2, 0.35); // 腋下
    cS[0] *= ao; cS[1] *= ao; cS[2] *= ao;
    const u = Math.abs(TORSO_PHI[i]) / PI, v = (y - vRange[0]) / (vRange[1] - vRange[0]);
    GU = TP[0] + (0.03 + u * 0.94) * (TP[2] - TP[0]); GV = TP[1] + (0.015 + clamp(v, 0, 1) * 0.66) * (TP[3] - TP[1]);
  }, (j) => ctr(Math.max(lerp(hemY, M.neckBaseY, tRow(j)), tucked ? 0 : lerp(hemY, M.neckBaseY, tRow(1)))));
  // 下擺的布邊（沒紮進去的）：往裡面收一點點，看得到布的厚度
  if (!tucked) lipRing(M, nu, (i, o) => topPt(i, hemY, offTop(hemY) + backX(i, hemY), o, true), (i, o) => topPt(i, hemY + 0.004 * s, offTop(hemY) + backX(i, hemY) - 0.006 * s, o, true), [0, -1, 0], (i, y, z) => { torsoWeights(M, y, z, Math.cos(TORSO_PHI[i])); if (top.fixed) { const c = linColor(top.fixed); mat(R_FIX, 0.9, c[0] * 0.75, c[1] * 0.75, c[2] * 0.75); } else mat(R_TOP, 0.9, 0.72); GU = TP[0] + 0.5 * (TP[2] - TP[0]); GV = TP[1] + 0.02 * (TP[3] - TP[1]); });
  // 領口的布邊
  lipRing(M, nu, (i, o) => torsoOff(M, TORSO_PHI[i], neckY[i], offTop(neckY[i]), o), (i, o) => torsoOff(M, TORSO_PHI[i], neckY[i] + 0.0015 * s, 0.0005 * s, o), [0, 1, 0], (i, y, z) => { torsoWeights(M, y, z); if (top.fixed) { const c = linColor(top.fixed); mat(R_FIX, 0.9, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8); } else mat(R_TOP, 0.9, 0.78); GU = TP[0] + 0.5 * (TP[2] - TP[0]); GV = TP[1] + 0.66 * (TP[3] - TP[1]); });
  if (top.neck === 'collar' || top.neck === 'polo' || top.neck === 'stand' || top.neck === 'hood') genCollar(M, top, neckY, offTop, TP);
  // 3) 領口上面的皮膚（到脖子裡面）
  for (let i = 0; i < nu; i++) for (let j = 0; j < nvS; j++) {
    const y = lerp(neckY[i], yTop, j / (nvS - 1)); torsoPt(M, TORSO_PHI[i], y, Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]);
  }
  gridEmit(nu, nvS, true, (i, j) => {
    const k = (j * nu + i) * 3; torsoWeights(M, GP[k + 1], GP[k + 2]);
    mat(R_SKIN, 0.6, 0.97); GU = M.tiles.skin[0]; GV = M.tiles.skin[1];
  }, (j) => ctr(lerp(M.neckBaseY - 0.05, yTop, j / (nvS - 1))));
  // 4) 皮帶（紮進去的上衣）
  if (tucked && !bot.skirt) {
    const ys = [waistTop - 0.034 * s, waistTop + 0.002 * s];
    gpSize(nu * 2);
    for (let i = 0; i < nu; i++) for (let j = 0; j < 2; j++) { torsoOff(M, TORSO_PHI[i], ys[j], dB + 0.0035 * s, Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]); }
    const belt = linColor(L.body === 'f' ? '#3a2a22' : '#1d1a18');
    gridEmit(nu, 2, true, (i, j) => { const k = (j * nu + i) * 3; torsoWeights(M, GP[k + 1], GP[k + 2]); mat(R_FIX, 0.45, belt[0], belt[1], belt[2]); const T = M.tiles.belt; GU = T[0] + (Math.abs(TORSO_PHI[i]) / PI) * (T[2] - T[0]); GV = T[1] + j * (T[3] - T[1]); }, (j) => ctr(ys[j]));
    lipRing(M, nu, (i, o) => torsoOff(M, TORSO_PHI[i], ys[1], dB + 0.0035 * s, o), (i, o) => torsoOff(M, TORSO_PHI[i], ys[1], 0, o), [0, 1, 0], (i, y, z) => { torsoWeights(M, y, z); mat(R_FIX, 0.45, belt[0] * 0.8, belt[1] * 0.8, belt[2] * 0.8); });
  }
  return chunkEnd();
}
// 領子：襯衫、制服、POLO 衫（翻領：立起來再翻下來，前面兩個尖角）、夾克（立領）、連帽外套（帽子攤在背上）
function genCollar(M, top, neckY, offTop, TP) {
  const s = M.s, kind = top.neck, n = M.neckBaseY, nr = M.neckR, closed = kind === 'stand';
  const open = closed ? 0 : kind === 'hood' ? 26 : 21; // 前面開口（度）
  const cols = [];
  for (let i = 0; i < TORSO_PHI.length; i++) if (Math.abs(TORSO_PHI[i]) >= open * D2R - 1e-6) cols.push(i);
  const key = (i) => (TORSO_PHI[i] >= 0 ? TORSO_PHI[i] : TAU + TORSO_PHI[i]);
  cols.sort((a, b) => key(a) - key(b)); // 右前 → 後面 → 左前
  const nu = cols.length, nv = kind === 'collar' || kind === 'polo' ? 3 : 4;
  M.torso(M.torsoY1, TT); const ax0 = TT[0], ay0 = M.torsoY1, ax1 = M.headPivot[0] + 0.006 * M.hs, ay1 = M.headPivot[1] + 0.035 * M.hs;
  const neckP = (phi, y, add, o) => { // 脖子表面（往外 add）
    const t = (y - ay0) / (ay1 - ay0), cx = lerp(ax0, ax1, t), r = nr * 0.985 + add;
    o[0] = cx + r * 0.97 * Math.cos(phi); o[1] = y; o[2] = r * 1.03 * Math.sin(phi); return o;
  };
  gpSize(nu * nv);
  for (let a = 0; a < nu; a++) {
    const i = cols[a], phi = TORSO_PHI[i], ap = Math.abs(phi), back = sstep(0.5, 2.6, ap), yN = neckY[i], off = offTop(yN);
    const end = !closed && (a === 0 || a === nu - 1) ? 1 : 0, sd = phi < 0 ? -1 : 1;
    const put = (j, o) => gset(j * nu + a, o[0], o[1], o[2]);
    put(0, torsoOff(M, phi, yN - 0.004 * s, off + 0.001 * s, Q3));
    if (kind === 'collar' || kind === 'polo') {
      const big = kind === 'collar' ? 1 : 0.75;
      put(1, neckP(phi, n + lerp(0.018, 0.03, back) * s, 0.008 * s, Q3));
      // 翻下來的邊：後面、旁邊蓋在領口上；前面兩個尖角往下、往中間
      const yl = yN - (0.008 + 0.034 * big * gs(ap - 0.4, 0.28) + 0.012 * big * end) * s;
      torsoOff(M, end ? phi - sd * 0.16 : phi, yl, off + (0.01 + 0.004 * back) * s, Q3); put(2, Q3);
    } else if (kind === 'stand') {
      put(1, neckP(phi, n + 0.045 * s, 0.013 * s, Q3));
      put(2, neckP(phi, n + 0.043 * s, 0.007 * s, Q3));
      put(3, neckP(phi, n + 0.008 * s, 0.004 * s, Q3));
    } else { // 帽子攤在背上：一大團
      const side = 1 - back;
      put(1, neckP(phi, n + (0.03 - 0.012 * side) * s, (0.028 - 0.012 * side) * s, Q3));
      const yb = yN - (0.03 + 0.1 * back) * s;
      put(2, torsoOff(M, phi, yb, off + (0.012 + 0.024 * back) * s, Q3));
      put(3, torsoOff(M, phi, yb - 0.02 * s, off + 0.003 * s, Q3));
    }
  }
  gridEmit(nu, nv, closed, (a, j) => {
    const k = (j * nu + a) * 3; torsoWeights(M, GP[k + 1], GP[k + 2]);
    const sh = kind === 'hood' ? [0.82, 1, 0.9, 0.75][j] : kind === 'stand' ? [0.9, 1, 0.8, 0.65][j] : [0.8, 1.02, 0.94][j];
    if (top.fixed) { const c = linColor(top.fixed); mat(R_FIX, 0.9, c[0] * sh, c[1] * sh, c[2] * sh); } else mat(R_TOP, 0.88, sh);
    GU = TP[0] + (0.03 + (a / (nu - 1)) * 0.94) * (TP[2] - TP[0]); GV = TP[1] + (0.998 - 0.012 * (j / (nv - 1))) * (TP[3] - TP[1]);
  }, [M.neckX, n - 0.02 * s, 0]);
}
// 一圈布邊：outer(i, o)、inner(i, o) 兩圈點接起來；up＝布邊大概朝哪邊（決定正反面）
function lipRing(M, nu, outer, inner, up, attr, ku = 0.8) { // ku：法線朝 up 的比例（小＝比較朝外，斜著看不會反光變成一條亮線）
  gpSize(nu * 2);
  const a = [0, 0, 0], b = [0, 0, 0];
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < nu; i++) { outer(i, a); inner(i, b); gset(i, b[0], b[1], b[2]); gset(nu + i, a[0], a[1], a[2]); cx += a[0] / nu; cy += a[1] / nu; cz += a[2] / nu; }
  const c = [cx - up[0] * 0.5, cy - up[1] * 0.5, cz - up[2] * 0.5]; // 布邊朝 up：「裡面」在反方向
  const base = VN;
  // 法線：朝 up 和朝外的平均
  for (let j = 0; j < 2; j++) for (let i = 0; i < nu; i++) {
    const k = (j * nu + i) * 3;
    attr(i, GP[k + 1], GP[k + 2]);
    const ox = GP[k] - cx, oz = GP[k + 2] - cz, ol = Math.hypot(ox, oz) || 1;
    vtx(GP[k], GP[k + 1], GP[k + 2], up[0] * ku + (ox / ol) * 0.6, up[1] * ku, up[2] * ku + (oz / ol) * 0.6, GU, GV);
  }
  for (let i = 0; i < nu; i++) {
    const i1 = (i + 1) % nu, p = base + i, q = base + i1, r = base + nu + i1, t = base + nu + i;
    // 看法線方向決定三角形的順序
    const ax = GP[i1 * 3] - GP[i * 3], ay = GP[i1 * 3 + 1] - GP[i * 3 + 1], az = GP[i1 * 3 + 2] - GP[i * 3 + 2];
    const bx = GP[(nu + i) * 3] - GP[i * 3], by = GP[(nu + i) * 3 + 1] - GP[i * 3 + 1], bz = GP[(nu + i) * 3 + 2] - GP[i * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const mx = GP[i * 3] - c[0], my = GP[i * 3 + 1] - c[1], mz = GP[i * 3 + 2] - c[2];
    if (nx * mx + ny * my + nz * mz > 0) { tri(p, q, r); tri(p, r, t); } else { tri(p, r, q); tri(p, t, r); }
  }
  void M;
}
// 手臂＋手
function armWeights(M, sd, f) {
  const up = sd < 0 ? B.upL : B.upR, fo = sd < 0 ? B.foreL : B.foreR, ha = sd < 0 ? B.handL : B.handR, cl = sd < 0 ? B.clavL : B.clavR;
  const e = M.upper / (M.upper + M.fore);
  const a = sstep(e - 0.06, e + 0.06, f), b = sstep(0.95, 1.03, f), c = sstep(0.02, -0.06, f) * 0.3;
  wAdd(cl, c); wAdd(up, (1 - a) * (1 - c)); wAdd(fo, a * (1 - b)); wAdd(ha, a * b); wFlush();
}
function genArm(M, sd) {
  const L = M.L, top = TOPS[L.top] || TOPS.tee, s = M.s, e = M.upper / (M.upper + M.fore);
  const sl = top.sleeve === 'long' ? 0.985 : (top.sleeve || 0) * e;
  const nu = 8, phis = LIMB_PHI(nu), TP = M.tiles.top;
  const base = [-0.066, -0.056, -0.038, -0.014, 0.05, 0.22, e - 0.07, e - 0.01, e + 0.06, 0.8, 0.93, 1.04];
  const d0 = top.off * s * 0.9;
  // 短袖往下張開（外側張得多：袖子是斜的，不是一根管子）
  const sleeveOff = (f, phi) => (top.sleeve === 'long' ? d0 * (1 + 0.3 * sstep(0.85, 0.97, f)) : d0 + s * sstep(sl * 0.25, sl, f) * (0.0035 + 0.008 * Math.max(0, Math.sin(phi))));
  const ctr = (f) => { const J = M.shJ[sd < 0 ? 0 : 1]; return [J[0], J[1] - f * (M.upper + M.fore) + (f < -0.03 ? -0.02 : 0), J[2] + sd * 0.004]; };
  // 袖子
  if (sl > 0) {
    const rows = base.filter((f) => f < sl - 0.02); rows.push(sl);
    const nv = rows.length; gpSize(nu * nv);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { armOff(M, sd, phis[i], rows[j], sleeveOff(rows[j], phis[i]), Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]); }
    gridEmit(nu, nv, true, (i, j) => {
      armWeights(M, sd, rows[j]);
      if (top.fixed) { const c = linColor(top.fixed); mat(R_FIX, 0.9, c[0], c[1], c[2]); } else mat(R_TOP, 0.88, 1);
      const ao = 1 - 0.12 * gs(Math.abs(phis[i]) - PI / 2, 0.5) * sstep(0.1, -0.05, rows[j]) * (sd > 0 ? 1 : 1);
      cS[0] *= ao; cS[1] *= ao; cS[2] *= ao;
      const u = Math.abs(phis[i]) / PI, v = clamp((rows[j] + 0.094) / (1.08), 0, 1);
      GU = TP[0] + (0.03 + u * 0.94) * (TP[2] - TP[0]); GV = TP[1] + (0.7 + (1 - v) * 0.29) * (TP[3] - TP[1]);
    }, (j) => ctr(rows[j]));
    // 袖口的布邊
    lipRing(M, nu, (i, o) => armOff(M, sd, phis[i], sl, sleeveOff(sl, phis[i]), o), (i, o) => armOff(M, sd, phis[i], sl - 0.006, Math.max(0.0005 * s, sleeveOff(sl, phis[i]) - 0.005 * s), o), [0, -1, 0], (i, y) => { armWeights(M, sd, sl); if (top.fixed) { const c = linColor(top.fixed); mat(R_FIX, 0.9, c[0] * 0.75, c[1] * 0.75, c[2] * 0.75); } else mat(R_TOP, 0.9, 0.7); GU = TP[0] + 0.5 * (TP[2] - TP[0]); GV = TP[1] + 0.985 * (TP[3] - TP[1]); void y; });
  }
  // 皮膚那段
  {
    const rows = sl > 0 ? [sl - 0.01, ...base.filter((f) => f > sl + 0.02)] : base;
    const nv = rows.length; gpSize(nu * nv);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { armPt(M, sd, phis[i], rows[j], Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]); }
    gridEmit(nu, nv, true, (i, j) => {
      armWeights(M, sd, rows[j]);
      const inner = gs(phis[i] * sd + PI / 2, 0.6); // 內側（腋下、手肘內）暗一點
      mat(R_SKIN, 0.6, 1 - 0.1 * inner * sstep(0.15, -0.05, rows[j]) - 0.05 * gs(rows[j] - e, 0.05));
      GU = M.tiles.skin[0]; GV = M.tiles.skin[1];
    }, (j) => ctr(rows[j]));
  }
  genHand(M, sd);
}
function genHand(M, sd) {
  const k = M.handK, hb = sd < 0 ? B.handL : B.handR, fb = sd < 0 ? B.fingL : B.fingR, tb = sd < 0 ? B.tipL : B.tipR, thb = sd < 0 ? B.thumbL : B.thumbR;
  const A = M.restAbs, o = [A[hb * 3], A[hb * 3 + 1], A[hb * 3 + 2]], palm = M.palm, T = M.tiles.hand;
  const put = (idx, x, y, z) => gset(idx, o[0] + x, o[1] + y, o[2] + z * sd);
  // 手掌：從手腕往下（寬度在 x、厚度在 z；手心朝身體 −z·sd）
  {
    const nu = 6, rows = [[0.012, 0.026, 0.019], [-0.3, 0.038, 0.017], [-0.68, 0.042, 0.0155], [-0.95, 0.043, 0.0145], [-1.03, 0.028, 0.009]], nv = rows.length + 1;
    gpSize(nu * nv);
    for (let j = 0; j < rows.length; j++) {
      const [yy, a, b] = rows[j];
      for (let i = 0; i < nu; i++) {
        const p = (i / nu) * TAU, c = Math.cos(p), sn = Math.sin(p);
        const thick = b * k * (sn < 0 ? 1.05 : 0.95) * (1 + 0.12 * gs(c - 0.8, 0.4) * sstep(0.1, -0.5, yy)); // 大拇指那邊的肉
        put(j * nu + i, spow(c, 0.8) * a * k, (j === 0 ? yy * 1 : yy * palm) + (j === 0 ? 0 : 0), spow(sn, 0.8) * thick);
      }
    }
    for (let i = 0; i < nu; i++) put(rows.length * nu + i, 0, -1.05 * palm, 0);
    gridEmit(nu, nv, true, (i, j) => {
      const f = j === 0 ? 0 : clamp(-rows[Math.min(j, rows.length - 1)][0], 0, 1);
      wAdd(sd < 0 ? B.foreL : B.foreR, j === 0 ? 0.5 : 0); wAdd(hb, 1 - sstep(0.85, 1.05, f) * 0.5); wAdd(fb, sstep(0.85, 1.05, f) * 0.5); wFlush();
      mat(R_SKIN, 0.6, 0.97); GU = T[0] + 0.25 * (T[2] - T[0]); GV = T[1] + 0.5 * (T[3] - T[1]);
    }, [o[0], o[1] - palm * 0.5, o[2]]);
  }
  // 四根手指（直的，彎曲靠骨頭）
  const fx = [0.029, 0.0095, -0.0095, -0.027], fl = [0.078, 0.086, 0.081, 0.064], fr = [0.0092, 0.0095, 0.009, 0.0078];
  const mid = fl[1];
  for (let n = 0; n < 4; n++) {
    const len = fl[n] * (M.finger / (0.081 * M.s)) * k, r = fr[n] * k, x = fx[n] * k, y0 = -0.9 * palm;
    const rings = [[0, 1], [0.46 * mid / fl[n], 0.93], [0.88, 0.72], [1, 0]], nu = 4, nv = rings.length;
    gpSize(nu * nv);
    for (let j = 0; j < nv; j++) {
      const [t, rr] = rings[j];
      for (let i = 0; i < nu; i++) { const p = ((i + 0.5) / nu) * TAU; put(j * nu + i, x + Math.cos(p) * r * rr, y0 - t * len - (j === 0 ? -0.004 : 0), Math.sin(p) * r * 0.86 * rr); }
    }
    gridEmit(nu, nv, true, (i, j) => {
      if (j === 0) { wAdd(hb, 0.6); wAdd(fb, 0.4); } else if (j === 1) { wAdd(fb, 0.5); wAdd(tb, 0.5); } else wAdd(tb, 1);
      wFlush(); mat(R_SKIN, 0.58, j >= 3 ? 1.02 : 0.97); GU = T[0] + (0.55 + 0.1 * n) * (T[2] - T[0]); GV = T[1] + (j / (nv - 1)) * (T[3] - T[1]);
    }, (j) => [o[0] + x, o[1] + y0 - rings[Math.min(j, nv - 2)][0] * len, o[2]]);
  }
  // 大拇指：從手掌前面、靠手心那邊斜斜往下
  {
    const len = 0.064 * k, d = [0.36, -0.86, -0.36], dl = Math.hypot(...d), bx = 0.028 * k, by = -0.2 * palm, bz = -0.004 * k;
    const rings = [[-0.25, 1.1], [0.4, 0.97], [0.86, 0.75], [1, 0]], nu = 4, nv = rings.length;
    // 垂直 d 的兩個方向
    const ax = [0.92, 0.38, 0], az = [-d[2] / dl * 0.0 + 0.36, 0.14, 0.92];
    gpSize(nu * nv);
    for (let j = 0; j < nv; j++) {
      const [t, rr] = rings[j], cx = bx + (d[0] / dl) * t * len, cy = by + (d[1] / dl) * t * len, cz = bz + (d[2] / dl) * t * len, r = 0.0105 * k * rr;
      for (let i = 0; i < nu; i++) { const p = (i / nu) * TAU; put(j * nu + i, cx + (Math.cos(p) * ax[0] + Math.sin(p) * az[0]) * r, cy + (Math.cos(p) * ax[1] + Math.sin(p) * az[1]) * r * 0.9, cz + (Math.cos(p) * ax[2] + Math.sin(p) * az[2]) * r); }
    }
    gridEmit(nu, nv, true, (i, j) => {
      if (j === 0) { wAdd(hb, 0.7); wAdd(thb, 0.3); } else if (j === 1) { wAdd(hb, 0.2); wAdd(thb, 0.8); } else wAdd(thb, 1);
      wFlush(); mat(R_SKIN, 0.58, 0.97); GU = T[0] + 0.95 * (T[2] - T[0]); GV = T[1] + (j / (nv - 1)) * (T[3] - T[1]);
    }, (j) => { const t = rings[Math.min(j, nv - 2)][0]; return [o[0] + bx + (d[0] / dl) * t * len, o[1] + by + (d[1] / dl) * t * len, o[2] + sd * (bz + (d[2] / dl) * t * len)]; });
  }
}
// 腿（褲子、皮膚、襪子）＋裙子
function legWeights(M, sd, f) {
  const th = sd < 0 ? B.thighL : B.thighR, sh = sd < 0 ? B.shinL : B.shinR, ft = sd < 0 ? B.footL : B.footR;
  const k = M.thigh / (M.thigh + M.shin);
  // 髖關節上面那段（在褲子骨盆裡面）大部分跟著骨盆：大腿彎、扭的時候，屁股上面才不會往後凸出來穿過衣服
  const a = sstep(k - 0.06, k + 0.06, f), b = sstep(0.96, 1.05, f), h = 0.5 * sstep(0.06, -0.02, f) + 0.5 * sstep(-0.02, -0.09, f);
  wAdd(B.hips, h); wAdd(th, (1 - a) * (1 - h)); wAdd(sh, a * (1 - b)); wAdd(ft, a * b); wFlush();
}
function genLeg(M, sd) {
  const L = M.L, bot = BOTTOMS[L.bottom] || BOTTOMS.jeans, s = M.s, kf = M.thigh / (M.thigh + M.shin), nu = 9, phis = LIMB_PHI(nu), TB = M.tiles.bottom;
  const boots = L.shoes === 'boots', bootTop = 0.66;
  let hem = bot.skirt ? 0 : bot.hem === 0.3 ? kf * 0.62 : bot.hem;
  if (boots && hem > bootTop) hem = bootTop + 0.03; // 雨鞋：褲管塞在靴子裡
  const base = [-0.11, -0.075, -0.02, 0.08, 0.24, kf - 0.06, kf, kf + 0.07, kf + 0.17, 0.78, 0.93, 1.05];
  const legOff = (f) => (bot.leg * s) + bot.flare * s * sstep(hem - 0.35, hem, f) + (bot.cuff ? -0.004 * s * sstep(hem - 0.05, hem, f) : 0);
  const ctr = (f) => { const J = M.hipJ[sd < 0 ? 0 : 1]; return [J[0], J[1] - f * (M.thigh + M.shin) + (f < -0.06 ? -0.03 : 0), J[2] + sd * 0.01]; };
  if (hem > 0) {
    const rows = base.filter((f) => f < hem - 0.02); rows.push(hem);
    const nv = rows.length; gpSize(nu * nv);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { legOff2(M, sd, phis[i], rows[j], legOff(rows[j]), Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]); }
    gridEmit(nu, nv, true, (i, j) => {
      legWeights(M, sd, rows[j]);
      const inner = gs(phis[i] * sd + PI / 2, 0.7);
      mat(R_BOT, 0.9, 1 - 0.14 * inner * sstep(0.25, 0.0, rows[j]) - 0.06 * gs(rows[j] - kf, 0.04) * gs(phis[i], 1.2));
      const u = Math.abs(phis[i]) / PI, v = clamp(rows[j], 0, 1);
      GU = TB[0] + (0.03 + u * 0.94) * (TB[2] - TB[0]); GV = TB[1] + (0.27 + v * 0.72) * (TB[3] - TB[1]);
    }, (j) => ctr(rows[j]));
    lipRing(M, nu, (i, o) => legOff2(M, sd, phis[i], hem, legOff(hem), o), (i, o) => legOff2(M, sd, phis[i], hem - 0.006, Math.max(0.0005 * s, legOff(hem) - 0.005 * s), o), [0, -1, 0], (i) => { legWeights(M, sd, hem); mat(R_BOT, 0.9, 0.62); GU = TB[0] + 0.5 * (TB[2] - TB[0]); GV = TB[1] + 0.99 * (TB[3] - TB[1]); void i; });
  }
  // 皮膚（短褲、裙子）＋襪子
  const sock = !boots && L.shoes !== 'slippers' ? (L.shoes === 'leather' ? 0.9 : M.kid || L.top === 'uniform' ? 0.8 : 0.9) : 2;
  if (hem < 0.98) {
    const rows = hem > 0 ? [hem - 0.01, ...base.filter((f) => f > hem + 0.02)] : base.slice();
    const skinRows = rows.filter((f) => f < sock - 0.015); if (sock < 1.05) skinRows.push(sock);
    const nv = skinRows.length; gpSize(nu * nv);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { legPt(M, sd, phis[i], skinRows[j], Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]); }
    gridEmit(nu, nv, true, (i, j) => {
      legWeights(M, sd, skinRows[j]);
      const inner = gs(phis[i] * sd + PI / 2, 0.7);
      mat(R_SKIN, 0.6, 1 - 0.12 * inner * sstep(0.2, -0.05, skinRows[j]));
      GU = M.tiles.skin[0]; GV = M.tiles.skin[1];
    }, (j) => ctr(skinRows[j]));
    if (sock < 1.05) {
      const srows = [sock, 0.93, 1.05].filter((f, i) => i === 0 || f > sock + 0.01);
      const sc = linColor(L.shoes === 'leather' ? '#23242a' : L.top === 'uniform' || M.kid ? '#f2f2ee' : L.body === 'f' ? '#efefea' : '#e8e8e4');
      gpSize(nu * srows.length);
      for (let j = 0; j < srows.length; j++) for (let i = 0; i < nu; i++) { legOff2(M, sd, phis[i], srows[j], 0.0025 * s, Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]); }
      gridEmit(nu, srows.length, true, (i, j) => { legWeights(M, sd, srows[j]); mat(R_FIX, 0.95, sc[0], sc[1], sc[2]); GU = M.tiles.skin[0]; GV = M.tiles.skin[1]; }, (j) => ctr(srows[j]));
      lipRing(M, nu, (i, o) => legOff2(M, sd, phis[i], sock, 0.0025 * s, o), (i, o) => legPt(M, sd, phis[i], sock + 0.003, o), [0, 1, 0], () => { legWeights(M, sd, sock); mat(R_FIX, 0.95, sc[0] * 0.85, sc[1] * 0.85, sc[2] * 0.85); });
    }
  }
}
function legOff2(M, sd, phi, f, off, o) { return legOff(M, sd, phi, f, off, o); }
// 裙子：腰到膝蓋上面，往外張開；前後左右跟著兩條腿動一點
function genSkirt(M) {
  const s = M.s, nu = 24, phis = LIMB_PHI(nu), y0 = M.waistY + 0.004 * s, y1 = M.kneeY + (M.kid ? 0.06 : 0.05) * M.H / 1.72;
  const TB = M.tiles.bottom, nv = 6;
  gpSize(nu * nv);
  M.torso(M.hipJY, TT); const hw = TT[1], hd = (TT[2] + TT[3]) / 2, hx = TT[0];
  for (let j = 0; j < nv; j++) {
    const t = j / (nv - 1), y = lerp(y0, y1, t);
    for (let i = 0; i < nu; i++) {
      if (y > M.torsoY0 + 0.03 * s && t < 0.5) { torsoOff(M, phis[i], y, (0.006 + 0.03 * t) * s, Q3); }
      else { const fl = 1 + 0.2 * (t - 0.3), c = Math.cos(phis[i]), sn = Math.sin(phis[i]); Q3[0] = hx + (hd + 0.02 * s) * fl * c; Q3[1] = y; Q3[2] = (hw + 0.025 * s) * fl * sn; }
      gset(j * nu + i, Q3[0], Q3[1], Q3[2]);
    }
  }
  gridEmit(nu, nv, true, (i, j) => {
    const t = j / (nv - 1), k = (j * nu + i) * 3, z = GP[k + 2], side = sstep(-0.3, 0.3, z / (0.1 * s));
    const lw = 0.55 * sstep(0.15, 1, t);
    wAdd(B.hips, 1 - lw); wAdd(B.thighL, lw * (1 - side)); wAdd(B.thighR, lw * side); wFlush();
    mat(R_BOT, 0.9, 1 - 0.1 * t * gs(Math.abs(phis[i]) - PI / 2, 0.6));
    GU = TB[0] + (0.03 + (Math.abs(phis[i]) / PI) * 0.94) * (TB[2] - TB[0]); GV = TB[1] + (0.27 + t * 0.72) * (TB[3] - TB[1]);
  }, (j) => [hx, lerp(y0, y1, j / (nv - 1)), 0]);
  // 裙襬（lipRing 會用 GP：先把最下面那圈抄出來）
  const hemPts = GP.slice((nv - 1) * nu * 3, nv * nu * 3);
  lipRing(M, nu, (i, o) => { o[0] = hemPts[i * 3]; o[1] = hemPts[i * 3 + 1]; o[2] = hemPts[i * 3 + 2]; }, (i, o) => { o[0] = hx + (hemPts[i * 3] - hx) * 0.95; o[1] = hemPts[i * 3 + 1] + 0.005 * s; o[2] = hemPts[i * 3 + 2] * 0.95; }, [0, -1, 0], (i, y, z) => { const side = sstep(-0.3, 0.3, z / (0.1 * s)); wAdd(B.hips, 0.45); wAdd(B.thighL, 0.55 * (1 - side)); wAdd(B.thighR, 0.55 * side); wFlush(); mat(R_BOT, 0.9, 0.6); GU = TB[0] + 0.5 * (TB[2] - TB[0]); GV = TB[1] + 0.99 * (TB[3] - TB[1]); void y; void i; });
}
// 腳＋鞋子：鞋底（平面外形擠出來）＋鞋面（從鞋底的邊往上、往中間那條線收成一個圓頂）
//   外形：[t 腳跟 0 → 腳尖 1, 半寬（公尺，成年男生）]，前後兩端接圓弧；高：[t, 鞋面比鞋底高多少]
const SHOE_SHAPE = {
  foot: { w: [[0.1, 0.027], [0.3, 0.029], [0.5, 0.037], [0.64, 0.043], [0.78, 0.042]], h: [[0, 0.036], [0.18, 0.05], [0.38, 0.046], [0.58, 0.028], [0.78, 0.018], [1, 0.012]], grow: [0, 0], ridge: [0.14, 0.86] },
  sneakers: { w: [[0.1, 0.035], [0.3, 0.036], [0.5, 0.043], [0.64, 0.048], [0.78, 0.046]], h: [[0, 0.046], [0.2, 0.054], [0.42, 0.05], [0.6, 0.036], [0.8, 0.028], [1, 0.02]], grow: [0.012, 0.017], ridge: [0.16, 0.82] },
  leather: { w: [[0.1, 0.031], [0.3, 0.031], [0.5, 0.039], [0.64, 0.043], [0.8, 0.036]], h: [[0, 0.04], [0.2, 0.048], [0.42, 0.043], [0.6, 0.031], [0.8, 0.022], [1, 0.015]], grow: [0.008, 0.022], ridge: [0.16, 0.85], toe: 0.75 },
  boots: { w: [[0.1, 0.039], [0.3, 0.04], [0.5, 0.045], [0.64, 0.05], [0.78, 0.048]], h: [[0, 0.06], [0.2, 0.064], [0.42, 0.056], [0.6, 0.042], [0.8, 0.034], [1, 0.026]], grow: [0.013, 0.016], ridge: [0.16, 0.82] },
  slippers: { w: [[0.1, 0.036], [0.3, 0.037], [0.5, 0.045], [0.64, 0.05], [0.78, 0.049]], grow: [0.012, 0.016] },
};
const HK = 4; // 鞋面從邊到頂幾圈
// 外形那一圈（腳的骨頭座標：x 往前、z 往外），toeK＝腳尖的圓弧（小＝尖一點）
function soleRing(M, sh, k, inset) {
  const len = M.footLen + (sh.grow[0] + sh.grow[1]) * k, xh = -M.heelBack - sh.grow[0] * k, W = sh.w, n = W.length;
  const wAt = (i) => Math.max(0.004, W[i][1] * k - inset);
  const rh = wAt(0), rt = wAt(n - 1) * (sh.toe || 1), out = [];
  const xOf = (t) => xh + t * len;
  const xhc = xh + rh + inset, xtc = xh + len - rt - inset; // 兩端圓弧的圓心
  // +z 那邊：腳跟 → 腳尖
  for (let i = 0; i < n; i++) { const x = clamp(xOf(W[i][0]), xhc, xtc); out.push([x, wAt(i)]); }
  for (let q = 1; q <= 4; q++) { const a = (PI / 2) * (1 - q / 5 * 2); out.push([xtc + Math.cos(a) * rt, Math.sin(a) * lerp(wAt(n - 1), rt, Math.cos(a))]); } // 腳尖的圓弧
  for (let i = n - 1; i >= 0; i--) { const x = clamp(xOf(W[i][0]), xhc, xtc); out.push([x, -wAt(i)]); }
  for (let q = 1; q <= 3; q++) { const a = -PI / 2 - (q / 4) * PI; out.push([xhc + Math.cos(a) * rh, Math.sin(a) * rh]); } // 腳跟的圓弧
  return out;
}
function genFoot(M, sd) {
  const L = M.L, k = M.footK, ft = sd < 0 ? B.footL : B.footR, sh = sd < 0 ? B.shinL : B.shinR, A = M.restAbs, o = [A[ft * 3], A[ft * 3 + 1], A[ft * 3 + 2]];
  const shoe = L.shoes in SHOES ? L.shoes : 'sneakers', g = -M.ankleY, T = M.tiles.shoe, s = M.s;
  const sole = SHOES[shoe].sole * s * (M.kid ? 0.85 : 1);
  // 權重：腳踝附近一點點跟小腿；前腳掌前面跟腳趾（腳跟抬起來時鞋頭彎起來、平貼地面）
  const toe = sd < 0 ? B.toeL : B.toeR, tw = (x) => sstep(M.ballFwd - 0.02 * s, M.ballFwd + 0.025 * s, x);
  const wFoot = (x, up) => { const b = 0.3 * sstep(0.4, 1, up) * sstep(0.03 * s, -0.03 * s, x), t = tw(x) * (1 - b); wAdd(sh, b); wAdd(ft, 1 - b - t); wAdd(toe, t); wFlush(); };
  const wSole = (x) => { const t = tw(x); wAdd(ft, 1 - t); wAdd(toe, t); wFlush(); };
  const uvRow = { sneakers: 0, leather: 0.25, boots: 0.5, slippers: 0.75 }[shoe];
  // 鞋底
  const SS = SHOE_SHAPE[shoe], heel = shoe === 'leather' ? 0.011 * s : 0;
  const ring = soleRing(M, SS, k, 0), xh = ring[ring.length - 1][0] - 0.02, len = M.footLen + (SS.grow[0] + SS.grow[1]) * k;
  M.toeTip = ring.reduce((a, p) => Math.max(a, p[0]), 0); // 鞋尖（腳趾往上彎的時候用）
  const lift = (x) => { const t = (x - (-M.heelBack - SS.grow[0] * k)) / len; return (shoe === 'sneakers' ? 0.009 : shoe === 'slippers' ? 0.004 : 0.006) * s * sstep(0.84, 1.02, t); }; // 鞋尖翹起來
  const heelY = (x) => heel * sstep(-M.heelBack + 0.3 * M.footLen, -M.heelBack + 0.22 * M.footLen, x); // 皮鞋的鞋跟
  const soleC = shoe === 'sneakers' ? linColor('#f0efea') : shoe === 'leather' ? linColor('#1c1714') : shoe === 'boots' ? linColor('#2a2a2a') : linColor('#f2f2ee');
  const soleTop = shoe === 'slippers' ? linColor('#f6f6f2') : soleC;
  soleSlab(M, sd, o, ring, g, sole, lift, heelY, soleC, soleTop, wSole, T, shoe === 'leather' ? 0.35 : 0.8);
  void xh;
  // 鞋面（或光腳）
  const up = shoe === 'slippers' ? SHOE_SHAPE.foot : SS, hk = shoe === 'slippers' ? 1 : 1;
  const top = soleRing(M, up, k, shoe === 'slippers' ? 0.004 * s : 0.0025 * s), m = top.length;
  const lenU = M.footLen + (up.grow[0] + up.grow[1]) * k, xu0 = -M.heelBack - up.grow[0] * k, xa = xu0 + up.ridge[0] * lenU, xb = xu0 + up.ridge[1] * lenU;
  const H0 = up.hc || (up.hc = curve(up.h)), H = (t, o) => { H0(t, o); o[0] *= k * hk; return o; };
  gpSize(m * (HK + 1));
  const base = (x) => g + sole + heelY(x) + lift(x);
  for (let j = 0; j <= HK; j++) {
    const a = (j / HK) * PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < m; i++) {
      const [px, pz] = top[i], cx = clamp(px, xa, xb), x = cx + (px - cx) * ca, z = pz * ca;
      H(clamp((x - xu0) / lenU, 0, 1), Q3b);
      gset(j * m + i, o[0] + x, o[1] + base(x) + Q3b[0] * Math.pow(sa, 0.9) - (j === 0 ? 0.002 * s : 0), o[2] + z * sd);
    }
  }
  const bare = shoe === 'slippers';
  gridEmit(m, HK + 1, true, (i, j) => {
    const q = (j * m + i) * 3; wFoot(GP[q] - o[0], j / HK);
    if (bare) mat(R_SKIN, 0.6, j === 0 ? 0.85 : 1); else mat(R_SHOE, shoe === 'leather' ? 0.3 : shoe === 'boots' ? 0.32 : 0.75, j === 0 ? 0.82 : 1);
    GU = T[0] + (i / m) * (T[2] - T[0]); GV = T[1] + (uvRow + (j / HK) * 0.22 + 0.015) * (T[3] - T[1]);
  }, (j) => [o[0] + (xa + xb) / 2, o[1] + g + sole + 0.012 * s * (1 - j / HK), o[2]]);
  for (let i = 0; i < m; i++) { const q = (VN - m + i) * 3; vN[q] = 0; vN[q + 1] = 1; vN[q + 2] = 0; } // 最上面那圈縮成一條線：法線直接朝上
  if (bare) { // 藍白拖的藍色帶子（跨過腳背）
    const blue = linColor('#2f5fb3');
    strap(M, sd, o, up, k, lenU, xu0, base, 0.36, 0.56, blue, ft, T);
  }
  if (shoe === 'boots') bootShaft(M, sd);
}
// 鞋底：外形擠出來（側邊、底、上面）；lift(x)＝鞋尖翹、heelY(x)＝鞋跟加高
function soleSlab(M, sd, o, ring, g, t, lift, heelY, side, topC, wf, T, rough) { // wf(x)：設這個點的骨頭權重
  const m = ring.length;
  // 用有號面積決定三角形的方向（z 會照左右鏡射）
  let area = 0; for (let i = 0; i < m; i++) { const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % m]; area += x0 * z1 - x1 * z0; }
  const ccw = (area * sd > 0);
  const uv0 = T[0] + 0.01 * (T[2] - T[0]), uv1 = T[1] + 0.995 * (T[3] - T[1]);
  // 底（朝下）、上面（朝上）
  const b0 = VN;
  for (let i = 0; i < m; i++) { const [x, z] = ring[i]; wf(x); mat(R_FIX, rough, side[0] * 0.8, side[1] * 0.8, side[2] * 0.8); vtx(o[0] + x, o[1] + g + lift(x), o[2] + z * sd, 0, -1, 0, uv0, uv1); }
  const b1 = VN;
  for (let i = 0; i < m; i++) { const [x, z] = ring[i]; wf(x); mat(R_FIX, rough, topC[0], topC[1], topC[2]); vtx(o[0] + x, o[1] + g + t + heelY(x) + lift(x), o[2] + z * sd, 0, 1, 0, uv0, uv1); }
  for (let i = 1; i < m - 1; i++) { if (ccw) { tri(b0, b0 + i, b0 + i + 1); tri(b1, b1 + i + 1, b1 + i); } else { tri(b0, b0 + i + 1, b0 + i); tri(b1, b1 + i, b1 + i + 1); } }
  // 側邊（法線朝外）
  const sb = VN;
  for (let lay = 0; lay < 2; lay++) for (let i = 0; i < m; i++) {
    const [x, z] = ring[i], [xa, za] = ring[(i + m - 1) % m], [xb, zb] = ring[(i + 1) % m];
    let nx = zb - za, nz = -(xb - xa); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (!ccw === (sd > 0)) { nx = -nx; nz = -nz; }
    wf(x); mat(R_FIX, rough, side[0] * (lay ? 1 : 0.85), side[1] * (lay ? 1 : 0.85), side[2] * (lay ? 1 : 0.85));
    vtx(o[0] + x, o[1] + g + lift(x) + (lay ? t + heelY(x) : 0), o[2] + z * sd, nx, lay ? 0.25 : -0.2, nz * sd, uv0, uv1);
  }
  for (let i = 0; i < m; i++) {
    const i1 = (i + 1) % m, p = sb + i, q = sb + i1, r = sb + m + i1, s2 = sb + m + i;
    if (ccw) { tri(p, r, q); tri(p, s2, r); } else { tri(p, q, r); tri(p, r, s2); }
  }
}
// 拖鞋的帶子：跨過腳背的一條（照著腳面的圓頂，往外一點點）
function strap(M, sd, o, up, k, lenU, xu0, base, t0, t1, col, bone, T) {
  const nu = 9, nv = 3, H0 = up.hc || (up.hc = curve(up.h)), H = (t, o) => { H0(t, o); o[0] *= k; return o; }, W = up.w;
  gpSize(nu * nv);
  const wAtT = (t) => { let a = W[0], b = W[W.length - 1]; for (let j = 1; j < W.length; j++) if (W[j][0] >= t) { a = W[j - 1]; b = W[j]; break; } return lerp(a[1], b[1], clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1)) * k; };
  for (let j = 0; j < nv; j++) {
    const t = lerp(t0, t1, j / (nv - 1)), x = xu0 + t * lenU, w = wAtT(t) + 0.004 * M.s; H(t, Q3b); const h = Q3b[0] + 0.004 * M.s;
    for (let i = 0; i < nu; i++) { const a = (i / (nu - 1)) * PI; gset(j * nu + i, o[0] + x, o[1] + base(x) + Math.pow(Math.sin(a), 0.9) * h, o[2] + Math.cos(a) * w * sd); }
  }
  wt(bone);
  gridEmit(nu, nv, false, () => { mat(R_FIX, 0.55, col[0], col[1], col[2]); GU = T[0] + 0.03 * (T[2] - T[0]); GV = T[1] + 0.97 * (T[3] - T[1]); }, [o[0] + xu0 + ((t0 + t1) / 2) * lenU, o[1] + base(0), o[2]]);
}
function bootShaft(M, sd) {
  const nu = 9, phis = LIMB_PHI(nu), s = M.s, rows = [1.0, 0.8, 0.66], T = M.tiles.shoe;
  gpSize(nu * rows.length);
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < nu; i++) { legOff(M, sd, phis[i], rows[j], (0.012 + 0.006 * j) * s, Q3); gset(j * nu + i, Q3[0], Q3[1], Q3[2]); }
  gridEmit(nu, rows.length, true, (i, j) => { legWeights(M, sd, rows[j]); mat(R_SHOE, 0.35, 1 - 0.05 * j); GU = T[0] + (i / nu) * (T[2] - T[0]); GV = T[1] + (0.52 + 0.1 * j) * (T[3] - T[1]); }, (j) => { const J = M.hipJ[sd < 0 ? 0 : 1]; return [J[0], J[1] - rows[j] * (M.thigh + M.shin), J[2]]; });
  lipRing(M, nu, (i, o) => legOff(M, sd, phis[i], 0.66, 0.024 * s, o), (i, o) => legOff(M, sd, phis[i], 0.672, 0.004 * s, o), [0, 1, 0], () => { legWeights(M, sd, 0.66); mat(R_SHOE, 0.4, 0.55); });
}

// ---- 頭髮：頭皮那層（髮際線 → 頭頂，往外推頭髮的厚度）＋長髮的髮簾、馬尾、包頭 ----
const HAIR_ROWS = 7;
function hatLine(M, phi) { // 帽子戴到哪裡（參考頭的 Y）；沒戴帽子 → 很高（不壓頭髮）
  const K = M.hk, c = Math.cos(phi), deg = Math.abs(phi) / D2R;
  switch (M.L.hat) {
    case 'cap': return lerp(0.02, 0.043, sstep(-0.9, 0.9, c)) * K.cranK;
    case 'bucket': return lerp(0.008, 0.034, sstep(-0.9, 0.9, c)) * K.cranK;
    case 'helmet': return deg < 45 ? 0.036 * K.cranK : lerp(0.036 * K.cranK, deg < 110 ? -0.05 * K.faceK : -0.066 * K.faceK, sstep(45, 95, deg)) + (deg > 110 ? -0.012 * sstep(110, 180, deg) * K.faceK : 0);
    case 'straw': return 0.07 * K.cranK;
  }
  return 1;
}
function noise2(a, b, sd) { // 便宜的平順雜訊（幾個 sin 疊起來）
  return (Math.sin(a * 1.7 + sd * 3.1) * Math.sin(b * 2.3 + sd * 1.3) + 0.6 * Math.sin(a * 3.9 + b * 1.1 + sd * 5.7) + 0.4 * Math.sin(a * 6.1 - b * 4.3 + sd * 2.2)) / 2;
}
function hairThick(M, phi, t) { // 頭髮多厚（參考頭的公尺）
  const st = M.L.hair, c = Math.cos(phi), side = gs(Math.abs(phi) - PI / 2, 0.6), sd = (M.L.seed || 0) % 7;
  switch (st) {
    case 'buzz': return 0.0038 + 0.0022 * t;
    case 'short': if (M.fem) return 0.011 + 0.012 * sstep(0, 0.7, t) + 0.002 * noise2(phi * 3, t * 5, sd);
      return (0.006 + 0.017 * sstep(0, 0.75, t)) * lerp(1, 0.72, side) * (c < 0 ? lerp(1, 0.86, -c) : 1) + (c > 0.6 && t < 0.25 ? 0.004 * (1 - t / 0.25) : 0);
    case 'side': {
      const part = -0.55, dip = gs(phi - part, 0.13) * sstep(0.22, 0.45, t);
      return (0.008 + 0.022 * sstep(0, 0.7, t)) * (phi > part ? 1.12 : 0.9) * lerp(1, 0.72, side * (1 - t)) * (1 - 0.55 * dip) + (c > 0.5 && t < 0.3 ? 0.005 : 0);
    }
    case 'long': return 0.008 + 0.008 * t + 0.0015 * noise2(phi * 4, t * 6, sd);
    case 'ponytail': case 'bun': return 0.0055 + 0.0035 * t;
    case 'curly': return 0.026 + 0.014 * t + 0.008 * (0.5 + 0.5 * noise2(phi * 7, t * 9, sd)) + 0.004 * Math.sin(phi * 13 + t * 17);
    case 'perm': return 0.022 + 0.016 * sstep(0, 0.6, t) + 0.006 * (0.5 + 0.5 * noise2(phi * 10, t * 12, sd + 2)) + 0.003 * Math.sin(phi * 19 + t * 23) * Math.sin(t * 29);
  }
  return 0.01;
}
const HNB = [0, 0, 0], HNA = [0, 0, 0], HNC = [0, 0, 0];
function hairPt(M, phi, Y, T, o) { // 頭表面 (phi, Y) 往外推 T（參考頭的公尺）
  headRef(M, phi, Y, o);
  headRef(M, phi + 0.03, Y, HNA); headRef(M, phi, Y + 0.003, HNB);
  const ux = HNA[0] - o[0], uy = HNA[1] - o[1], uz = HNA[2] - o[2], vx = HNB[0] - o[0], vy = HNB[1] - o[1], vz = HNB[2] - o[2];
  let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
  let l = Math.hypot(nx, ny, nz);
  if (l < 1e-12) { nx = o[0] - M.headX; ny = o[1] - M.eyeY; nz = o[2]; l = Math.hypot(nx, ny, nz) || 1; }
  nx /= l; ny /= l; nz /= l;
  if ((o[0] - M.headX) * nx + (o[1] - (M.eyeY + 0.01 * M.hs)) * ny + o[2] * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  o[0] += nx * T * M.hs; o[1] += ny * T * M.hs; o[2] += nz * T * M.hs;
  return o;
}
function genHair(M) {
  chunkStart();
  const L = M.L, st = L.hair;
  if (st === 'bald') return chunkEnd();
  const K = M.hk, hat = L.hat !== 'none' && L.hat, crown = K.F.crown;
  // 戴帽子：帽子下面的頭髮看不到 → 只做到帽緣裡面一點（少一半的三角形；頭頂那個洞在帽子裡面）
  const nu = HEAD_PHI.length, nv = hat ? 4 : HAIR_ROWS, T = M.tiles.hair, TC = M.tiles.curl, curly = st === 'curly' || st === 'perm';
  const drop = st === 'long' || (st === 'short' && M.fem) || curly;
  const Yw = 0.02 * K.cranK;
  gpSize(nu * (nv + 1));
  const HL = HEAD_PHI.map((p) => hairlineY(M, p)), TH = new Float32Array(nu * nv), YS = new Float32Array(nu * nv), TT = new Float32Array(nu * nv);
  const wide = [0, 0, 0];
  for (let i = 0; i < nu; i++) {
    const phi = HEAD_PHI[i], hl = HL[i], hy = hat ? hatLine(M, phi) : 9, top = hat ? clamp(hy + 0.01, hl + 0.002, crown) : crown;
    let rw = 0;
    if (drop) { hairPt(M, phi, Yw, hairThick(M, phi, 0.4), wide); rw = Math.hypot(wide[0] - M.headX, wide[2]); }
    for (let j = 0; j < nv; j++) {
      const tj = j / (nv - 1), Y = lerp(hl, top, hat ? tj : 1 - Math.pow(1 - tj, 1.25)), t = hat ? clamp(1 - Math.pow(1 - clamp((Y - hl) / Math.max(crown - hl, 1e-4), 0, 1), 0.8), 0, 1) : tj;
      TT[j * nu + i] = t;
      let th = hairThick(M, phi, t);
      if (hat) { const cap = L.hat === 'helmet' ? 0.003 : L.hat === 'straw' ? 0.008 : 0.005; th = lerp(th, Math.min(th, cap), sstep(hy - 0.012, hy + 0.004, Y)); }
      hairPt(M, phi, Y, th, Q3);
      if (drop && Y < Yw) { // 在頭最寬那圈下面：頭髮垂直往下（不會貼著脖子）
        const dx = Q3[0] - M.headX, r = Math.hypot(dx, Q3[2]), want = rw * (1 - 0.1 * clamp((Yw - Y) / 0.1, 0, 1)) * (curly ? 1.02 : 1);
        if (r < want && r > 1e-6) { Q3[0] = M.headX + (dx / r) * want; Q3[2] = (Q3[2] / r) * want; }
      }
      gset(j * nu + i, Q3[0], Q3[1], Q3[2]); TH[j * nu + i] = th; YS[j * nu + i] = Y;
    }
  }
  wt(B.head);
  gridEmit(nu, nv, true, (i, j) => {
    const t = TT[j * nu + i];
    mat(R_HAIR, 0.5, (0.8 + 0.25 * t) * (1 - 0.1 * gs(HEAD_PHI[i] - PI, 0.5) * (1 - t)));
    const R = curly ? TC : T;
    GU = R[0] + (0.03 + (Math.abs(HEAD_PHI[i]) / PI) * 0.94) * (R[2] - R[0]); GV = R[1] + (0.03 + t * 0.94) * (R[3] - R[1]);
  }, [M.headX, M.eyeY + 0.01 * M.hs, 0]);
  // 髮際線那圈的邊（頭髮的厚度）：裡面那圈就是頭（皮膚）網格最上面那圈（同一個點，沒有縫）
  lipRing(M, nu, (i, o) => { hairPt(M, HEAD_PHI[i], HL[i], TH[i], o); }, (i, o) => headRef(M, HEAD_PHI[i], HL[i], o), [0, -1, 0], (i) => { wt(B.head); mat(R_HAIR, 0.85, 0.5); GU = T[0] + 0.5 * (T[2] - T[0]); GV = T[1] + 0.02 * (T[3] - T[1]); void i; }, 0.15);
  if (st === 'long') longCurtain(M);
  if (st === 'ponytail') ponytail(M);
  if (st === 'bun') hairBun(M);
  return chunkEnd();
}
// 長髮：兩邊、後面垂到背上（有厚度）
function longCurtain(M) {
  const K = M.hk, T = M.tiles.hair, cols = [];
  for (const p of HEAD_PHI) if (Math.abs(p) >= 58 * D2R) cols.push(p);
  cols.sort((a, b) => (a < 0 ? a + TAV : a) - (b < 0 ? b + TAV : b)); // 從右前（+）繞過後面到左前（−）
  const nu = cols.length, rows = 6, y1 = -0.29 - (M.kid ? -0.06 : 0), Yw = 0.02 * K.cranK;
  gpSize(nu * rows * 2);
  const top = [0, 0, 0], wide = [0, 0, 0];
  for (let i = 0; i < nu; i++) {
    const phi = cols[i], y0 = hairlineY(M, phi) + 0.004;
    // 從頭髮那層最下面那圈接下來（同一個半徑：頭最寬那圈直直垂下來）
    hairPt(M, phi, Yw, hairThick(M, phi, 0.4), wide); const rw = Math.hypot(wide[0] - M.headX, wide[2]);
    hairPt(M, phi, y0, hairThick(M, phi, 0), top);
    const dx0 = top[0] - M.headX, rr = Math.hypot(dx0, top[2]), ux = dx0 / rr, uz = top[2] / rr;
    const r0 = Math.max(rr, rw * (1 - 0.1 * clamp((Yw - y0) / 0.1, 0, 1)) - 0.002 * M.hs);
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), Y = lerp(y0, y1, t);
      const back = 0.05 * sstep(0.05, 0.55, t) * M.hs, flare = 1 + 0.25 * sstep(0.1, 0.7, t) + 0.05 * Math.sin(phi * 9 + t * 4) * t;
      const r = r0 * flare;
      const wav = 0.006 * M.hs * Math.sin(phi * 11 + (M.L.seed || 0)) * t;
      const ox = M.headX + ux * (r + wav) - back * (0.6 + 0.4 * Math.abs(Math.sin(phi))), oy = M.eyeY + Y * M.hs, oz = uz * (r + wav) * (1 + 0.15 * t * Math.abs(Math.sin(phi)));
      const lift = j === rows - 1 ? 0.012 * M.hs * Math.abs(Math.sin(phi * 5 + 1)) : 0; // 髮尾不齊
      gset(j * nu + i, ox, oy + lift, oz);
      const th = 0.011 * M.hs * (1 - 0.5 * t);
      gset((rows + j) * nu + i, ox - ux * th, oy + lift, oz - uz * th);
    }
  }
  const P = GP.slice(0, nu * rows * 2 * 3);
  const wHair = (t) => { wAdd(B.head, 1 - sstep(0.1, 0.8, t)); wAdd(B.chest, sstep(0.1, 0.8, t)); wFlush(); };
  for (const inner of [0, 1]) {
    gpSize(nu * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < nu; i++) { const k = ((inner * rows + j) * nu + i) * 3; gset(j * nu + i, P[k], P[k + 1], P[k + 2]); }
    const b0 = VN;
    gridEmit(nu, rows, false, (i, j) => { wHair(j / (rows - 1)); mat(R_HAIR, 0.55, inner ? 0.5 : 0.82 + 0.1 * (1 - j / (rows - 1))); GU = T[0] + (0.03 + (i / (nu - 1)) * 0.94) * (T[2] - T[0]); GV = T[1] + (0.97 - (j / (rows - 1)) * 0.94) * (T[3] - T[1]); }, (j) => [M.headX - 0.02, M.eyeY + lerp(-0.08, y1, j / (rows - 1)) * M.hs, 0], inner === 1);
    void b0;
  }
  // 髮尾那條邊、兩邊的邊（權重跟旁邊的頭髮一樣：頭轉的時候不會裂開；法線朝外面，斜著看才不會反光變成亮線）
  const edge = (ks, tf, nf) => { // ks：[外面的點 index, 裡面的點 index] 一串；tf(n)：第幾排（權重）；nf(n, out)：法線
    const b = VN, N = [0, 0, 0];
    ks.forEach(([ko, ki], n) => { nf(n, N); for (const kk of [ko, ki]) { const k = kk * 3; wHair(tf(n)); mat(R_HAIR, 0.85, 0.42); vtx(P[k], P[k + 1], P[k + 2], N[0], N[1], N[2], T[0] + 0.5 * (T[2] - T[0]), T[1] + 0.03 * (T[3] - T[1])); } });
    for (let n = 0; n < ks.length - 1; n++) { const a = b + n * 2, c = a + 2; tri(a, c, a + 1); tri(a + 1, c, c + 1); tri(a, a + 1, c); tri(a + 1, c + 1, c); }
  };
  const radial = (k, N) => { const x = P[k * 3] - M.headX, z = P[k * 3 + 2], l = Math.hypot(x, z) || 1; N[0] = (x / l) * 0.85; N[1] = -0.5; N[2] = (z / l) * 0.85; };
  const along = (k, k2, N) => { const x = P[k * 3] - P[k2 * 3], z = P[k * 3 + 2] - P[k2 * 3 + 2], l = Math.hypot(x, z) || 1; N[0] = x / l; N[1] = 0; N[2] = z / l; };
  edge(Array.from({ length: nu }, (_, i) => [(rows - 1) * nu + i, (2 * rows - 1) * nu + i]), () => 1, (n, N) => radial((rows - 1) * nu + n, N));
  edge(Array.from({ length: rows }, (_, j) => [j * nu, (rows + j) * nu]), (n) => n / (rows - 1), (n, N) => along(n * nu, n * nu + 1, N));
  edge(Array.from({ length: rows }, (_, j) => [j * nu + nu - 1, (rows + j) * nu + nu - 1]), (n) => n / (rows - 1), (n, N) => along(n * nu + nu - 1, n * nu + nu - 2, N));
}
const TAV = TAU;
function ponytail(M) {
  const T = M.tiles.hair, hs = M.hs, nu = 7, rows = 7;
  const bx = M.headX - 0.1 * hs, by = M.eyeY + 0.035 * hs, len = (M.kid ? 0.2 : 0.26) * hs;
  gpSize(nu * rows);
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1), cx = bx - 0.045 * hs * Math.sin(t * PI * 0.55) - 0.01 * hs * t, cy = by - len * Math.pow(t, 1.15) + 0.01 * hs * Math.sin(t * PI);
    const r = hs * (t < 0.08 ? 0.017 : lerp(0.024, 0.006, Math.pow((t - 0.08) / 0.92, 1.3)) * (1 + 0.15 * Math.sin(t * PI)));
    for (let i = 0; i < nu; i++) { const p = (i / nu) * TAU; gset(j * nu + i, cx + Math.cos(p) * r * 0.9, cy, Math.sin(p) * r); }
  }
  gridEmit(nu, rows, true, (i, j) => {
    const t = j / (rows - 1); wAdd(B.head, 1 - sstep(0.1, 0.5, t)); wAdd(B.tail, sstep(0.1, 0.5, t)); wFlush();
    mat(R_HAIR, 0.5, 0.85); GU = T[0] + (0.1 + (i / nu) * 0.8) * (T[2] - T[0]); GV = T[1] + (0.97 - t * 0.94) * (T[3] - T[1]);
  }, (j) => { const t = j / (rows - 1); return [bx - 0.045 * hs * Math.sin(t * PI * 0.55), by - len * t, 0]; });
  // 髮圈
  const band = linColor('#2a2226');
  gpSize(nu * 2);
  for (let j = 0; j < 2; j++) for (let i = 0; i < nu; i++) { const p = (i / nu) * TAU, r = 0.0185 * hs; gset(j * nu + i, bx + 0.004 * hs - j * 0.012 * hs + Math.cos(p) * r * 0.9, by + 0.004 * hs - j * 0.003 * hs, Math.sin(p) * r); }
  gridEmit(nu, 2, true, () => { wt(B.head); mat(R_FIX, 0.6, band[0], band[1], band[2]); GU = M.tiles.skin[0]; GV = M.tiles.skin[1]; }, [bx, by, 0]);
}
function hairBun(M) {
  const T = M.tiles.curl, hs = M.hs, nu = 9, rows = 6, cx = M.headX - 0.078 * hs, cy = M.eyeY + 0.085 * hs, r = 0.036 * hs * (M.kid ? 0.85 : 1);
  gpSize(nu * rows);
  for (let j = 0; j < rows; j++) {
    const a = (j / (rows - 1)) * PI, y = Math.cos(a), rr = Math.sin(a);
    for (let i = 0; i < nu; i++) { const p = (i / nu) * TAU, bump = 1 + 0.06 * Math.sin(p * 3 + j * 1.7); gset(j * nu + i, cx + Math.cos(p) * rr * r * bump - 0.2 * r * rr, cy + y * r * 0.8, Math.sin(p) * rr * r * bump); }
  }
  wt(B.head);
  gridEmit(nu, rows, true, (i, j) => { mat(R_HAIR, 0.5, 0.8 + 0.1 * Math.cos((j / (rows - 1)) * PI)); GU = T[0] + (0.05 + (i / nu) * 0.9) * (T[2] - T[0]); GV = T[1] + (0.05 + (j / (rows - 1)) * 0.9) * (T[3] - T[1]); }, [cx - 0.2 * r, cy, 0]);
}

// ---- 帽子 ----
function genHat(M) {
  chunkStart();
  const L = M.L, hat = L.hat;
  if (!hat || hat === 'none') return chunkEnd();
  const K = M.hk, hs = M.hs, nu = HEAD_PHI.length, crown = K.F.crown, TH = M.tiles.hat;
  const hairT = (phi, Y) => (L.hair === 'bald' ? 0 : Y > hairlineY(M, phi) - 0.004 ? (L.hat === 'helmet' ? 0.003 : 0.005) : 0);
  wt(B.head);
  if (hat === 'straw') { strawHat(M); return chunkEnd(); }
  const shell = hat === 'helmet' ? 0.021 : 0.006, nv = hat === 'helmet' ? 7 : 6;
  gpSize(nu * nv);
  const HY = HEAD_PHI.map((p) => hatLine(M, p));
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const t = j / (nv - 1), phi = HEAD_PHI[i], Y = lerp(HY[i], crown, 1 - Math.pow(1 - t, 1.3));
    const bulge = hat === 'helmet' ? 0.004 * Math.sin(t * PI) : hat === 'cap' ? 0.003 * Math.sin(t * PI) : 0.004 * sstep(0.2, 0.8, t);
    hairPt(M, phi, Y, hairT(phi, Y) + shell + bulge + (L.hair === 'curly' || L.hair === 'perm' ? 0.006 : 0), Q3);
    gset(j * nu + i, Q3[0], Q3[1], Q3[2]);
  }
  const rim = GP.slice(0, nu * 3);
  gridEmit(nu, nv, true, (i, j) => {
    const t = j / (nv - 1);
    mat(R_HAT, hat === 'helmet' ? 0.22 : 0.85, 0.9 + 0.12 * t);
    GU = TH[0] + (0.03 + (Math.abs(HEAD_PHI[i]) / PI) * 0.94) * 0.5 * (TH[2] - TH[0]) + (hat === 'helmet' ? 0.5 * (TH[2] - TH[0]) : 0); GV = TH[1] + (0.5 + t * 0.47) * (TH[3] - TH[1]);
  }, [M.headX, M.eyeY + 0.02 * hs, 0]);
  // 帽子的邊
  const dark = hat === 'helmet' ? linColor('#1b1c1f') : null;
  lipRing(M, nu, (i, o) => { o[0] = rim[i * 3]; o[1] = rim[i * 3 + 1]; o[2] = rim[i * 3 + 2]; }, (i, o) => hairPt(M, HEAD_PHI[i], HY[i] + 0.004, hairT(HEAD_PHI[i], HY[i]), o), [0, -1, 0], () => { if (dark) mat(R_FIX, 0.6, dark[0], dark[1], dark[2]); else mat(R_HAT, 0.9, 0.55); GU = TH[0] + 0.02; GV = TH[1] + 0.5 * (TH[3] - TH[1]); });
  if (hat === 'cap') brim(M, HY, hairT, 0.075, -0.18, 58, R_HAT, null);
  if (hat === 'bucket') brim(M, HY, hairT, 0.05, -0.55, 180, R_HAT, null);
  if (hat === 'helmet') { // 護目鏡（掀起來的深色鏡片）＋下巴的帶子
    brim(M, HY.map((y) => y + 0.004 * K.cranK), (p, y) => hairT(p, y) + shell, 0.03, -0.9, 70, R_FIX, linColor('#23272d'));
    chinStrap(M);
  }
  return chunkEnd();
}
// 帽簷：從帽緣往外（ext 公尺、往下彎 droop）；span：前面幾度（180＝一整圈）
function brim(M, HY, hairT, ext, droop, span, role, col) {
  const hs = M.hs, full = span >= 180, cols = [];
  HEAD_PHI.forEach((p, i) => { if (full || Math.abs(p) <= span * D2R + 1e-6) cols.push(i); });
  if (!full) cols.sort((a, b) => HEAD_PHI[a] - HEAD_PHI[b]);
  const nu = cols.length, nv = full ? 2 : 3, TH = M.tiles.hat; // 一整圈的帽簷（漁夫帽）是斜的圓錐：兩圈就夠
  const inner = [0, 0, 0];
  gpSize(nu * nv);
  for (let a = 0; a < nu; a++) {
    const i = cols[a], phi = HEAD_PHI[i];
    hairPt(M, phi, HY[i], hairT(phi, HY[i]) + 0.004, inner);
    const dx = inner[0] - M.headX, r = Math.hypot(dx, inner[2]), ux = dx / r, uz = inner[2] / r;
    const e = ext * hs * (full ? 1 : Math.pow(Math.cos(phi * 0.9), 0.6));
    for (let j = 0; j < nv; j++) {
      const t = j / (nv - 1), d = e * t, curl = full ? 0 : 0.012 * hs * Math.sin(phi) * Math.sin(phi) * t;
      gset(j * nu + a, inner[0] + ux * d, inner[1] + droop * d * (0.7 + 0.3 * t) - curl, inner[2] + uz * d);
    }
  }
  const P = GP.slice(0, nu * nv * 3), th = 0.004 * hs;
  for (const side of [0, 1]) {
    gpSize(nu * nv);
    for (let k = 0; k < nu * nv; k++) gset(k, P[k * 3], P[k * 3 + 1] - side * th, P[k * 3 + 2]);
    const c = [M.headX, M.eyeY + (side ? 1 : -1) * 0.5, 0];
    gridEmit(nu, nv, full, (i, j) => {
      if (col) mat(role, 0.12, col[0] * (side ? 0.6 : 1), col[1] * (side ? 0.6 : 1), col[2] * (side ? 0.6 : 1)); else mat(role, 0.85, side ? 0.5 : 0.95);
      GU = TH[0] + (0.05 + (i / (nu - 1)) * 0.4) * (TH[2] - TH[0]); GV = TH[1] + (0.05 + j * 0.2) * (TH[3] - TH[1]);
    }, c);
  }
  // 外緣
  const b = VN;
  for (let a = 0; a < nu; a++) for (const side of [0, 1]) {
    const k = ((nv - 1) * nu + a) * 3;
    if (col) mat(role, 0.12, col[0] * 0.5, col[1] * 0.5, col[2] * 0.5); else mat(role, 0.9, 0.6);
    vtx(P[k], P[k + 1] - side * th, P[k + 2], P[k] - M.headX, 0, P[k + 2], TH[0] + 0.02, TH[1] + 0.02);
  }
  for (let a = 0; a < (full ? nu : nu - 1); a++) { // 只做朝外的那面（看三角形法線跟往外的方向）
    const a1 = (a + 1) % nu, p = b + a * 2, q = b + a1 * 2, k0 = ((nv - 1) * nu + a) * 3, k1 = ((nv - 1) * nu + a1) * 3;
    const ex = P[k1] - P[k0], ez = P[k1 + 2] - P[k0 + 2], ox = P[k0] + P[k1] - 2 * M.headX, oz = P[k0 + 2] + P[k1 + 2];
    if (ez * ox - ex * oz > 0) { tri(p, q, p + 1); tri(q, q + 1, p + 1); } else { tri(p, p + 1, q); tri(q, p + 1, q + 1); }
  }
}
function chinStrap(M) {
  const K = M.hk, col = linColor('#26282c');
  for (const sd of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, phi = sd * lerp(88, 18, t) * D2R, Y = lerp(-0.045 * K.faceK, K.F.chinB + 0.004, sstep(0, 1, t));
      hairPt(M, phi, Y, 0.0025, Q3); pts.push([Q3[0], Q3[1], Q3[2]]);
    }
    const b = VN, w = 0.006 * M.hs;
    for (const p of pts) for (const e of [-1, 1]) { mat(R_FIX, 0.6, col[0], col[1], col[2]); vtx(p[0] + e * w * 0.3, p[1] + e * w, p[2], p[0] - M.headX, 0, p[2], M.tiles.skin[0], M.tiles.skin[1]); }
    for (let k = 0; k < 4; k++) { const a = b + k * 2; tri(a, a + 2, a + 1); tri(a + 1, a + 2, a + 3); tri(a, a + 1, a + 2); tri(a + 1, a + 3, a + 2); }
  }
}
function strawHat(M) { // 斗笠：一個大圓錐（上面、下面兩面）
  const hs = M.hs, K = M.hk, nu = 24, straw = linColor('#d7b673'), TH = M.tiles.hat;
  const cx = M.headX - 0.008 * hs, apex = M.eyeY + (K.F.crown + 0.085) * hs, baseY = M.eyeY + (K.F.crown - 0.045) * hs, R = (M.kid ? 0.2 : 0.235) * Math.max(0.9, M.s);
  for (const side of [0, 1]) {
    const nv = 4; gpSize(nu * nv);
    for (let j = 0; j < nv; j++) {
      const t = j / (nv - 1), r = R * t, y = lerp(apex, baseY, t) - side * 0.012 * hs * (1 - t * 0.6) + 0.006 * hs * Math.sin(t * PI) * (1 - side);
      for (let i = 0; i < nu; i++) { const p = (i / nu) * TAU; gset(j * nu + i, cx + Math.cos(p) * r, y, Math.sin(p) * r); }
    }
    gridEmit(nu, nv, true, (i, j) => {
      const t = j / (nv - 1); mat(R_FIX, 0.9, straw[0] * (side ? 0.55 : 0.95 + 0.08 * t), straw[1] * (side ? 0.55 : 0.95 + 0.08 * t), straw[2] * (side ? 0.5 : 0.95 + 0.08 * t));
      GU = TH[0] + (0.75 + 0.148 * Math.cos((i / nu) * TAU) * t) * (TH[2] - TH[0]); GV = TH[1] + (0.225 + 0.2 * Math.sin((i / nu) * TAU) * t) * (TH[3] - TH[1]);
    }, [cx, side ? apex + 1 : apex - 1, 0]);
  }
  // 斗笠的邊
  const b = VN;
  for (let i = 0; i < nu; i++) for (const side of [0, 1]) { const p = (i / nu) * TAU; mat(R_FIX, 0.9, straw[0] * 0.7, straw[1] * 0.7, straw[2] * 0.65); vtx(cx + Math.cos(p) * R, baseY - side * 0.012 * hs * 0.4, Math.sin(p) * R, Math.cos(p), -0.3, Math.sin(p), TH[0] + 0.02, TH[1] + 0.02); }
  for (let i = 0; i < nu; i++) { const q = b + ((i + 1) % nu) * 2, p = b + i * 2; tri(p, p + 1, q); tri(q, p + 1, q + 1); }
  // 綁在下巴的帶子
  const tie = linColor('#3b3129');
  for (const sd of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3, phi = sd * lerp(92, 30, t) * D2R, Y = lerp(K.F.crown - 0.05, K.F.chinB + 0.002, t); hairPt(M, phi, Y, 0.003 + (L0hair(M) && t < 0.5 ? 0.008 : 0), Q3); pts.push([Q3[0], Q3[1], Q3[2]]); }
    const b2 = VN, w = 0.004 * hs;
    for (const p of pts) for (const e of [-1, 1]) { mat(R_FIX, 0.8, tie[0], tie[1], tie[2]); vtx(p[0] + e * w, p[1], p[2], p[0] - M.headX, 0, p[2], M.tiles.skin[0], M.tiles.skin[1]); }
    for (let k = 0; k < 3; k++) { const a = b2 + k * 2; tri(a, a + 2, a + 1); tri(a + 1, a + 2, a + 3); tri(a, a + 1, a + 2); tri(a + 1, a + 3, a + 2); }
  }
}
const L0hair = (M) => M.L.hair !== 'bald' && M.L.hair !== 'buzz';

// ---- 眼鏡、口罩 ----
function genGlasses(M) {
  chunkStart();
  const g = M.L.glasses;
  if (!g || g === 'none') return chunkEnd();
  const K = M.hk, F = K.F, hs = M.hs, sun = g === 'sunglasses';
  const frame = linColor(sun ? '#141416' : '#2a2522'), lens = linColor('#101216');
  headRef(M, 0.36, 0, Q3); const fx = (Q3[0] - M.headX) / hs + 0.012; // 鏡框在眼睛前面 1.2 公分
  const hw = (sun ? 0.025 : 0.021) * (M.kid ? 0.9 : 1), hh = (sun ? 0.018 : 0.0155) * (M.kid ? 0.9 : 1), ex = F.eyeX + 0.0015, ey = 0.001;
  const P = (x, y, z) => [M.headX + x * hs, M.eyeY + y * hs, z * hs];
  wt(B.head);
  const tube = (pts, r, closed) => { // 細管子（3 邊）
    const n = pts.length, b = VN;
    for (let k = 0; k < n; k++) {
      const p = pts[k], q = pts[(k + 1) % n], o = pts[(k - 1 + n) % n];
      let tx = (closed || (k > 0 && k < n - 1) ? q[0] - o[0] : k === 0 ? q[0] - p[0] : p[0] - o[0]), ty = (closed || (k > 0 && k < n - 1) ? q[1] - o[1] : k === 0 ? q[1] - p[1] : p[1] - o[1]), tz = (closed || (k > 0 && k < n - 1) ? q[2] - o[2] : k === 0 ? q[2] - p[2] : p[2] - o[2]);
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let ax = 1, ay = 0, az = 0; if (Math.abs(tx) > 0.9) { ax = 0; ay = 1; }
      let bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax; const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      const cx = by * tz - bz * ty, cy = bz * tx - bx * tz, cz = bx * ty - by * tx;
      for (let s = 0; s < 3; s++) { const a = (s / 3) * TAU, c = Math.cos(a), sn = Math.sin(a); const nx = bx * c + cx * sn, ny = by * c + cy * sn, nz = bz * c + cz * sn; mat(R_FIX, 0.35, frame[0], frame[1], frame[2]); vtx(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r, nx, ny, nz, M.tiles.skin[0], M.tiles.skin[1]); }
    }
    for (let k = 0; k < (closed ? n : n - 1); k++) for (let s = 0; s < 3; s++) { const k1 = (k + 1) % n, s1 = (s + 1) % 3, a = b + k * 3 + s, c = b + k * 3 + s1, d = b + k1 * 3 + s, e = b + k1 * 3 + s1; tri(a, d, c); tri(c, d, e); }
  };
  const r = (sun ? 0.0022 : 0.0014) * hs;
  for (const sd of [-1, 1]) {
    const pts = [], n = 12;
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU, c = Math.cos(a), sn = Math.sin(a); const z = sd * ex + spow(c, 0.6) * hw, y = ey + spow(sn, 0.6) * hh * (sn < 0 ? 0.92 : 1) - (sun ? 0.003 * (1 - Math.abs(c)) * (sn < 0 ? 1 : 0) : 0); headRef(M, Math.asin(clamp(z / 0.078, -1, 1)), y, Q3b); const x = Math.max(fx - 0.004 * Math.abs(z - sd * ex) / hw, (Q3b[0] - M.headX) / hs + 0.006); pts.push(P(x, y, z)); }
    tube(pts, r, true);
    if (sun) { // 鏡片：扇形
      const c0 = VN; mat(R_FIX, 0.08, lens[0], lens[1], lens[2]);
      const ctr = pts.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]);
      vtx(ctr[0] + 0.001, ctr[1], ctr[2], 1, 0, sd * 0.15, M.tiles.skin[0], M.tiles.skin[1]);
      for (const p of pts) vtx(p[0], p[1], p[2], 1, 0, sd * 0.2, M.tiles.skin[0], M.tiles.skin[1]);
      for (let k = 0; k < n; k++) { const a = c0 + 1 + k, b2 = c0 + 1 + ((k + 1) % n); if (sd > 0) tri(c0, b2, a); else tri(c0, a, b2); }
    }
    // 鏡腳：從鏡框外側到耳朵上面
    K.tab(0.006, HT); const W = HT[1];
    tube([P(fx - 0.004, ey + hh * 0.5, sd * (ex + hw)), P(0.02, 0.006, sd * (W + 0.004)), P(-0.012, 0.004, sd * (W + 0.003)), P(-0.022, -0.012, sd * (W - 0.002))], r * 0.85, false);
  }
  tube([P(fx + 0.002, ey + hh * 0.35, -(ex - hw)), P(fx + 0.004, ey + hh * 0.45, 0), P(fx + 0.002, ey + hh * 0.35, ex - hw)], r, false); // 鼻樑架
  return chunkEnd();
}
function genMask(M) {
  chunkStart();
  if (!M.L.mask) return chunkEnd();
  const K = M.hk, F = K.F, hs = M.hs, nu = 11, nv = 7, col = linColor(M.L.maskColor || DEF.maskColor), T = M.tiles.mask;
  const phis = Array.from({ length: nu }, (_, i) => lerp(-64, 64, i / (nu - 1)) * D2R);
  const ys = Array.from({ length: nv }, (_, j) => lerp(F.noseTop - 0.016, F.chinB - 0.004, j / (nv - 1)));
  gpSize(nu * nv);
  const col3 = [];
  for (let i = 0; i < nu; i++) {
    const xs = ys.map((Y) => { headRef(M, phis[i], Y, Q3); return [(Q3[0] - M.headX) / hs, Q3[2] / hs]; });
    // 上面凸包：從鼻尖直直拉到下巴（口罩不會貼進人中、嘴巴）
    const hull = xs.map((p) => p[0]);
    for (let a = 0; a < nv; a++) for (let b = a + 2; b < nv; b++) for (let m = a + 1; m < b; m++) { const t = (ys[m] - ys[a]) / (ys[b] - ys[a]), x = lerp(xs[a][0], xs[b][0], t); if (x > hull[m]) hull[m] = x; }
    for (let j = 0; j < nv; j++) { const x = hull[j] + 0.0045 + 0.003 * Math.cos(phis[i]), z = xs[j][1] * (1 + 0.04); gset(j * nu + i, M.headX + x * hs, M.eyeY + ys[j] * hs + (j === 0 ? 0.002 * hs * Math.cos(phis[i] * 2) : 0), z * hs); }
    col3.push(xs);
  }
  wt(B.head);
  gridEmit(nu, nv, false, (i, j) => { mat(R_FIX, 0.9, col[0], col[1], col[2]); GU = T[0] + (i / (nu - 1)) * (T[2] - T[0]); GV = T[1] + (1 - j / (nv - 1)) * (T[3] - T[1]); }, [M.headX, M.eyeY - 0.05 * hs, 0]);
  // 耳掛（細帶子）：口罩兩邊上下角 → 耳朵後面
  const strapC = [col[0] * 0.95, col[1] * 0.95, col[2] * 0.95];
  for (const sd of [-1, 1]) for (const top of [0, 1]) {
    const k = ((top ? 0 : nv - 1) * nu + (sd < 0 ? 0 : nu - 1)) * 3, a = [GP[k], GP[k + 1], GP[k + 2]];
    const pts = [a];
    for (let q = 1; q <= 3; q++) { const t = q / 3, phi = sd * lerp(66, 100, t) * D2R, Y = lerp(top ? F.noseTop - 0.016 : F.chinB + 0.01, top ? 0.004 : -0.035, t); hairPt(M, phi, Y, 0.0022, Q3); pts.push([Q3[0], Q3[1], Q3[2]]); }
    const b = VN, w = 0.0016 * hs;
    for (const p of pts) for (const e of [-1, 1]) { mat(R_FIX, 0.9, strapC[0], strapC[1], strapC[2]); vtx(p[0], p[1] + e * w, p[2], p[0] - M.headX, 0, p[2], M.tiles.skin[0], M.tiles.skin[1]); }
    for (let q = 0; q < 3; q++) { const a2 = b + q * 2; tri(a2, a2 + 2, a2 + 1); tri(a2 + 1, a2 + 2, a2 + 3); tri(a2, a2 + 1, a2 + 2); tri(a2 + 1, a2 + 3, a2 + 2); }
  }
  void col3;
  return chunkEnd();
}

// ---- 貼圖集（1024 × 1024，大家共用一張）：每個點 = 底色（頂點顏色）× 乘數（A × 2）＋ 加上去的顏色（RGB，sRGB）----
//   皮膚、衣服的顏色都是頂點顏色；貼圖只畫「變暗、變亮、蓋上去的顏色」：眼白、瞳孔、眉毛、嘴唇、鈕扣、拉鍊、縫線、花⋯⋯
//   所以一張貼圖可以給每個人用（不管膚色、衣服什麼顏色），一個人一個 draw call
const ATW = 1024, ATH = 1024;
const TILE = {}; // 名字 → [u0, v 下, u1, v 上]（v 往上＝畫布往上）
const tileAt = (name, x, y, w, h) => (TILE[name] = [x / ATW, (y + h) / ATH, (x + w) / ATW, y / ATH]);
for (let k = 0; k < 8; k++) tileAt('face' + k, (k % 4) * 256, Math.floor(k / 4) * 256, 256, 256);
const TOP_KEYS = ['tee', 'shirt', 'polo', 'hoodie', 'jacket', 'vest', 'undershirt', 'uniform', 'floral'];
TOP_KEYS.forEach((k, i) => tileAt('top_' + k, (i % 8) * 128, 512 + Math.floor(i / 8) * 256, 128, 256));
const BOT_KEYS = ['jeans', 'pants', 'track', 'shorts', 'skirt'];
BOT_KEYS.forEach((k, i) => tileAt('bot_' + k, 128 + i * 128, 768, 128, 256));
// 雜項（x 768…1024、y 768…1024）
tileAt('hair', 768, 768, 128, 96); tileAt('curl', 768, 864, 128, 96);
tileAt('ear', 768, 960, 48, 40); tileAt('hand', 816, 960, 48, 40); tileAt('skin', 864, 960, 16, 16); tileAt('belt', 864, 980, 32, 8);
tileAt('mask', 896, 960, 64, 48); tileAt('shoe', 896, 768, 128, 96); tileAt('hat', 896, 864, 128, 96);
const skinUV = () => { const t = TILE.skin; return [(t[0] + t[2]) / 2, (t[1] + t[3]) / 2]; };
function tilesFor(L) {
  const face = faceIndex(L);
  return {
    face: TILE['face' + face], top: TILE['top_' + (TOPS[L.top] ? L.top : 'tee')], bottom: TILE['bot_' + (BOTTOMS[L.bottom] ? L.bottom : 'jeans')],
    hair: TILE.hair, curl: TILE.curl, ear: TILE.ear, hand: TILE.hand, skin: skinUV(), belt: TILE.belt, mask: TILE.mask, shoe: TILE.shoe, hat: TILE.hat,
  };
}
function faceIndex(L) { // 0/1 男、2/3 女、4 男生小孩、5 女生小孩、6 阿伯、7 阿嬤
  const v = (L.face | 0) & 1;
  if (L.age === 'kid') return L.body === 'f' ? 5 : 4;
  if (L.age === 'elder') return L.body === 'f' ? 7 : 6;
  return (L.body === 'f' ? 2 : 0) + v;
}
let ATLAS = null;
function atlas() {
  if (ATLAS !== null) return ATLAS || null;
  if (typeof document === 'undefined') { ATLAS = false; return null; } // 沒有 DOM（node 測試）：不畫貼圖
  try { ATLAS = paintAtlas(); } catch (e) { console.warn('character atlas', e); ATLAS = false; }
  return ATLAS || null;
}
// 畫貼圖集：兩張畫布一起畫 —— gm＝乘數（灰階，128＝不變）、gr＝加上去的顏色（黑＝不加）；最後合成一張 DataTexture
//   fill(形狀, { k, col, a, line, blur, add })：k＝底色留幾成（1 不變、<1 變暗、>1 變亮）；col＝蓋上去的顏色（有 col 沒有 add：底色留 k 成，預設 0＝整個蓋掉）
//   add＝只加顏色（腮紅、反光）；line＝描線的寬（沒有＝填滿）；blur＝模糊幾像素
function painter(gm, gr) {
  const gray = (k) => { const v = clamp(Math.round(128 * k), 0, 255); return `rgb(${v},${v},${v})`; };
  const run = (g, path, style, o) => {
    g.save(); g.globalAlpha = o.a === undefined ? 1 : o.a; if (o.blur) g.filter = `blur(${o.blur}px)`;
    path(g);
    const st = typeof style === 'function' ? style(g) : style;
    if (o.line) { g.lineWidth = o.line; g.lineCap = o.cap || 'round'; g.lineJoin = 'round'; g.strokeStyle = st; g.stroke(); } else { g.fillStyle = st; g.fill(); }
    g.restore();
  };
  return {
    both(f) { f(gm); f(gr); },
    fill(path, o = {}) {
      if (o.col) { if (!o.add) run(gm, path, gray(o.k || 0), o); run(gr, path, o.col, o); } else run(gm, path, gray(o.k === undefined ? 1 : o.k), o);
    },
  };
}
// 常用的形狀（在目前的座標系統裡）
const pEll = (x, y, rx, ry, rot = 0) => (g) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); };
const pRect = (x, y, w, h) => (g) => { g.beginPath(); g.rect(x, y, w, h); };
const pLine = (pts) => (g) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
const pCurve = (pts) => (g) => { // 平順曲線（經過每一點）
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], i === pts.length - 2 ? pts[i + 1][0] : mx, i === pts.length - 2 ? pts[i + 1][1] : my); }
  if (pts.length === 2) g.lineTo(pts[1][0], pts[1][1]);
};
const radial = (x, y, r, stops) => (g) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); for (const [t, c] of stops) gr.addColorStop(t, c); return gr; };
// 虛線（縫線）
function stitch(P, pts, o) {
  const seg = o.seg || 3, gap = o.gap || 2;
  const path = (g) => { g.beginPath(); g.setLineDash([seg, gap]); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
  P.fill(path, { line: 1, cap: 'butt', ...o });
  P.both((g) => g.setLineDash([]));
}

function paintAtlas() {
  const cv = () => { const c = document.createElement('canvas'); c.width = ATW; c.height = ATH; return c; };
  const cM = cv(), cR = cv(), gm = cM.getContext('2d', { willReadFrequently: true }), gr = cR.getContext('2d', { willReadFrequently: true });
  if (!gm || !gr) return null;
  gm.fillStyle = '#808080'; gm.fillRect(0, 0, ATW, ATH); gr.fillStyle = '#000'; gr.fillRect(0, 0, ATW, ATH);
  const P = painter(gm, gr);
  const tile = (x, y, w, h, fn) => { P.both((g) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); }); fn(); P.both((g) => g.restore()); };
  for (let k = 0; k < 8; k++) paintFace(P, k);
  TOP_KEYS.forEach((key, i) => tile((i % 8) * 128, 512 + Math.floor(i / 8) * 256, 128, 256, () => paintTop(P, key)));
  BOT_KEYS.forEach((key, i) => tile(128 + i * 128, 768, 128, 256, () => paintBottom(P, key)));
  tile(768, 768, 128, 96, () => paintHair(P, false)); tile(768, 864, 128, 96, () => paintHair(P, true));
  tile(768, 960, 48, 40, () => paintEar(P)); tile(816, 960, 48, 40, () => paintHand(P)); tile(864, 980, 32, 8, () => paintBelt(P));
  tile(896, 960, 64, 48, () => paintMask(P)); tile(896, 768, 128, 96, () => paintShoes(P)); tile(896, 864, 128, 96, () => paintHat(P));
  // 合成：RGB＝加的顏色、A＝乘數
  const dm = gm.getImageData(0, 0, ATW, ATH).data, dr = gr.getImageData(0, 0, ATW, ATH).data, out = new Uint8Array(ATW * ATH * 4);
  for (let i = 0, n = ATW * ATH * 4; i < n; i += 4) { out[i] = dr[i]; out[i + 1] = dr[i + 1]; out[i + 2] = dr[i + 2]; out[i + 3] = dm[i]; }
  const tex = new THREE.DataTexture(out, ATW, ATH, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

// ---- 臉：八張（0/1 男、2/3 女、4 男生小孩、5 女生小孩、6 阿伯、7 阿嬤）；座標＝參考頭的公尺（跟 faceUV 一樣：左右 z、上下 Y）----
function paintFace(P, k) {
  const fem = k === 2 || k === 3 || k === 5 || k === 7, kid = k === 4 || k === 5, eld = k >= 6, alt = k === 1 || k === 3;
  const K = headKind(fem, kid), F = K.F, x0 = (k % 4) * 256, y0 = Math.floor(k / 4) * 256, Y0 = F.chinB - 0.011;
  P.both((g) => { g.save(); g.beginPath(); g.rect(x0, y0, 256, 256); g.clip(); g.setTransform(1600, 0, 0, -1280, x0 + 128, y0 + 256 + Y0 * 1280); });
  const R = mulberry(71 + k * 13), fill = P.fill;
  const lipW = F.lipW * (eld ? 0.95 : 1), ym = F.mouth;
  // 1) 整片的膚色變化：臉頰、鼻頭紅一點；眼窩、鬍子那區暗一點
  for (const sd of [-1, 1]) {
    fill(pEll(sd * 0.044, -0.03, 0.026, 0.02), { col: radial(sd * 0.044, -0.03, 0.026, [[0, 'rgba(205,85,75,1)'], [1, 'rgba(205,85,75,0)']]), add: true, a: fem ? 0.2 : kid ? 0.26 : eld ? 0.12 : 0.1 });
    fill(pEll(sd * 0.031, 0.004, 0.021, 0.012), { k: fem ? 0.86 : 0.88, blur: 4 }); // 眼窩
    fill(pEll(sd * 0.012, -0.006, 0.006, 0.012), { k: 0.9, blur: 3 }); // 鼻樑旁邊
  }
  fill(pEll(0, F.noseTip + 0.001, 0.009, 0.007), { col: 'rgba(210,95,85,1)', add: true, a: 0.07, blur: 3 });
  if (!fem && !kid) { // 鬍子的影子（刮過的）
    const beard = (g) => { g.beginPath(); g.ellipse(0, ym + 0.011, 0.022, 0.009, 0, 0, TAU); g.ellipse(0, F.chin - 0.003, 0.024, 0.015, 0, 0, TAU); g.ellipse(-0.046, ym - 0.012, 0.018, 0.03, 0.5, 0, TAU); g.ellipse(0.046, ym - 0.012, 0.018, 0.03, -0.5, 0, TAU); };
    fill(beard, { k: alt ? 0.86 : eld ? 0.92 : 0.93, blur: 4 });
    if (alt || eld) { // 鬍渣
      const dots = [];
      for (let n = 0; n < 520; n++) {
        const z = (R() * 2 - 1) * 0.062, y = lerp(F.chinB + 0.002, F.noseBase - 0.003, R());
        const inBeard = (Math.abs(z) < 0.024 && y > ym + 0.004 && y < F.noseBase - 0.004) || (y < ym - 0.006 && Math.abs(z) < 0.03 + 0.03 * clamp((ym - 0.006 - y) / 0.03, 0, 1) + 0.035 * clamp((y - F.chinB) / 0.06, 0, 1) * (Math.abs(z) > 0.03 ? 1 : 0));
        if (inBeard && !(Math.abs(z) < lipW * 1.05 && y < ym + 0.007 && y > ym - 0.009)) dots.push([z, y]);
      }
      const dotsPath = (g) => { g.beginPath(); for (const [z, y] of dots) { g.moveTo(z + 0.0005, y); g.ellipse(z, y, 0.0005, 0.0005, 0, 0, TAU); } };
      if (eld) fill(dotsPath, { col: '#b8b4ae', k: 0.6, a: 0.45 }); else fill(dotsPath, { k: 0.72, a: 0.45 });
    }
  }
  // 2) 眼睛
  for (const sd of [-1, 1]) {
    const cx = sd * F.eyeX, cy = 0.0006, hw = 0.0142 * F.eyeW, hu = (alt ? 0.0046 : 0.0052) * (kid ? 1.12 : 1) * (fem ? 1.05 : 1), hl = 0.0034 * (kid ? 1.1 : 1);
    const ix = cx - sd * hw, iy = cy - 0.0008, ox = cx + sd * hw, oy = cy + (eld ? 0.0001 : 0.0011);
    const upper = [cx - sd * hw * 0.5, cy + hu * 1.35, cx + sd * hw * 0.45, cy + hu * 1.3];
    const eye = (g) => { g.beginPath(); g.moveTo(ix, iy); g.bezierCurveTo(upper[0], upper[1], upper[2], upper[3], ox, oy); g.bezierCurveTo(cx + sd * hw * 0.4, cy - hl * 1.25, cx - sd * hw * 0.5, cy - hl * 1.2, ix, iy); g.closePath(); };
    const lid = (g) => { g.beginPath(); g.moveTo(ix, iy); g.bezierCurveTo(upper[0], upper[1], upper[2], upper[3], ox, oy); };
    const low = (g) => { g.beginPath(); g.moveTo(ox, oy); g.bezierCurveTo(cx + sd * hw * 0.4, cy - hl * 1.25, cx - sd * hw * 0.5, cy - hl * 1.2, ix, iy); };
    // 眼皮、眼影（上眼皮那塊暗一點）
    fill(pEll(cx + sd * 0.002, cy + hu + 0.0012, hw * 1.05, 0.0048), { k: fem ? 0.84 : 0.9, blur: 3 });
    fill(eye, { col: '#d6cec6' });
    P.both((g) => { g.save(); eye(g); g.clip(); });
    fill(pRect(cx - hw * 1.2, cy + hu * 0.15, hw * 2.4, hu * 2), { col: '#6d5f57', a: 0.4 }); // 上眼皮的影子
    const ir = 0.0056 * (kid ? 1.07 : 1), icx = cx + sd * 0.0004, icy = cy - 0.0002;
    fill(pEll(icx, icy, ir, ir), { col: radial(icx, icy - 0.001, ir, [[0, '#6e4a32'], [0.45, '#50311f'], [0.85, '#2f1c11'], [1, '#1a100a']]) });
    fill(pRect(icx - ir, icy + ir * 0.25, ir * 2, ir), { col: '#140c08', a: 0.35 }); // 虹膜上面被眼皮擋住的影子
    fill(pEll(icx, icy, 0.0021, 0.0021), { col: '#0b0806' });
    fill(pEll(icx - 0.0017, icy + 0.0019, 0.0008, 0.0008), { col: '#f5f1ec', a: 0.85 }); // 反光
    P.both((g) => g.restore());
    // 睫毛線（上）、下眼皮、內眼角
    fill(lid, { col: '#16100d', k: 0.1, line: fem ? 0.0016 : kid ? 0.0012 : 0.0011 });
    fill(pCurve([[cx + sd * hw * 0.3, cy + hu * 0.95], [cx + sd * hw * 0.8, cy + hu * 0.6], [ox + sd * (fem ? 0.0028 : 0.0006), oy + (fem ? 0.0012 : 0.0002)]]), { col: '#16100d', k: 0.1, line: fem ? 0.0017 : 0.0012 });
    fill(low, { k: 0.72, a: 0.5, line: 0.0007 });
    fill(pEll(ix + sd * 0.0011, iy + 0.0002, 0.0011, 0.0009), { col: '#b97f76', k: 0.3, a: 0.7 });
    if (alt || fem || kid) fill(pCurve([[cx - sd * hw * 0.45, cy + hu + 0.0024], [cx + sd * hw * 0.3, cy + hu + 0.003], [cx + sd * hw * 0.95, cy + hu * 0.55 + 0.0016]]), { k: 0.78, a: 0.6, line: 0.0006, blur: 0.5 }); // 雙眼皮
    fill(pEll(cx + sd * 0.001, cy - hl - 0.0032, hw * 0.85, 0.0026), { k: eld ? 0.8 : 0.9, blur: 2.5 }); // 眼睛下面
    if (eld) {
      fill(pCurve([[cx - sd * hw * 0.6, cy - hl - 0.004], [cx + sd * hw * 0.1, cy - hl - 0.0062], [cx + sd * hw * 0.8, cy - hl - 0.0035]]), { k: 0.75, a: 0.6, line: 0.0006 });
      for (const dy of [0.0032, 0.0002, -0.0028]) fill(pLine([[ox + sd * 0.0022, oy + dy * 0.6], [ox + sd * 0.009, oy + dy * 1.6]]), { k: 0.76, a: 0.55, line: 0.0005 }); // 魚尾紋
    }
  }
  // 3) 眉毛
  for (const sd of [-1, 1]) {
    const by = F.browY, t0 = fem ? 0.0042 : kid ? 0.0036 : alt ? 0.0068 : 0.0058, t1 = fem ? 0.0012 : 0.002, pk = fem ? 0.0058 : 0.0038;
    const a = [sd * 0.0105, by - 0.0006], b = [sd * 0.033, by + pk], c = [sd * 0.053, by - 0.0022 - (eld ? 0.0022 : 0)];
    const brow = (g) => {
      g.beginPath(); g.moveTo(a[0], a[1] + t0 * 0.5); g.quadraticCurveTo(b[0], b[1] + t0 * 0.45, c[0], c[1] + t1 * 0.5);
      g.lineTo(c[0], c[1] - t1 * 0.5); g.quadraticCurveTo(b[0], b[1] - t0 * 0.4, a[0], a[1] - t0 * 0.5); g.closePath();
    };
    const col = eld ? (fem ? '#7c766f' : '#6c6862') : kid ? '#3b2d24' : fem ? '#2a1f19' : '#1e1713';
    fill(brow, { col, k: 0.3, a: kid ? 0.55 : fem ? 0.75 : 0.85, blur: 0.6 });
    const hairs = (g) => { // 一根一根的毛
      g.beginPath();
      for (let n = 0; n < 26; n++) {
        const t = n / 25, x = lerp(a[0], c[0], t), yb = lerp(a[1], c[1], t) + 4 * t * (1 - t) * (b[1] - (a[1] + c[1]) / 2), th = lerp(t0, t1, t);
        const y = yb + (((n * 7) % 5) / 4 - 0.5) * th * 0.8, ang = lerp(1.1, 0.25, t);
        g.moveTo(x, y); g.lineTo(x + sd * Math.cos(ang) * 0.004, y + Math.sin(ang) * 0.003);
      }
    };
    fill(hairs, { col, k: 0.2, a: kid ? 0.35 : 0.5, line: 0.0005 });
  }
  // 4) 鼻子：鼻孔、鼻翼的溝、鼻子下面
  for (const sd of [-1, 1]) {
    fill(pEll(sd * 0.0066, F.noseBase + 0.0014, 0.0033, 0.0016, sd * 0.35), { k: 0.28, a: 0.9, blur: 0.8 });
    fill(pCurve([[sd * 0.0112, F.noseBase + 0.0078], [sd * 0.0148, F.noseBase + 0.0022], [sd * 0.0096, F.noseBase - 0.0012]]), { k: 0.74, a: 0.7, line: 0.0009, blur: 0.8 });
  }
  fill(pEll(0, F.noseBase - 0.0016, 0.0042, 0.0016), { k: 0.84, blur: 1.2 });
  // 5) 嘴巴
  const lk = F.lip, hu = 0.0062 * lk * (eld ? 0.72 : 1) * (kid ? 0.85 : 1), hl = 0.0082 * lk * (eld ? 0.78 : 1) * (kid ? 0.9 : 1), cyc = ym + (fem || kid ? 0.0007 : 0.0002);
  const upperLip = (g) => {
    g.beginPath(); g.moveTo(-lipW, cyc);
    g.quadraticCurveTo(-lipW * 0.55, ym + hu * 0.8, -lipW * 0.2, ym + hu); g.quadraticCurveTo(-lipW * 0.08, ym + hu * 1.02, 0, ym + hu * 0.8);
    g.quadraticCurveTo(lipW * 0.08, ym + hu * 1.02, lipW * 0.2, ym + hu); g.quadraticCurveTo(lipW * 0.55, ym + hu * 0.8, lipW, cyc);
    g.quadraticCurveTo(0, ym - 0.0006, -lipW, cyc); g.closePath();
  };
  const lowerLip = (g) => {
    g.beginPath(); g.moveTo(-lipW, cyc); g.quadraticCurveTo(0, ym - 0.0005, lipW, cyc);
    g.bezierCurveTo(lipW * 0.75, ym - hl * 0.85, lipW * 0.35, ym - hl * 1.05, 0, ym - hl); g.bezierCurveTo(-lipW * 0.35, ym - hl * 1.05, -lipW * 0.75, ym - hl * 0.85, -lipW, cyc); g.closePath();
  };
  const lipC = eld ? (fem ? '#86484a' : '#764640') : kid ? '#b0625c' : fem ? (alt ? '#a8444a' : '#983c44') : '#7a3f38';
  fill(upperLip, { col: lipC, k: fem ? 0.42 : 0.5, a: eld ? 0.65 : 0.82, blur: 0.5 });
  fill(lowerLip, { col: lipC, k: fem ? 0.46 : 0.54, a: eld ? 0.6 : 0.78, blur: 0.5 });
  fill(pEll(0, ym - hl * 0.45, lipW * 0.4, hl * 0.22), { col: '#ffffff', add: true, a: 0.08, blur: 1 });
  fill(pCurve([[-lipW * 1.02, cyc], [0, ym - 0.0006], [lipW * 1.02, cyc]]), { k: 0.32, a: 0.85, line: 0.0011 });
  for (const sd of [-1, 1]) {
    fill(pEll(sd * lipW * 1.03, cyc, 0.001, 0.0009), { k: 0.5, a: 0.6, blur: 0.6 });
    fill(pLine([[sd * 0.0035, F.noseBase - 0.0022], [sd * 0.0052, ym + hu * 0.95]]), { k: 0.9, a: 0.6, line: 0.0012, blur: 1.2 }); // 人中
    if (eld) {
      fill(pCurve([[sd * 0.0135, F.noseBase + 0.006], [sd * 0.024, F.noseBase - 0.012], [sd * (lipW + 0.004), ym - 0.006]]), { k: 0.7, a: 0.8, line: 0.0014, blur: 1 }); // 法令紋
      fill(pCurve([[sd * (lipW + 0.001), ym - 0.001], [sd * (lipW + 0.0035), ym - 0.009], [sd * (lipW + 0.003), ym - 0.017]]), { k: 0.8, a: 0.6, line: 0.0009, blur: 0.6 });
    } else if (!kid) fill(pCurve([[sd * 0.0135, F.noseBase + 0.005], [sd * 0.022, F.noseBase - 0.01], [sd * (lipW + 0.003), ym - 0.003]]), { k: 0.9, a: 0.5, line: 0.0016, blur: 2 });
  }
  fill(pEll(0, ym - hl - 0.005, lipW * 0.6, 0.004), { k: 0.88, blur: 2.5 }); // 下唇下面
  if (eld) { // 抬頭紋、老人斑
    for (const [y, a] of [[0.036, 0.5], [0.045, 0.6], [0.054, 0.45]]) fill(pCurve([[-0.036, y + 0.001], [-0.012, y - 0.0012], [0.012, y + 0.0012], [0.036, y - 0.0006]]), { k: 0.8, a, line: 0.0007, blur: 0.4 });
    for (let n = 0; n < 7; n++) { const z = (R() * 2 - 1) * 0.06, y = lerp(-0.045, 0.05, R()); if (Math.abs(z) > 0.02 || y > 0.03) fill(pEll(z, y, 0.0016 + R() * 0.001, 0.0014), { col: '#5a3a28', k: 0.62, a: 0.22, blur: 0.8 }); }
  }
  P.both((g) => g.restore());
}

// ---- 上衣（128 × 256）：x 0＝正前面中間 → 64 側邊 → 128 正後面；y：袖子在上面（肩 → 手腕），軀幹在下面（領口 y≈83 → 下擺 y≈252）----
function paintTop(P, key) {
  const top = TOPS[key], fill = P.fill, H = 1.72, refM = { s: 1, neckBaseY: 0.842 * H };
  const hemY = top.tuck ? 0.595 * H - 0.05 : top.hem * H, nb = refM.neckBaseY;
  const Ty = (y) => 256 * (0.985 - 0.66 * clamp((y - hemY) / (nb - hemY), 0, 1)); // 軀幹的高度（公尺）→ 畫布 y
  const Tx = (phi) => (0.03 + (Math.abs(phi) / PI) * 0.94) * 128;
  const Sy = (f) => 256 * (0.3 - 0.29 * (1 - (f + 0.094) / 1.08)); // 袖子：f（肩 0 → 手腕 1）→ 畫布 y
  const e = 0.172 / 0.32, sl = top.sleeve === 'long' ? 0.985 : (top.sleeve || 0) * e, R = mulberry(key.length * 977 + key.charCodeAt(0));
  const neckAt = (x) => Ty(necklineY(refM, top, ((x / 128 - 0.03) / 0.94) * PI));
  const neckPts = (dy) => { const pts = []; for (let x = 0; x <= 128; x += 4) pts.push([x, neckAt(x) + dy]); return pts; };
  const dark = (o) => ({ k: 0.8, a: 0.8, ...o }), sew = { k: 0.72, a: 0.6, seg: 2.2, gap: 1.6 };
  // 布的皺摺（軟軟的明暗）
  const fold = (pts, k, w, blur = 3) => fill(pCurve(pts), { k, line: w, blur });
  const rib = (y0, y1, x0 = 0, x1 = 128, step = 2.5) => { for (let x = x0 + 1; x < x1; x += step) fill(pLine([[x, y0], [x, y1]]), { k: 0.88, a: 0.7, line: 0.8 }); fill(pRect(x0, y0, x1 - x0, y1 - y0), { k: 0.94 }); };
  // 側邊的縫、肩膀的縫
  fill(pLine([[64, 80], [64, 256]]), dark({ line: 1.2, k: 0.78 }));
  if (!top.tuck) { stitch(P, [[0, 247], [128, 247]], sew); fill(pRect(0, 249, 128, 7), { k: 0.9 }); }
  // 軀幹的皺摺
  if (!top.tuck) { fold([[40, 200], [56, 214], [70, 226]], 0.86, 4); fold([[44, 186], [62, 196], [80, 204]], 0.9, 3); fold([[48, 218], [60, 232]], 1.1, 3); fold([[70, 150], [88, 170]], 0.9, 3); }
  else for (let x = 8; x < 128; x += 13 + R() * 6) fold([[x, 256], [x + 2, 236 + R() * 8]], 0.84, 2.5, 1.5); // 紮進去：腰上面鼓起來的小皺摺
  fold([[52, 100], [60, 118], [64, 132]], 0.88, 4); fold([[76, 100], [70, 120]], 0.9, 3); // 腋下
  fold([[12, 150], [30, 146]], 0.95, 5, 5); fold([[90, 140], [120, 150]], 0.93, 6, 6); // 胸、背
  // 袖子：肩膀的縫、袖口
  if (sl > 0) {
    stitch(P, [[0, Sy(0.03)], [128, Sy(0.03)]], { ...sew, a: 0.4 });
    fold([[50, Sy(0.06)], [64, Sy(0.14)], [76, Sy(0.08)]], 0.86, 3, 2);
    const cy = Sy(sl);
    if (top.sleeve === 'long') {
      for (const f of [e - 0.03, e, e + 0.03]) fold([[0, Sy(f)], [30, Sy(f) + 1], [60, Sy(f)]], 0.84, 1.8, 1.2); // 手肘內側的皺摺
      fold([[4, Sy(0.3)], [30, Sy(0.36)]], 0.9, 3, 2);
      const cw = top.cuff === 2 ? 5 : 4;
      if (top.cuff === 2 || top.rib) rib(cy - cw, cy + 3); else { fill(pRect(0, cy - cw, 128, cw + 3), { k: 0.93 }); stitch(P, [[0, cy - cw], [128, cy - cw]], sew); }
      if (top.cuff === 1) fill(pEll(100, cy - 2, 1.6, 1.2), { col: '#e9e5dc', k: 0.2 }); // 袖口的扣子
    } else if (top.rib) rib(cy - 4, cy + 3); else { stitch(P, [[0, cy - 3], [128, cy - 3]], sew); fill(pRect(0, cy - 2.5, 128, 6), { k: 0.93 }); }
  }
  // 領口
  const nk = top.neck;
  if (nk === 'crew' || nk === 'scoop' || nk === 'deep') {
    const band = nk === 'crew' ? 5 : 3;
    fill((g) => { const a = neckPts(-2), b = neckPts(band).reverse(); g.beginPath(); g.moveTo(a[0][0], a[0][1]); for (const p of a) g.lineTo(p[0], p[1]); for (const p of b) g.lineTo(p[0], p[1]); g.closePath(); }, { k: 0.9 });
    stitch(P, neckPts(band), sew);
  }
  if (nk === 'collar' || nk === 'polo' || nk === 'blouse' || nk === 'stand' || nk === 'hood') fill(pLine(neckPts(1)), { k: 0.75, line: 2, a: 0.6 });
  // 前面的門襟、扣子
  const placket = (yTop, yBot, n, col = '#ece8e0') => {
    fill(pLine([[6.5, yTop], [6.5, yBot]]), { k: 0.78, line: 1, a: 0.7 }); stitch(P, [[5, yTop], [5, yBot]], { ...sew, a: 0.35 });
    for (let q = 0; q < n; q++) { const y = lerp(yTop + 6, yBot - 4, n > 1 ? q / (n - 1) : 0); fill(pEll(2.2, y, 2.1, 1.7), { col, k: 0.25 }); fill(pEll(2.2, y + 0.6, 2.1, 1.7), { k: 0.8, a: 0.4, line: 0.6 }); }
  };
  const vNeck = neckAt(0);
  switch (key) {
    case 'tee': break;
    case 'shirt': placket(vNeck, 256, 6); pocket(P, 18, Ty(1.2), 22, 24, sew); break;
    case 'uniform':
      placket(vNeck, 256, 5, '#f2f0ea'); pocket(P, 18, Ty(1.2), 20, 22, sew);
      for (let q = 0; q < 4; q++) { const x = 17 + q * 5.2, y = Ty(1.2) - 7; fill(pLine([[x, y - 2], [x + 3, y - 2], [x + 1.5, y - 3.5], [x + 1.5, y + 2], [x, y + 1]]), { col: '#2c4f9e', k: 0.1, line: 0.9 }); } // 繡的學號（藍線）
      break;
    case 'polo': placket(vNeck, vNeck + 32, 2); fill(pRect(0, vNeck, 8, 32), { k: 0.95 }); stitch(P, [[60, 256], [60, 240], [68, 240], [68, 256]], sew); break;
    case 'hoodie': case 'jacket': {
      // 拉鍊（正前面中間）
      fill(pRect(0, 83, 3.2, 173), { col: key === 'jacket' ? '#3a3a3c' : '#2b2b2e', k: 0.3 });
      for (let y = 84; y < 256; y += 2.2) fill(pRect(0, y, 2.8, 1), { col: '#9a9a9c', k: 0.2, a: 0.8 });
      fill(pLine([[4.5, 83], [4.5, 256]]), { k: 0.75, line: 1, a: 0.6 }); stitch(P, [[7, 88], [7, 250]], sew);
      fill(pRect(0, 92, 6, 9), { col: '#8e8e90', k: 0.2 }); // 拉鍊頭
      if (key === 'hoodie') {
        for (const x of [8, 11]) { fill(pCurve([[x, 86], [x + 1, 110], [x - 1, 128]]), { col: '#f1efe8', k: 0.3, line: 1.6 }); fill(pRect(x - 2, 126, 3, 6), { col: '#d8d6d0', k: 0.2 }); } // 帽繩
        fill(pCurve([[14, 256 - 60], [30, 256 - 30], [36, 256 - 12]]), { k: 0.7, line: 1.6, a: 0.8 }); stitch(P, [[16, 256 - 58], [32, 256 - 28], [38, 256 - 12]], sew); // 口袋
        fill((g) => { g.beginPath(); g.moveTo(92, 83); g.quadraticCurveTo(128, 88, 128, 130); g.lineTo(128, 83); g.closePath(); }, { k: 0.8, blur: 3 }); // 背後的帽子（摺起來的影子）
        fill(pCurve([[88, 84], [104, 118], [128, 134]]), { k: 0.7, line: 2, a: 0.8 });
        rib(238, 256); rib(80, 88);
      } else {
        fill(pCurve([[4, 122], [40, 124], [64, 118]]), { k: 0.8, line: 1.2, a: 0.7 }); stitch(P, [[4, 126], [40, 128], [64, 122]], sew); // 胸口的拼接
        fill(pLine([[26, 196], [36, 222]]), { k: 0.55, line: 2 }); fill(pLine([[28, 195], [38, 221]]), { k: 1.2, line: 0.8, a: 0.6 }); // 口袋
        rib(242, 256); fill(pRect(0, 80, 128, 9), { k: 0.9 }); stitch(P, [[0, 89], [128, 89]], sew);
      }
      break;
    }
    case 'vest': case 'undershirt': {
      // 袖口（大大的袖孔）的滾邊：側邊肩膀下面一個 U
      fill((g) => { g.beginPath(); g.moveTo(40, 80); g.quadraticCurveTo(46, 128, 64, 132); g.quadraticCurveTo(84, 128, 90, 80); }, { k: 0.82, line: 3, a: 0.8 });
      if (key === 'undershirt') { for (let x = 1; x < 128; x += 2) fill(pLine([[x, 80], [x, 256]]), { k: 0.92, line: 0.7 }); } // 羅紋
      break;
    }
    case 'floral': { // 阿嬤的花襯衫：碎花
      placket(vNeck, 256, 5, '#f4efe6');
      const flowers = [];
      for (let n = 0; n < 150; n++) flowers.push([R() * 128, R() * 256, 2.2 + R() * 2.2, R() * TAU, Math.floor(R() * 3)]);
      const cols = ['#f3e6da', '#f0c7cf', '#f2dc8c'];
      for (const [x, y, r, rot, c] of flowers) {
        const petals = (g) => { g.beginPath(); for (let q = 0; q < 5; q++) { const a = rot + (q / 5) * TAU; g.moveTo(x + Math.cos(a) * r * 0.55 + r * 0.45, y + Math.sin(a) * r * 0.55); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, r * 0.3, a, 0, TAU); } };
        fill(petals, { col: cols[c], k: 0.25, a: 0.85 });
        fill(pEll(x, y, r * 0.22, r * 0.22), { col: '#8a5a2a', k: 0.2 });
        fill(pEll(x + Math.cos(rot + 2.5) * r * 1.3, y + Math.sin(rot + 2.5) * r * 1.3, r * 0.5, r * 0.22, rot + 2.5), { col: '#4e6e3a', k: 0.35, a: 0.7 });
      }
      break;
    }
  }
}
// 口袋：x、y（左上角）、寬、高
function pocket(P, x, y, w, h, sew) {
  P.fill(pRect(x, y, w, h), { k: 0.8, line: 0.9, a: 0.7 });
  stitch(P, [[x + 1.5, y + 1.5], [x + w - 1.5, y + 1.5], [x + w - 1.5, y + h - 1.5], [x + 1.5, y + h - 1.5], [x + 1.5, y + 1.5]], sew);
  P.fill(pRect(x, y + 1, w, 3), { k: 1.06 });
}

// ---- 褲子、裙子（128 × 256）：x 0＝前面中間（腿：腿的正前面）→ 64 側邊 → 128 後面；y：腿在上面（腳踝 y≈3 → 髖 y≈187），骨盆那段在下面（褲頭 y≈192 → 胯下 y≈251）----
function paintBottom(P, key) {
  const fill = P.fill, R = mulberry(key.charCodeAt(0) * 31 + key.length);
  const Ly = (f) => 256 * (0.73 - 0.72 * clamp(f, 0, 1)), Py = (v) => 256 * (0.98 - 0.23 * v);
  const kf = (0.51 - 0.285) / (0.51 - 0.045); // 膝蓋在腿的幾成（成年人）
  const gold = '#c9954a', dsew = { k: 0.7, a: 0.55, seg: 2.2, gap: 1.6 };
  const goldSew = (pts) => stitch(P, pts, { col: gold, k: 0.35, a: 0.9, seg: 2, gap: 1.4 });
  const seamSew = key === 'jeans' ? goldSew : (pts) => stitch(P, pts, dsew);
  if (key === 'skirt') { // 百褶裙
    for (let x = 0; x < 128; x += 8) { fill(pRect(x, 0, 4, 187), { k: 0.9 }); fill(pLine([[x, 0], [x, 187]]), { k: 0.72, line: 0.9 }); fill(pLine([[x + 4, 0], [x + 4, 187]]), { k: 1.12, line: 0.8, a: 0.7 }); }
    stitch(P, [[0, 7], [128, 7]], dsew); fill(pRect(0, 178, 128, 10), { k: 0.9 }); stitch(P, [[0, 178], [128, 178]], dsew);
    fill(pRect(0, 188, 128, 68), { k: 0.9 });
    return;
  }
  const hem = key === 'shorts' ? kf * 0.62 : key === 'track' ? 0.975 : 0.985;
  // 布料的紋路
  if (key === 'jeans') {
    for (let d = -256; d < 128; d += 2.2) fill(pLine([[d, 256], [d + 256, 0]]), { k: 0.9, line: 0.6, a: 0.8 }); // 斜紋
    for (let n = 0; n < 60; n++) { const x = R() * 128, y = R() * 256; fill(pEll(x, y, 2 + R() * 5, 0.8 + R() * 1.5), { k: 1.14, a: 0.25, blur: 1.5 }); }
    fill(pEll(18, Ly(0.28), 20, 42), { k: 1.2, a: 0.6, blur: 10 }); // 大腿前面洗白
    fill(pEll(14, Ly(kf), 16, 14), { k: 1.16, a: 0.6, blur: 7 }); // 膝蓋
    for (let q = 0; q < 5; q++) fill(pLine([[4 + q * 2, Ly(0.06 + q * 0.025)], [22 + q * 4, Ly(0.02 + q * 0.03)]]), { k: 1.25, a: 0.5, line: 1.2, blur: 1 }); // 貓鬚
    fill(pRect(58, 0, 12, 256), { k: 0.9, blur: 3 });
  } else if (key === 'track') {
    for (let y = 0; y < 256; y += 3) fill(pLine([[0, y], [128, y]]), { k: 0.96, line: 0.8 });
  } else {
    for (let n = 0; n < 40; n++) { const x = R() * 128, y = R() * 190; fill(pEll(x, y, 3 + R() * 6, 1 + R()), { k: 1.06, a: 0.3, blur: 2 }); }
  }
  // 腿：側邊的縫、膝蓋後面的皺摺、褲管
  fill(pLine([[64, 0], [64, 190]]), { k: 0.75, line: 1.2, a: 0.8 }); seamSew([[61.5, 0], [61.5, 188]]);
  for (let q = 0; q < 3; q++) fill(pCurve([[96, Ly(kf) - 4 + q * 3.5], [112, Ly(kf) - 2 + q * 3], [128, Ly(kf) - 4 + q * 3.5]]), { k: 0.84, line: 1.4, blur: 1.2 });
  fill(pCurve([[4, Ly(0.9)], [20, Ly(0.93)], [40, Ly(0.9)]]), { k: 0.88, line: 2.5, blur: 2 }); // 褲管堆在鞋子上
  const hy = Ly(hem);
  if (key === 'track') { for (let x = 1; x < 128; x += 2.5) fill(pLine([[x, hy - 8], [x, hy + 2]]), { k: 0.86, line: 0.8 }); }
  else { fill(pRect(0, hy - 5, 128, 6), { k: 0.9 }); seamSew([[0, hy - 5], [128, hy - 5]]); }
  if (key === 'pants') fill(pLine([[1.5, 0], [1.5, 187]]), { k: 1.14, line: 1.2, a: 0.8 }); // 褲子的摺線
  if (key === 'track') { for (const x of [56, 60]) fill(pRect(x, 0, 2.2, 190), { col: '#f1f1ee', k: 0.15 }); } // 兩條白線
  // 骨盆那段：褲頭、口袋、拉鍊
  const wb = key === 'track' ? 14 : 10;
  fill(pRect(0, 188, 128, wb + 4), { k: 0.9 });
  if (key === 'track') { for (let x = 1; x < 128; x += 3) fill(pLine([[x, 190], [x + 1, 190 + wb]]), { k: 0.82, line: 0.9 }); for (const x of [5, 9]) fill(pCurve([[x, 196], [x + 1, 214], [x - 1, 226]]), { col: '#efede6', k: 0.3, line: 1.3 }); return; }
  seamSew([[0, 192 + wb - 1], [128, 192 + wb - 1]]); seamSew([[0, 193], [128, 193]]);
  for (const x of [10, 46, 84, 118]) { fill(pRect(x - 1.5, 189, 3, wb + 5), { k: 0.8, line: 0.8 }); } // 皮帶環
  // 前面：拉鍊蓋（J 字）、斜口袋
  fill(pCurve([[1, 202], [9, 204], [10, 226], [4, 236], [0, 238]]), { k: 0.72, line: 1.2, a: 0.8 }); seamSew([[7, 204], [7.5, 226], [3, 234]]);
  fill(pCurve([[18, 202], [34, 214], [52, 222], [60, 222]]), { k: 0.55, line: 1.6 }); seamSew([[20, 205], [35, 216], [56, 224]]);
  // 後面：口袋（簡單的五角形，不是任何牌子的圖案）
  if (key === 'jeans' || key === 'shorts') {
    const pk = (g) => { g.beginPath(); g.moveTo(84, 205); g.lineTo(120, 205); g.lineTo(119, 236); g.lineTo(102, 242); g.lineTo(85, 236); g.closePath(); };
    fill(pk, { k: 0.8, line: 1.1, a: 0.7 }); fill(pk, { k: 1.05, a: 0.4 });
    seamSew([[86, 207], [118, 207]]); seamSew([[86.5, 207], [87, 234], [102, 239.5], [117, 234], [117.5, 207]]);
    fill((g) => { g.beginPath(); g.moveTo(64, 214); g.lineTo(128, 206); }, { k: 0.75, line: 1.1, a: 0.7 }); seamSew([[64, 216], [128, 208]]); // 後面的拼接
  } else { fill(pLine([[88, 214], [116, 214]]), { k: 0.5, line: 1.6 }); seamSew([[88, 211.5], [116, 211.5]]); }
}

// ---- 頭髮：一絲一絲（直的）、捲髮：一圈一圈 ----
function paintHair(P, curly) {
  const fill = P.fill, R = mulberry(curly ? 17 : 5);
  if (!curly) {
    for (let n = 0; n < 260; n++) { const x = R() * 128, w = 0.5 + R() * 1.2, k = 0.72 + R() * 0.55; fill(pCurve([[x, 96], [x + (R() - 0.5) * 3, 48], [x + (R() - 0.5) * 4, 0]]), { k, line: w, a: 0.55 }); }
    for (let n = 0; n < 40; n++) { const x = R() * 128; fill(pLine([[x, 96], [x + (R() - 0.5) * 2, 0]]), { k: 1.3, line: 0.6, a: 0.35 }); } // 亮的髮絲
    fill(pRect(0, 88, 128, 8), { k: 0.8, blur: 2 });
  } else {
    fill(pRect(0, 0, 128, 96), { k: 0.9 });
    for (let n = 0; n < 420; n++) { const x = R() * 128, y = R() * 96, r = 1.4 + R() * 2.4; fill(pEll(x, y, r, r * 0.8, R() * 3), { k: 1.25, line: 0.8, a: 0.5 }); fill(pEll(x + 0.6, y + 0.8, r * 0.6, r * 0.45), { k: 0.62, a: 0.35 }); }
  }
}
// 耳朵：上半（y 0～20）是後面、下半（y 20～40）是前面（耳窩）；x 從上前方繞到耳垂
function paintEar(P) {
  const fill = P.fill;
  fill(pRect(0, 0, 48, 40), { col: 'rgba(200,80,70,1)', add: true, a: 0.07 });
  fill(pEll(24, 32, 16, 6), { k: 0.72, blur: 2.5 }); // 耳窩
  fill(pCurve([[6, 25], [24, 27], [42, 25]]), { k: 1.1, line: 2, blur: 1 }); // 對耳輪
  fill(pEll(26, 37, 4, 2.5), { k: 0.5, blur: 1.5 }); // 耳洞
  fill(pRect(0, 20, 48, 2.5), { k: 1.08 });
  fill(pRect(0, 0, 48, 6), { k: 0.85, blur: 2 });
}
function paintHand(P) {
  const fill = P.fill;
  for (const y of [27, 13]) fill(pLine([[22, y], [48, y]]), { k: 0.84, line: 1.2, blur: 0.8 }); // 指節
  fill(pRect(22, 0, 26, 4), { col: 'rgba(205,110,100,1)', add: true, a: 0.1 }); // 指尖
}
function paintBelt(P) {
  const fill = P.fill;
  stitch(P, [[3, 1.2], [32, 1.2]], { k: 0.7, a: 0.5, seg: 1.2, gap: 1 }); stitch(P, [[3, 6.8], [32, 6.8]], { k: 0.7, a: 0.5, seg: 1.2, gap: 1 });
  fill(pRect(0, 0.6, 3.2, 6.8), { col: '#b9b7ae', k: 0.15 }); fill(pRect(0.8, 1.8, 1.6, 4.4), { k: 0.4 }); // 皮帶頭
  for (const x of [6, 8, 10]) fill(pEll(x, 4, 0.5, 0.6), { k: 0.35 });
}
function paintMask(P) {
  const fill = P.fill;
  for (const y of [14, 24, 34]) { fill(pRect(0, y - 4, 64, 4), { k: 1.08, blur: 1.5 }); fill(pLine([[0, y], [64, y]]), { k: 0.74, line: 1.2, blur: 0.6 }); } // 三條摺
  fill(pRect(0, 0, 64, 3), { k: 0.9 }); fill(pRect(0, 45, 64, 3), { k: 0.9 }); fill(pRect(0, 0, 3, 48), { k: 0.9 }); fill(pRect(61, 0, 3, 48), { k: 0.9 });
  stitch(P, [[4, 3.5], [60, 3.5]], { k: 0.75, a: 0.5, seg: 1.5, gap: 1 }); stitch(P, [[4, 44.5], [60, 44.5]], { k: 0.75, a: 0.5, seg: 1.5, gap: 1 });
  fill(pRect(20, 1, 24, 2), { k: 1.12 }); // 鼻樑的鐵絲
}
// 鞋子（128 × 96）：四排（球鞋、皮鞋、雨鞋、拖鞋的腳），每排 y 往上＝往鞋面的頂；x：外側（腳跟 → 腳尖）、腳尖、內側（腳尖 → 腳跟）、腳跟
function paintShoes(P) {
  const fill = P.fill, m = 17, X = (i) => (i / m) * 128;
  const rowY = (r, v) => 96 * (1 - (r * 0.25 + 0.015 + v * 0.22)); // 第 r 排、v（0 鞋底的邊 → 1 頂）→ 畫布 y
  // 球鞋：鞋頭那塊、鞋帶、縫線
  {
    const r = 0;
    fill(pRect(X(4) - 2, rowY(r, 0.75), X(10) - X(4) + 4, rowY(r, 0) - rowY(r, 0.75)), { k: 0.9 });
    stitch(P, [[X(4) - 2, rowY(r, 0.1)], [X(4) - 2, rowY(r, 0.75)], [X(10) + 2, rowY(r, 0.75)], [X(10) + 2, rowY(r, 0.1)]], { k: 0.7, a: 0.5, seg: 1.4, gap: 1 });
    stitch(P, [[0, rowY(r, 0.12)], [128, rowY(r, 0.12)]], { k: 0.7, a: 0.45, seg: 1.4, gap: 1 });
    for (const [a, b] of [[X(1), X(4)], [X(10), X(13)]]) {
      fill(pRect(a, rowY(r, 1), b - a, rowY(r, 0.72) - rowY(r, 1)), { col: '#f2f1ec', k: 0.4, a: 0.5 }); // 鞋舌、鞋帶
      for (let x = a + 2; x < b; x += 3.2) fill(pLine([[x, rowY(r, 1)], [x + 1.5, rowY(r, 0.74)]]), { col: '#f6f5f0', k: 0.2, line: 1.1 });
      for (let x = a + 1; x < b; x += 3.2) fill(pEll(x, rowY(r, 0.7), 0.7, 0.6), { k: 0.4 });
    }
    fill(pRect(X(14), rowY(r, 0.9), X(17) - X(14), rowY(r, 0.2) - rowY(r, 0.9)), { k: 0.86 }); // 腳跟那塊
  }
  // 皮鞋：鞋頭的縫、鞋帶
  {
    const r = 1;
    for (const x of [X(4) - 1, X(10) + 1]) fill(pLine([[x, rowY(r, 0.05)], [x, rowY(r, 1)]]), { k: 0.6, line: 1, a: 0.8 });
    for (const x of [X(4) - 3, X(10) + 3]) for (let y = rowY(r, 0.9); y < rowY(r, 0.1); y += 2) fill(pEll(x, y, 0.4, 0.4), { k: 0.5, a: 0.6 }); // 雕花小洞
    for (const [a, b] of [[X(1), X(4)], [X(10), X(13)]]) for (let x = a + 2; x < b; x += 3.5) fill(pLine([[x, rowY(r, 1)], [x + 1, rowY(r, 0.78)]]), { k: 0.3, line: 0.9 });
    fill(pRect(0, rowY(r, 0.14), 128, 2), { k: 0.75 });
    fill(pRect(X(5), rowY(r, 0.95), X(9) - X(5), rowY(r, 0.4) - rowY(r, 0.95)), { k: 1.2, blur: 3, a: 0.6 }); // 擦亮的鞋頭
  }
  // 雨鞋：下面一圈深一點
  { const r = 2; fill(pRect(0, rowY(r, 0.22), 128, rowY(r, 0) - rowY(r, 0.22) + 2), { k: 0.78 }); fill(pRect(0, rowY(r, 1) - 1, 128, 3), { k: 0.9 }); }
  // 光腳（拖鞋）：腳趾縫、指甲
  {
    const r = 3;
    for (let q = 1; q < 5; q++) { const x = lerp(X(5) - 1, X(9) + 1, q / 5); fill(pLine([[x, rowY(r, 0)], [x, rowY(r, 0.42)]]), { k: 0.6, line: 1, blur: 0.5 }); }
    for (let q = 0; q < 5; q++) { const x = lerp(X(5) + 1.5, X(9) - 1, q / 4.4), w = q === 4 ? 2.6 : 1.6; fill(pEll(x, rowY(r, 0.5), w, 1.4), { col: '#f3d9cf', k: 0.4, a: 0.55 }); }
  }
}
// 帽子（128 × 96）：左上＝棒球帽／漁夫帽（x 0～64），右上＝安全帽（x 64～128），左下＝帽簷，右下＝斗笠（圓的）
function paintHat(P) {
  const fill = P.fill, xs = (a) => (0.03 + a * 0.94) * 64;
  // 帽子的片（縫線從頂往下）、透氣孔、頂上的扣子
  for (const a of [1 / 6, 1 / 2, 5 / 6]) { fill(pLine([[xs(a), 48], [xs(a), 2]]), { k: 0.7, line: 1.1, a: 0.8 }); stitch(P, [[xs(a) - 1.8, 48], [xs(a) - 1.8, 4]], { k: 0.72, a: 0.5, seg: 1.5, gap: 1 }); stitch(P, [[xs(a) + 1.8, 48], [xs(a) + 1.8, 4]], { k: 0.72, a: 0.5, seg: 1.5, gap: 1 }); }
  for (const a of [1 / 3, 2 / 3, 0.95]) fill(pEll(xs(a), 16, 1, 0.8), { k: 0.35 });
  fill(pRect(0, 0, 64, 4), { k: 0.8 });
  stitch(P, [[0, 44], [64, 44]], { k: 0.72, a: 0.5, seg: 1.5, gap: 1 }); stitch(P, [[0, 41], [64, 41]], { k: 0.72, a: 0.5, seg: 1.5, gap: 1 });
  // 安全帽：中間一條線、前面的通風口
  for (const x of [64 + 0.03 * 64, 64 + 0.97 * 64]) fill(pRect(x - 2.5, 2, 5, 46), { col: '#ecebe6', k: 0.2, a: 0.85 });
  for (let q = 0; q < 3; q++) fill(pRect(64 + 6 + q * 5, 18, 3, 7), { k: 0.35 });
  fill(pRect(64, 44, 64, 4), { k: 0.85 });
  // 帽簷：縫線
  for (const y of [57, 60, 63]) stitch(P, [[6, y], [58, y]], { k: 0.7, a: 0.55, seg: 1.5, gap: 1 });
  // 斗笠：一圈一圈、一條一條（竹葉編的）
  const cx = 96, cy = 96 * (1 - 0.225), rr = 19;
  for (let r = 2; r < rr + 1; r += 1.6) fill(pEll(cx, cy, r, r), { k: 0.84, line: 0.6, a: 0.7 });
  for (let q = 0; q < 36; q++) { const a = (q / 36) * TAU; fill(pLine([[cx, cy], [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]]), { k: 0.9, line: 0.5, a: 0.6 }); }
  fill(pEll(cx, cy, 2.5, 2.5), { k: 0.75 });
}

// ---- 材質：大家共用一個（頂點顏色 × 貼圖乘數＋貼圖加色；粗糙度每個點自己的）----
let MATERIAL = null, SHADOW = null;
function material() {
  if (MATERIAL) return MATERIAL;
  const map = atlas();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float rough;\nvarying float vRough;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRough = rough;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRough;')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n\tvec4 cT = texture2D( map, vMapUv );\n#endif')
      .replace('#include <color_fragment>', '#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n\tdiffuseColor.rgb *= vColor.rgb;\n#endif\n#ifdef USE_MAP\n\tdiffuseColor.rgb = diffuseColor.rgb * ( cT.a * 2.0 ) + sRGBTransferEOTF( vec4( cT.rgb, 1.0 ) ).rgb;\n#endif')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor *= vRough;');
  };
  m.customProgramCacheKey = () => 'carid-character-1';
  return (MATERIAL = m);
}
function shadowMat() { // 腳下淡淡的圓影子（村子沒有即時陰影）
  if (SHADOW) return SHADOW;
  let tex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); tex = new THREE.CanvasTexture(c);
  }
  SHADOW = { geo: new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), mat: new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: tex ? 0.55 : 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
  return SHADOW;
}
const CC = new Map();
function linColor(hex) { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }

// ---- 組起來：每個部位一段，接成一個 BufferGeometry；顏色＝角色的顏色 × 明暗 ----
const GEN = { head: genHead, neck: genNeck, torso: genTorso, armL: (M) => { chunkStart(); genArm(M, -1); return chunkEnd(); }, armR: (M) => { chunkStart(); genArm(M, 1); return chunkEnd(); },
  legs: (M) => { chunkStart(); genLeg(M, -1); genLeg(M, 1); if (M.L.bottom === 'skirt') genSkirt(M); return chunkEnd(); },
  feet: (M) => { chunkStart(); genFoot(M, -1); genFoot(M, 1); return chunkEnd(); }, hair: genHair, hat: genHat, glasses: genGlasses, mask: genMask };
const PART_KEYS = Object.keys(GEN);
// look 的哪個欄位改了要重做哪些部位（顏色只要重新上色）
const DEPS = { face: ['head'], hair: ['head', 'hair', 'hat'], hat: ['hair', 'hat'], top: ['torso', 'armL', 'armR', 'legs'], bottom: ['torso', 'legs', 'feet'], shoes: ['legs', 'feet'], glasses: ['glasses'], mask: ['mask'], maskColor: ['mask'], seed: ['hair'] };
const SHAPE = ['body', 'age', 'height', 'build'];
const COLOR_KEYS = ['skin', 'hairColor', 'topColor', 'bottomColor', 'shoesColor', 'hatColor'];
function roleColors(L, out) {
  const keys = ['skin', 'hairColor', 'topColor', 'bottomColor', 'shoesColor', 'hatColor'];
  for (let r = 0; r < 6; r++) { const c = linColor(L[keys[r]] || DEF[keys[r]]); out[r * 3] = c[0]; out[r * 3 + 1] = c[1]; out[r * 3 + 2] = c[2]; }
  return out;
}

// ---- 動作：姿勢＝一串「頻道」（角度弧度、位置公尺）→ fk() 變成每根骨頭的四元數 ----
//   站著的時候腳用 IK 踩在地上（腳踩著就不動，不會滑）；拿槍、坐著握把手、背著手的時候手也用 IK
//   hx hy hz 骨盆位置、hp 骨盆往後仰（負＝往前傾）、hr 往右歪、hw 往左轉；sp／cp 脊椎、胸（同樣：p 仰、r 歪、w 轉）；np kp 脖子、頭（p 抬頭）
//   每一邊（L 左、R 右）：cu 聳肩、cf 肩往前、sf 手臂往前抬、sa 往旁邊張開、st 往內轉、el 手肘彎、wf 手腕往手心彎、wt 手掌往下翻、fi 手指彎、th 大拇指
//                          tf 大腿往前抬、ta 往外張、tt 腳尖往外轉、kn 膝蓋彎、af 腳尖往上
const CH = ['hx', 'hy', 'hz', 'hp', 'hr', 'hw', 'sp', 'sr', 'sw', 'cp', 'cr', 'cw', 'np', 'nr', 'nw', 'kp', 'kr', 'kw', 'tail'];
const SIDE_CH = ['cu', 'cf', 'sf', 'sa', 'st', 'el', 'wf', 'wt', 'fi', 'th', 'tf', 'ta', 'tt', 'kn', 'af'];
for (const s of ['L', 'R']) for (const n of SIDE_CH) CH.push(s + n);
const NCH = CH.length, CI = Object.fromEntries(CH.map((n, i) => [n, i]));
const SO = [CI.Lcu, CI.Rcu]; // 左、右頻道的起點
const X_CU = 0, X_CF = 1, X_SF = 2, X_SA = 3, X_ST = 4, X_EL = 5, X_WF = 6, X_WT = 7, X_FI = 8, X_TH = 9, X_TF = 10, X_TA = 11, X_TT = 12, X_KN = 13, X_AF = 14;
const SIDE_B = ['L', 'R'].map((s) => ({ clav: B['clav' + s], up: B['up' + s], fore: B['fore' + s], hand: B['hand' + s], fing: B['fing' + s], tip: B['tip' + s], thumb: B['thumb' + s], thigh: B['thigh' + s], shin: B['shin' + s], foot: B['foot' + s], toe: B['toe' + s] }));
// 關鍵格的姿勢寫成 { 名字: 值 }：'Bsf' 兩邊一樣、'Lsf'／'Rsf' 只有一邊
function poseVec(M, obj, base) {
  const P = new Float32Array(NCH);
  if (base) P.set(base);
  for (const k in obj) {
    const v = obj[k];
    if (k[0] === 'B' && CI['L' + k.slice(1)] !== undefined) { P[CI['L' + k.slice(1)]] = v; P[CI['R' + k.slice(1)]] = v; } else if (CI[k] !== undefined) P[CI[k]] = v;
  }
  return P;
}
const EU = new THREE.Euler(), QT = new THREE.Quaternion();
function putQ(Q, b, x, y, z, order) { EU.set(x, y, z, order); QT.setFromEuler(EU); const k = b * 4; Q[k] = QT.x; Q[k + 1] = QT.y; Q[k + 2] = QT.z; Q[k + 3] = QT.w; }
function fk(P, Q) {
  putQ(Q, B.root, 0, 0, 0, 'YXZ');
  putQ(Q, B.hips, P[CI.hr], P[CI.hw], P[CI.hp], 'YXZ');
  putQ(Q, B.spine, P[CI.sr], P[CI.sw], P[CI.sp], 'YXZ');
  putQ(Q, B.chest, P[CI.cr], P[CI.cw], P[CI.cp], 'YXZ');
  putQ(Q, B.neck, P[CI.nr], P[CI.nw], P[CI.np], 'YXZ');
  putQ(Q, B.head, P[CI.kr], P[CI.kw], P[CI.kp], 'YXZ');
  putQ(Q, B.tail, 0, 0, P[CI.tail], 'YXZ');
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1, o = SO[k], b = SIDE_B[k], fi = P[o + X_FI], th = P[o + X_TH];
    putQ(Q, b.clav, -sd * P[o + X_CU], sd * P[o + X_CF], 0, 'YXZ');
    putQ(Q, b.up, -sd * P[o + X_SA], sd * P[o + X_ST], P[o + X_SF], 'ZXY');
    putQ(Q, b.fore, 0, 0, P[o + X_EL], 'ZXY');
    putQ(Q, b.hand, sd * P[o + X_WF], sd * P[o + X_WT], 0, 'YXZ');
    putQ(Q, b.fing, sd * fi, 0, 0, 'ZXY'); putQ(Q, b.tip, sd * fi * 1.15, 0, 0, 'ZXY');
    putQ(Q, b.thumb, sd * th * 0.55, -sd * th * 0.3, -th * 0.25, 'ZXY');
    putQ(Q, b.thigh, -sd * P[o + X_TA], -sd * P[o + X_TT], P[o + X_TF], 'ZXY');
    putQ(Q, b.shin, 0, 0, -P[o + X_KN], 'ZXY');
    putQ(Q, b.foot, 0, 0, P[o + X_AF], 'ZXY');
    putQ(Q, b.toe, 0, 0, 0, 'ZXY'); // 腳趾：之後 toesIK 看要不要往上彎
  }
}
// 骨頭 b 在 root 座標裡的轉角 oq、位置 op（從 root 一路乘下來；HP＝骨盆位置）
const CHAIN = new Int8Array(16), TQ = new THREE.Quaternion(), TV = new THREE.Vector3();
function boneWorld(M, Q, HP, b, oq, op) {
  let n = 0; for (let k = b; k > 0; k = PARENT[k]) CHAIN[n++] = k;
  oq.set(0, 0, 0, 1); op.set(0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const k = CHAIN[i];
    if (k === B.hips) TV.set(HP[0], HP[1], HP[2]); else TV.set(M.rest[k * 3], M.rest[k * 3 + 1], M.rest[k * 3 + 2]);
    op.add(TV.applyQuaternion(oq));
    oq.multiply(TQ.set(Q[k * 4], Q[k * 4 + 1], Q[k * 4 + 2], Q[k * 4 + 3]));
  }
}
const storeQ = (Q, b, q) => { const k = b * 4; Q[k] = q.x; Q[k + 1] = q.y; Q[k + 2] = q.z; Q[k + 3] = q.w; };
// 兩節 IK：b1 大腿／上臂、b2 小腿／前臂；target＝腳踝／手腕（root 座標）；pole＝膝蓋／手肘尖要朝的方向；
//   leg：膝蓋往 pole 彎；不是 leg（手）：手肘尖朝 pole、前臂往另一邊彎；endQ（可以不給）＝末端（腳／手）要的轉角
const IQ0 = new THREE.Quaternion(), IQ1 = new THREE.Quaternion(), IQ2 = new THREE.Quaternion(), IP0 = new THREE.Vector3(), IT = new THREE.Vector3(), IP = new THREE.Vector3();
const IU = new THREE.Vector3(), IW = new THREE.Vector3(), IX = new THREE.Vector3(), IY = new THREE.Vector3(), IZ = new THREE.Vector3(), IM = new THREE.Matrix4();
function ik2(M, Q, HP, b1, b2, la, lb, target, pole, leg, endQ, b3) {
  boneWorld(M, Q, HP, PARENT[b1], IQ0, IP0);
  IT.set(M.rest[b1 * 3], M.rest[b1 * 3 + 1], M.rest[b1 * 3 + 2]).applyQuaternion(IQ0).add(IP0); // 關節位置
  IT.subVectors(target, IT);
  let d = IT.length();
  if (d < 1e-6) { IT.set(0, -1, 0); d = 1e-6; } else IT.multiplyScalar(1 / d);
  d = clamp(d, Math.abs(la - lb) + 1e-4, (la + lb) * 0.9995);
  const ca = clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  IP.copy(pole).addScaledVector(IT, -pole.dot(IT));
  if (IP.lengthSq() < 1e-10) IP.set(leg ? 1 : -1, 0, 0).addScaledVector(IT, -(leg ? 1 : -1) * IT.x);
  IP.normalize();
  IU.copy(IT).multiplyScalar(ca).addScaledVector(IP, sa);
  IW.copy(IT).multiplyScalar(d).addScaledVector(IU, -la).normalize();
  IY.copy(IU).negate();
  IX.copy(IP).addScaledVector(IU, -IP.dot(IU)).normalize(); if (!leg) IX.negate();
  IZ.crossVectors(IX, IY);
  IQ1.setFromRotationMatrix(IM.makeBasis(IX, IY, IZ));
  IY.copy(IW).negate(); IX.crossVectors(IY, IZ);
  IQ2.setFromRotationMatrix(IM.makeBasis(IX, IY, IZ));
  storeQ(Q, b1, TQ.copy(IQ0).invert().multiply(IQ1));
  storeQ(Q, b2, TQ.copy(IQ1).invert().multiply(IQ2));
  if (endQ) storeQ(Q, b3, TQ.copy(IQ2).invert().multiply(endQ));
}
// 腳：平放時腳跟著地的點 (hx, hz)、朝向 yaw、腳尖翹 th（正：繞腳跟轉；負：腳跟抬起、繞前腳掌轉）→ 腳踝位置（root 座標）
function ankleOf(M, hx, hz, yaw, th, out) {
  const c = Math.cos(yaw), s = Math.sin(yaw), ct = Math.cos(th), st = Math.sin(th);
  let px = hx, pz = hz, vx = M.heelBack; // 支點（地上）→ 腳踝的向量（腳的座標）
  if (th < 0) { const D = M.heelBack + M.ballFwd; px = hx + c * D; pz = hz - s * D; vx = -M.ballFwd; }
  const fx = vx * ct - M.ankleY * st, fy = vx * st + M.ankleY * ct;
  return out.set(px + c * fx, fy, pz - s * fx);
}
const footQ = (yaw, th, q) => { EU.set(0, yaw, th, 'YXZ'); return q.setFromEuler(EU); };

// 站著的基本姿勢（每個人一點點不一樣：老人駝背、小孩挺肚子）
function baseStand(M, P) {
  P.fill(0);
  P[CI.hy] = M.hipsY - 0.001 * M.s; // 站直：膝蓋幾乎打直（骨盆低 4 公釐膝蓋就會彎十幾度）
  for (const o of SO) { P[o + X_SA] = M.fem ? 0.05 : 0.075; P[o + X_EL] = 0.14; P[o + X_FI] = 0.32; P[o + X_TH] = 0.25; P[o + X_WF] = 0.06; P[o + X_ST] = 0.06; P[o + X_TT] = 0.08; }
  if (M.eld) { P[CI.hp] = -0.05; P[CI.sp] = -0.1; P[CI.cp] = -0.17; P[CI.np] = 0.1; P[CI.kp] = 0.15; P[CI.hy] -= 0.02 * M.s; for (const o of SO) { P[o + X_CF] = 0.08; P[o + X_EL] = 0.26; } }
  if (M.kid) { P[CI.sp] = 0.03; P[CI.hp] = -0.03; P[CI.kp] = 0.03; }
  return P;
}
// 關鍵格動畫（倒下、爬起來）：列＝[秒, 頻道…]；位置頻道（hx hy hz）是「骨盆站著的高度」的幾倍
function keyAnim(keys) {
  const rows = keys.map(([t, o]) => { const P = poseVec(null, o, KEY_BASE); return [t, ...P]; });
  const f = curve(rows), T = keys[keys.length - 1][0];
  return { T, at: (t, out) => f(clamp(t, 0, T), out) };
}
const KEY_BASE = (() => { const P = new Float32Array(NCH); P[CI.hy] = 1; for (const o of SO) { P[o + X_SA] = 0.07; P[o + X_EL] = 0.14; P[o + X_FI] = 0.32; P[o + X_TH] = 0.25; P[o + X_TT] = 0.08; } return P; })();
const LIE_BACK = { hx: -0.1, hy: 0.118, hp: 1.53, hw: 0.04, sp: 0.02, sr: 0.04, cp: 0.02, np: 0.06, kp: 0.08, kr: 0.2, kw: 0.42,
  Lsf: 0.3, Lsa: 1.1, Lst: -0.35, Lel: 0.4, Lwt: 0.4, Lfi: 0.5, Rsf: 0.1, Rsa: 0.72, Rst: -0.15, Rel: 0.85, Rwt: 0.5, Rfi: 0.55,
  Ltf: 0.32, Lta: 0.1, Ltt: 0.35, Lkn: 0.7, Laf: -0.5, Rtf: 0.06, Rta: 0.12, Rtt: 0.5, Rkn: 0.14, Raf: -0.62 };
const LIE_FRONT = { hx: 0.1, hy: 0.125, hp: -1.52, sp: 0.03, cp: 0.05, np: 0.1, kp: 0.25, kw: 1.15, kr: 0.12,
  Lsf: 2.0, Lsa: 0.7, Lst: 0.3, Lel: 1.7, Lwt: 0.9, Lfi: 0.4, Rsf: 0.15, Rsa: 0.35, Rst: 0.9, Rel: 0.35, Rwt: 1.2, Rfi: 0.45,
  Ltf: 0.02, Lta: 0.1, Ltt: 0.3, Lkn: 0.2, Laf: -1.0, Rtf: -0.04, Rta: 0.08, Rtt: 0.45, Rkn: 0.1, Raf: -1.1 };
const ANIM = {
  fallBack: keyAnim([
    [0, {}],
    [0.1, { hx: -0.04, hy: 0.97, hp: 0.12, sp: 0.18, cp: 0.16, np: 0.15, kp: 0.32, Bsf: 0.5, Bsa: 0.35, Bel: 0.6, Bfi: 0.2, Btf: 0.1, Bkn: 0.2 }],
    [0.3, { hx: -0.12, hy: 0.72, hp: 0.6, sp: 0.12, cp: 0.08, np: -0.1, kp: -0.2, Bsf: 0.9, Bsa: 0.6, Bel: 0.5, Btf: 0.75, Bkn: 1.1, Baf: 0.3 }],
    [0.5, { hx: -0.16, hy: 0.2, hp: 1.0, sp: -0.2, cp: -0.1, np: -0.3, kp: -0.3, Bsf: 0.6, Bsa: 0.9, Bel: 0.4, Btf: 1.3, Bkn: 1.3, Baf: 0.2 }],
    [0.65, { hx: -0.12, hy: 0.13, hp: 1.45, np: -0.2, kp: -0.15, Bsf: 0.4, Bsa: 1.0, Bel: 0.5, Ltf: 0.9, Lkn: 1.2, Rtf: 0.6, Rkn: 0.7, Baf: -0.1 }],
    [0.8, { ...LIE_BACK, hy: 0.125, np: 0.0, kp: 0.02, kw: 0.2, Ltf: 0.5, Lkn: 0.85, Rtf: 0.15, Rkn: 0.28 }],
    [0.95, LIE_BACK],
  ]),
  fallFront: keyAnim([
    [0, {}],
    [0.12, { hx: 0.05, hy: 0.97, hp: -0.25, sp: -0.1, np: 0.1, kp: 0.15, Bsf: 0.8, Bsa: 0.2, Bel: 0.5, Btf: 0.15, Bkn: 0.3 }],
    [0.35, { hx: 0.1, hy: 0.55, hp: -0.5, sp: -0.1, kp: 0.3, Bsf: 1.3, Bsa: 0.3, Bel: 0.3, Btf: 0.8, Bkn: 1.4, Baf: -0.2 }],
    [0.55, { hx: 0.14, hy: 0.4, hp: -0.9, sp: 0, kp: 0.45, Bsf: 1.6, Bsa: 0.35, Bel: 0.2, Btf: 0.4, Bkn: 1.6, Baf: -0.6 }],
    [0.75, { ...LIE_FRONT, hy: 0.16, hp: -1.4, kw: 0.6, Bsf: 1.2, Bel: 1.0, Btf: 0.1, Bkn: 0.5 }],
    [0.95, LIE_FRONT],
  ]),
  upBack: keyAnim([
    [0, LIE_BACK],
    [0.28, { hx: -0.12, hy: 0.145, hp: 0.45, sp: -0.25, cp: -0.15, np: -0.1, Bsf: -0.55, Bsa: 0.25, Bel: 0.15, Bwf: -0.9, Bfi: 0.1, Btf: 1.3, Bkn: 1.9, Baf: 0.35, Btt: 0.2 }],
    [0.52, { hx: -0.05, hy: 0.5, hp: 0.05, sp: -0.35, cp: -0.2, Ltf: 0.25, Lkn: 1.9, Laf: -0.4, Rtf: 1.5, Rkn: 1.95, Raf: 0.3, Rsf: 0.9, Rel: 0.6, Lsf: 0.3, Lsa: 0.3, Lel: 0.4 }],
    [0.78, { hy: 0.72, hp: -0.1, sp: -0.4, cp: -0.15, Ltf: 0.9, Lkn: 1.4, Laf: 0.2, Rtf: 1.1, Rkn: 1.4, Raf: 0.1, Rsf: 0.6, Rel: 0.5, Lsf: 0.3, Lel: 0.3 }],
    [1.0, { hy: 0.96, hp: -0.02, sp: -0.1, Btf: 0.15, Bkn: 0.3, Baf: 0.1 }],
    [1.2, {}],
  ]),
  upFront: keyAnim([
    [0, LIE_FRONT],
    [0.3, { hx: 0.1, hy: 0.3, hp: -1.0, sp: 0.1, cp: 0.1, kw: 0.2, Bsf: 1.25, Bsa: 0.2, Bel: 0.3, Bwf: -1.0, Btf: 0.5, Bkn: 1.2, Baf: -0.6 }],
    [0.55, { hy: 0.52, hp: -0.25, sp: -0.2, Bsf: 0.4, Bel: 0.3, Btf: 0.35, Bkn: 1.85, Baf: -0.6 }],
    [0.8, { hy: 0.62, hp: -0.15, sp: -0.3, Rtf: 1.4, Rkn: 1.8, Raf: 0.3, Ltf: 0.3, Lkn: 1.8, Laf: -0.4, Rsf: 0.7, Rel: 0.6 }],
    [1.0, { hy: 0.93, sp: -0.1, Btf: 0.3, Bkn: 0.5 }],
    [1.2, {}],
  ]),
};

// ---- 一個角色的動畫狀態 ----
const STAND = { idle: 1, walk: 1, run: 1, talk: 1, wave: 1, punch: 1, aim: 1, shoot: 1 };
const STATES = { ...STAND, sit: 1, fall: 1, getup: 1 };
const ONCE_T = { getup: ONCE.getup, punch: ONCE.punch, wave: ONCE.wave, shoot: 0.25 };
const FALL_T = 0.95, LIE_MIN = 0.6; // 倒下的動作多久；自己爬起來之前至少躺多久
const newFoot = () => ({ hx: 0, hz: 0, yaw: 0, th: 0, air: false, s: 0, ax: 0, ay: 0, az: 0, ayaw: 0, ath: 0, x1: 0, z1: 0, yaw1: 0, th1: 0, lift: 0, rate: 0 });
function newAnim(seed) {
  const r = mulberry((seed | 0) * 7 + 3);
  return {
    state: 'idle', t: 0, prev: 'idle', fresh: true, upAt: -1,
    P: new Float32Array(NCH), K: new Float32Array(NCH), Q: new Float32Array(NB * 4), HP: new Float64Array(3),
    O: new Float32Array(NB * 4), OH: new Float64Array(3), SN: new Float32Array(NB * 4), SH: new Float64Array(3), FK: new Float32Array(12),
    bt: 1, bd: 0.2, time: r() * 100, phase: 0, feet: [newFoot(), newFoot()], home: false, gv: 0, gstep: 0, gbeta: 0.6, grun: false,
    lastRy: null, yaw: 0, yaw0: 0, yawT: 0, front: false,
    look: null, lookYaw: 0, lookPitch: 0,
    rec: 9, weapon: 'pistol', aimPitch: 0, support: 0.32, hands: 'lap',
    ph: [r(), r(), r(), r(), r(), r()].map((v) => v * TAU), handsBack: r() < 0.6, talkK: 0.8 + 0.4 * r(),
    lie: [r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5],
  };
}
const HOME = { hx: 0, hz: 0, yaw: 0 };
function footHome(M, k, out) { // 站好的時候腳在哪裡：腳跟平放的點、腳尖稍微往外
  const sd = k ? 1 : -1, yaw = -sd * (M.fem ? 0.1 : 0.14), ax = 0.005 * M.s, az = sd * (M.hipZ + (M.fem ? 0 : 0.014) * M.s);
  out.yaw = yaw; out.hx = ax - Math.cos(yaw) * M.heelBack; out.hz = az + Math.sin(yaw) * M.heelBack;
  return out;
}
function resetFeet(S, M) { for (let k = 0; k < 2; k++) { const f = S.feet[k]; footHome(M, k, HOME); f.hx = HOME.hx; f.hz = HOME.hz; f.yaw = HOME.yaw; f.th = 0; f.air = false; f.s = 0; } }
// 身體往前 dx、往左轉 dpsi：踩在地上的點在身體座標裡往後、反著轉（所以腳不會滑）
function feetMove(S, dx, dpsi) {
  if (!dx && !dpsi) return;
  const c = Math.cos(dpsi), s = Math.sin(dpsi);
  for (const f of S.feet) {
    let x = f.hx - dx, z = f.hz; f.hx = x * c - z * s; f.hz = x * s + z * c; f.yaw -= dpsi;
    x = f.ax - dx; z = f.az; f.ax = x * c - z * s; f.az = x * s + z * c; f.ayaw -= dpsi;
  }
}
const V_A = new THREE.Vector3(), V_B = new THREE.Vector3(), V_C = new THREE.Vector3(), Q_F = new THREE.Quaternion(), V_POLE = new THREE.Vector3();
function liftOff(M, f) { ankleOf(M, f.hx, f.hz, f.yaw, f.th, V_A); f.ax = V_A.x; f.ay = V_A.y; f.az = V_A.z; f.ayaw = f.yaw; f.ath = f.th; f.air = true; f.s = 0; }
function land(f) { f.air = false; f.hx = f.x1; f.hz = f.z1; f.yaw = f.yaw1; f.th = f.th1; }
// 走路／跑步：相位 0＝左腳跟著地、0.5＝右腳；β＝一隻腳在地上的時間比例；步伐從腿長、速度算（Froude）
function gaitStep(S, M, dt, speed, run) {
  const Lg = M.hipJY, vh = speed / Math.sqrt(9.81 * Lg);
  let step = run ? Lg * (0.35 + 0.87 * vh) : Lg * 1.12 * Math.pow(vh + 1e-4, 0.55);
  if (M.eld) step *= 0.8;
  const fmin = run ? 2.3 : 1.2;
  let f = speed / Math.max(step, 1e-4);
  if (f < fmin) { f = fmin; step = speed / fmin; }
  const beta = run ? lerp(0.4, 0.3, sstep(2.6, 6.5, speed)) : lerp(0.64, 0.57, sstep(0.4, 2.4, speed));
  S.phase = (S.phase + dt * f * 0.5) % 1;
  S.gv = vh; S.gstep = step; S.gbeta = beta; S.grun = run;
  const thHS = run ? 0.08 : 0.24 * sstep(0.1, 1.0, speed), thTO = run ? -0.9 : -(0.2 + 0.4 * sstep(0.2, 1.4, speed));
  const narrow = run ? 0.55 : M.fem ? 0.68 : 0.8;
  for (let k = 0; k < 2; k++) {
    const ft = S.feet[k], sd = k ? 1 : -1;
    let ph = S.phase + (k ? 0.5 : 0); ph -= Math.floor(ph);
    footHome(M, k, HOME);
    const yaw1 = HOME.yaw * (run ? 0.5 : 0.8), az = sd * M.hipZ * narrow;
    ft.yaw1 = yaw1; ft.th1 = thHS;
    ft.x1 = 0.005 * M.s + step * beta + (run ? 0.02 : 0.03) * M.s * sstep(0, 0.5, speed) - Math.cos(yaw1) * M.heelBack;
    ft.z1 = az + Math.sin(yaw1) * M.heelBack;
    if (ph < beta) { // 在地上
      if (ft.air) land(ft);
      const s = ph / beta;
      ft.th = run ? (s < 0.3 ? thHS * (1 - sstep(0, 0.15, s)) : thTO * Math.pow(sstep(0.3, 1, s), 1.3)) : (s < 0.14 ? thHS * (1 - sstep(0, 0.14, s)) : s < 0.5 ? 0 : thTO * Math.pow((s - 0.5) / 0.5, 1.6));
    } else { // 在空中
      if (!ft.air) liftOff(M, ft);
      ft.s = (ph - beta) / (1 - beta);
      ft.lift = run ? (0.1 + 0.2 * Math.min(vh, 1.8)) * Lg : (0.03 + 0.05 * vh) * Lg * sstep(0, 0.3, step);
    }
  }
}
// 站著不走：在空中的腳落回「家」；踩著的腳離家太遠（被推、原地轉身）就踏一步
function idleFeet(S, M, dt) {
  let busy = false;
  for (let k = 0; k < 2; k++) {
    const ft = S.feet[k];
    footHome(M, k, HOME);
    if (ft.air) {
      ft.x1 = HOME.hx; ft.z1 = HOME.hz; ft.yaw1 = HOME.yaw; ft.th1 = 0;
      if (!ft.rate) ft.rate = 1 / 0.26;
      ft.s = Math.min(1, ft.s + dt * ft.rate); ft.lift = Math.min(ft.lift, 0.05 * M.s);
      if (ft.s >= 1) { land(ft); ft.rate = 0; }
      busy = true;
    } else ft.th *= Math.exp(-dt * 10);
  }
  if (busy) return;
  let best = -1, bd = 0;
  for (let k = 0; k < 2; k++) {
    const ft = S.feet[k]; footHome(M, k, HOME);
    const d = Math.hypot(ft.hx - HOME.hx, ft.hz - HOME.hz) / (0.1 * M.s) + Math.abs(ft.yaw - HOME.yaw) / 0.4;
    if (d > 1 && d > bd) { bd = d; best = k; }
  }
  if (best >= 0) { const ft = S.feet[best]; liftOff(M, ft); ft.rate = 1 / 0.3; ft.lift = 0.045 * M.s; }
}
// 腳踝要到哪裡、腳的轉角（root 座標）
function footTarget(M, ft, run, outA, outQ) {
  if (!ft.air) { ankleOf(M, ft.hx, ft.hz, ft.yaw, ft.th, outA); footQ(ft.yaw, ft.th, outQ); return ft.yaw; }
  const s = ft.s;
  ankleOf(M, ft.x1, ft.z1, ft.yaw1, ft.th1, V_C);
  const e = run ? sstep(0.12, 1, s) : s * s * s * (10 - 15 * s + 6 * s * s);
  const h = ft.lift * (run ? Math.pow(Math.sin(PI * Math.pow(s, 0.7)), 1.2) : Math.sin(PI * Math.pow(s, 0.8)));
  outA.set(lerp(ft.ax, V_C.x, e), lerp(ft.ay, V_C.y, e) + h, lerp(ft.az, V_C.z, e));
  const yaw = lerp(ft.ayaw, ft.yaw1, e);
  footQ(yaw, lerp(ft.ath, ft.th1, sstep(0, run ? 0.9 : 0.6, s)), outQ);
  return yaw;
}
// 骨盆太高、腳踩著的地方搆不到 → 骨盆往下（k：腿最多伸到幾成；站著 0.9985 ≈ 膝蓋彎 6 度，走路 0.985 ≈ 20 度）
function pelvisClamp(S, M, k) {
  boneWorld(M, S.Q, S.HP, B.hips, IQ0, IP0);
  const L = (M.thigh + M.shin) * k;
  let drop = 0;
  for (let k = 0; k < 2; k++) {
    const ft = S.feet[k]; if (ft.air) continue;
    footTarget(M, ft, false, V_A, Q_F);
    const tb = SIDE_B[k].thigh;
    V_B.set(M.rest[tb * 3], M.rest[tb * 3 + 1], M.rest[tb * 3 + 2]).applyQuaternion(IQ0).add(IP0);
    const dx = V_A.x - V_B.x, dz = V_A.z - V_B.z, dy = V_B.y - V_A.y, h2 = L * L - dx * dx - dz * dz;
    const m = h2 > 0 ? Math.sqrt(h2) : 0;
    if (dy > m) drop = Math.max(drop, dy - m);
  }
  S.HP[1] -= drop;
}
// 腳趾：鞋頭會插進地面（腳跟抬起來、蹲、跪）→ 繞前腳掌往上彎到剛好貼地（腳是硬的，只有這一節會彎）
const TQ2 = new THREE.Quaternion(), TP2 = new THREE.Vector3(), TV2 = new THREE.Vector3();
function toesIK(S, M) {
  const Lt = Math.max(0.02, (M.toeTip || M.toeFwd) - M.ballFwd);
  for (let k = 0; k < 2; k++) {
    const b = SIDE_B[k];
    boneWorld(M, S.Q, S.HP, b.foot, TQ2, TP2);
    const hb = TV2.set(M.ballFwd, -M.ankleY, 0).applyQuaternion(TQ2).add(TP2).y; // 前腳掌底下那一點多高
    const p = Math.asin(clamp(TV2.set(1, 0, 0).applyQuaternion(TQ2).y, -1, 1)); // 腳往前的方向（腳尖往下是負的）
    putQ(S.Q, b.toe, 0, 0, clamp(Math.asin(clamp(-hb / Lt, -1, 1)) - p, 0, 1.1), 'ZXY');
  }
}
function legsIK(S, M, run) {
  for (let k = 0; k < 2; k++) {
    const ft = S.feet[k], b = SIDE_B[k], sd = k ? 1 : -1;
    const yaw = footTarget(M, ft, run, V_A, Q_F);
    // 膝蓋朝哪裡：跟著腳轉，但站好時腳尖往外的角度大部分在小腿、腳踝（大腿不要扭太多，屁股、褲子才不會穿過衣服）
    const ky = yaw + sd * (M.fem ? 0.1 : 0.14) * 0.7;
    V_POLE.set(Math.cos(ky), 0.08, -Math.sin(ky) + sd * 0.04);
    ik2(M, S.Q, S.HP, b.thigh, b.shin, M.thigh, M.shin, V_A, V_POLE, true, Q_F, b.foot);
  }
}

// ---- 身體（頻道）：走路擺手、站著呼吸換腳、聊天比手畫腳、揮手、揍人、拿槍 ----
function gaitBody(S, M, P, speed) {
  const vh = Math.min(S.gv, 2), ph = S.phase, amp = sstep(0.03, 0.45, speed), b = S.gbeta, c2 = Math.cos(TAU * ph), s = M.s;
  const k0 = P[CI.hp] + P[CI.sp] + P[CI.cp] + P[CI.np] + P[CI.kp];
  if (!S.grun) {
    const aw = (0.06 + 0.05 * vh) * amp;
    P[CI.hy] += -(0.01 + 0.012 * vh) * s + 0.011 * s * (1 + vh) * amp * Math.cos(2 * TAU * (ph - 0.3));
    P[CI.hz] += -0.017 * s * (M.fem ? 1.25 : 1) * amp * Math.cos(TAU * (ph - 0.3));
    P[CI.hw] += -aw * c2; P[CI.cw] += 1.5 * aw * c2;
    P[CI.hr] += 0.035 * (M.fem ? 1.5 : 1) * amp * Math.cos(TAU * (ph - 0.3));
    P[CI.hp] += -0.02 - 0.03 * vh; P[CI.sp] += -0.02 - 0.04 * vh;
    const A = (0.12 + 0.3 * vh) * amp * (M.kid ? 1.2 : M.eld ? 0.55 : 1) * (M.fem ? 0.9 : 1);
    for (let k = 0; k < 2; k++) {
      const o = SO[k], sw = (k ? 1 : -1) * A * Math.cos(TAU * (ph - 0.05)); // 右手跟左腳一起往前
      P[o + X_SF] += sw + 0.02; P[o + X_EL] += 0.08 * vh + 0.5 * Math.max(0, sw); P[o + X_SA] += 0.02 * vh; P[o + X_WF] += 0.1 * Math.max(0, -sw);
    }
  } else {
    P[CI.hy] += -(0.035 + 0.02 * vh) * s - 0.025 * s * Math.cos(2 * TAU * (ph - b / 2));
    P[CI.hz] += -0.008 * s * Math.cos(TAU * (ph - b / 2));
    P[CI.hw] += -0.13 * c2; P[CI.cw] += 0.25 * c2;
    P[CI.hr] += 0.03 * Math.cos(TAU * (ph - b / 2));
    P[CI.hp] += -0.08 - 0.04 * vh; P[CI.sp] += -0.07 - 0.05 * vh;
    const A = 0.45 + 0.2 * vh;
    for (let k = 0; k < 2; k++) {
      const o = SO[k], sw = (k ? 1 : -1) * A * Math.cos(TAU * (ph - 0.03));
      P[o + X_SF] = -0.1 + sw; P[o + X_EL] = 1.35 + 0.35 * Math.max(0, sw); P[o + X_ST] = 0.3; P[o + X_SA] = 0.14; P[o + X_FI] = 1.1; P[o + X_TH] = 0.6; P[o + X_WF] = 0.1;
    }
  }
  // 頭保持看前面（身體轉、彎，頭反過來一點）
  P[CI.kp] -= 0.7 * (P[CI.hp] + P[CI.sp] + P[CI.cp] + P[CI.np] + P[CI.kp] - k0);
  P[CI.kw] -= 0.8 * (P[CI.hw] + P[CI.sw] + P[CI.cw]);
}
function idleBody(S, M, P, t, shift = 1) {
  const ph = S.ph, br = Math.sin((TAU * t) / (M.kid ? 3.2 : 4.2) + ph[0]); // 呼吸
  const w = shift * (0.65 * Math.sin((TAU * t) / 7.3 + ph[1]) + 0.35 * Math.sin((TAU * t) / 3.7 + ph[2])); // 重心在左右腳換
  P[CI.hz] += 0.016 * M.s * w; P[CI.hr] += -0.035 * w; P[CI.cr] += 0.025 * w; P[CI.sr] += 0.01 * w; P[CI.hy] -= 0.0015 * M.s * Math.abs(w);
  P[CI.cp] += 0.012 * br; P[CI.sp] += 0.005 * br; P[CI.np] -= 0.008 * br;
  for (const o of SO) { P[o + X_CU] += 0.012 * br; P[o + X_SA] += 0.006 * br; }
  P[CI.kw] += 0.12 * Math.sin((TAU * t) / 9.3 + ph[3]) + 0.05 * Math.sin((TAU * t) / 3.1 + ph[4]);
  P[CI.kp] += 0.03 * Math.sin((TAU * t) / 6.1 + ph[5]); P[CI.kr] += 0.03 * Math.sin((TAU * t) / 7.7 + ph[1]);
}
function talkBody(S, M, P, t, e) {
  const k = S.talkK, g = (a, f, p) => a * Math.sin(TAU * f * k * t + p);
  const g1 = g(1, 0.9, S.ph[0]) + g(0.5, 2.1, S.ph[1]), g2 = g(1, 0.7, S.ph[2]) + g(0.4, 1.7, S.ph[3]), R = SO[1], L = SO[0];
  P[R + X_SF] += e * (0.3 + 0.1 * g1); P[R + X_EL] += e * (1.1 + 0.3 * g2); P[R + X_ST] += e * (0.25 + 0.15 * g1); P[R + X_SA] += e * 0.1; P[R + X_WT] += e * (-0.7 + 0.3 * g2); P[R + X_WF] += -0.2 * e; P[R + X_FI] -= 0.12 * e;
  P[L + X_SF] += e * (0.16 + 0.08 * g2); P[L + X_EL] += e * (0.75 + 0.2 * g1); P[L + X_ST] += 0.2 * e; P[L + X_WT] += -0.4 * e;
  P[CI.kp] += e * 0.05 * Math.sin(TAU * 1.7 * t) * (0.5 + 0.5 * Math.sin(TAU * 0.3 * t + S.ph[4]));
  P[CI.kw] += e * 0.06 * g1; P[CI.kr] += e * 0.05 * g2; P[CI.cw] += e * 0.04 * g1;
}
function waveBody(S, M, P, t) {
  const e = sstep(0, 0.3, t) * (1 - sstep(1.2, ONCE.wave, t)), R = SO[1], to = (i, v) => { P[R + i] = lerp(P[R + i], v, e); };
  to(X_SF, 0.35); to(X_SA, 1.45); to(X_ST, -1.25); to(X_EL, 1.55 + 0.35 * Math.sin(TAU * 2.4 * t)); to(X_FI, 0.06); to(X_TH, 0.1); to(X_WF, -0.1 * Math.sin(TAU * 2.4 * t - 1)); to(X_WT, 0);
  P[R + X_CU] += 0.12 * e; P[CI.cr] -= 0.05 * e; P[CI.kr] -= 0.06 * e; P[CI.kp] += 0.04 * e;
}
// 揍一拳（右手直拳）：身體先往右轉蓄力，再往左轉把右肩送出去
function punchW(t) { return { load: sstep(0, 0.07, t) * (1 - sstep(0.07, 0.15, t)), hit: sstep(0.07, 0.15, t) * (1 - sstep(0.24, ONCE.punch, t)), on: sstep(0, 0.06, t) * (1 - sstep(0.3, ONCE.punch, t)) }; }
function punchBody(S, M, P, t) {
  const w = punchW(t), tw = -0.22 * w.load + 0.3 * w.hit;
  P[CI.cw] += tw; P[CI.sw] += tw * 0.4; P[CI.hw] += tw * 0.3; P[CI.kw] -= tw * 1.3; P[CI.nw] -= tw * 0.3;
  P[CI.cp] += -0.05 * w.load - 0.1 * w.hit; P[CI.kp] += 0.05 * w.hit; P[CI.hx] += (0.05 * w.hit - 0.01 * w.load) * M.s; P[CI.hy] -= 0.02 * M.s * w.on;
  P[SO[1] + X_CF] += 0.1 * w.hit;
}
// 拿槍：手槍單手、長槍兩手；aimPitch 往上正
function aimBody(S, M, P) {
  const p = clamp(S.aimPitch, -1, 1.2), r = recoilAmt(S);
  if (S.weapon === 'long') { P[CI.cw] += -0.32; P[CI.sw] += -0.08; P[CI.kw] += 0.3; P[CI.nw] += 0.1; P[CI.kr] += 0.12; P[CI.kp] += -0.06; P[CI.cp] += 0.04 * r; P[SO[1] + X_CU] -= 0.05; }
  else { P[CI.cw] += 0.28; P[CI.sw] += 0.06; P[CI.kw] += -0.26; P[CI.nw] += -0.08; P[CI.cp] += 0.015 * r; }
  P[CI.sp] += 0.2 * p; P[CI.cp] += 0.35 * p; P[CI.np] += 0.15 * p; P[CI.kp] += 0.25 * p;
  const L = SO[0]; if (S.weapon !== 'long') { P[L + X_SA] += 0.05; P[L + X_EL] += 0.1; }
}
const recoilAmt = (S) => (S.rec > 3 ? 0 : S.rec < 0.035 ? S.rec / 0.035 : Math.exp(-(S.rec - 0.035) / 0.075));
// 坐著：屁股（椅面）在 y＝0.45；骨盆稍微往後倒、背稍微彎
const SEAT = 0.45;
function sitHipJ(M) { return SEAT + 0.085 * M.s * M.limbK; }
function sitBody(S, M, P, o) {
  baseStand(M, P);
  P[CI.hy] = sitHipJ(M) + (M.hipsY - M.hipJY); P[CI.hx] = 0;
  P[CI.hp] += 0.1; P[CI.sp] += -0.08; P[CI.cp] += -0.03;
  idleBody(S, M, P, S.time, 0);
  const g = handsTarget(S, M, o);
  if (g) { // 手要往前伸（機車把手）：身體往前傾到搆得到
    const lean = sitLean(M, g);
    P[CI.sp] -= 0.45 * lean; P[CI.cp] -= 0.55 * lean; P[CI.hp] -= 0.1 * lean;
  }
  P[CI.kp] -= 0.8 * (P[CI.hp] + P[CI.sp] + P[CI.cp]);
}
function handsTarget(S, M, o) {
  const h = S.hands;
  if (Array.isArray(h)) return h;
  if (h === 'bars') return BARS;
  if (h === 'wheel') return WHEEL;
  return null;
}
const BARS = [0.62, 0.8, 0.3], WHEEL = [0.45, 0.86, 0.19];
function sitLean(M, g) { // 肩膀繞著腰往前轉，轉到手搆得到（最多 0.9）
  const hy = sitHipJ(M), pivY = hy + (M.spineY - M.hipJY), Ls = M.shY - M.spineY, R = (M.upper + M.fore) * 0.97 + 0.07 * M.s;
  for (let l = 0; l <= 0.9; l += 0.05) {
    const sx = Math.sin(l) * Ls, sy = pivY + Math.cos(l) * Ls;
    if (Math.hypot(g[0] - sx, g[1] - sy, g[2] - M.shZ * 0.9) <= R) return l;
  }
  return 0.9;
}

// ---- 手的 IK ----
// 手的掛點（character.hand）：在手心前面、握起來的拳頭中間（槍柄放這裡）；手骨頭座標
const handOff = (M, sd, out) => out.set(0.004 * M.handK, -0.6 * M.palm, -sd * 0.028 * M.handK);
const HOFF = new THREE.Vector3(), V_W2 = new THREE.Vector3();
function handIK(S, M, k, G, QH, pole) { // 掛點到 G、手骨頭的轉角 QH（root 座標）、手肘尖朝 pole
  const b = SIDE_B[k];
  handOff(M, k ? 1 : -1, HOFF).applyQuaternion(QH);
  V_W2.copy(G).sub(HOFF);
  ik2(M, S.Q, S.HP, b.up, b.fore, M.upper, M.fore, V_W2, pole, false, QH, b.hand);
}
function nlerp4(A, ai, Bq, bi, w, O, oi) {
  const d = A[ai] * Bq[bi] + A[ai + 1] * Bq[bi + 1] + A[ai + 2] * Bq[bi + 2] + A[ai + 3] * Bq[bi + 3], sg = d < 0 ? -w : w, u = 1 - w;
  const x = A[ai] * u + Bq[bi] * sg, y = A[ai + 1] * u + Bq[bi + 1] * sg, z = A[ai + 2] * u + Bq[bi + 2] * sg, q = A[ai + 3] * u + Bq[bi + 3] * sg;
  const l = Math.hypot(x, y, z, q) || 1;
  O[oi] = x / l; O[oi + 1] = y / l; O[oi + 2] = z / l; O[oi + 3] = q / l;
}
const armSave = (S, k) => { const o = SIDE_B[k].up * 4; S.FK.set(S.Q.subarray(o, o + 12)); }; // 上臂、前臂、手連號
function armMix(S, k, w) { if (w >= 0.999) return; const o = SIDE_B[k].up * 4; for (let i = 0; i < 12; i += 4) nlerp4(S.FK, i, S.Q, o + i, w, S.Q, o + i); }
const basisQ = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...x).normalize(), new THREE.Vector3(...y).normalize(), new THREE.Vector3(...z).normalize()));
const QB_AIM = basisQ([0, 1, 0], [-1, 0, 0], [0, 0, 1]); // 手指朝前、大拇指朝上（握手槍；左手握拳直立也一樣）
const QB_SUP = (() => { const f = [0.756, 0, 0.655], y = [-f[0], 0, -f[2]], z = [0, 1, 0]; return basisQ([y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]], y, z); })(); // 左手手心朝上托著槍管
const QB_FISTH = basisQ([0, 0, -1], [-1, 0, 0], [0, 1, 0]); // 右手拳頭手背朝上
const QB_LAP = [basisQ([0, 0, 1], [-1, 0, 0], [0, -1, 0]), basisQ([0, 0, -1], [-1, 0, 0], [0, 1, 0])]; // 手平放在大腿上
const QB_BAR = [basisQ([0, 0, 1], [-0.96, 0.29, 0], [-0.29, -0.96, 0]), basisQ([0, 0, -1], [-0.96, 0.29, 0], [0.29, 0.96, 0])]; // 握機車把手
const QB_BACK = [basisQ([0, 0.86, 0.51], [0, 0.51, -0.86], [-1, 0, 0]), basisQ([0, 0.86, -0.51], [0, 0.51, 0.86], [1, 0, 0])]; // 背著手
const AD = new THREE.Vector3(), AU = new THREE.Vector3(), AR = new THREE.Vector3(0, 0, 1), G1 = new THREE.Vector3(), G2 = new THREE.Vector3(), QH1 = new THREE.Quaternion(), QRC = new THREE.Quaternion(), PL = new THREE.Vector3(), WQ = new THREE.Quaternion(), WP = new THREE.Vector3(), V_F = new THREE.Vector3(), V_U = new THREE.Vector3();
function aimArms(S, M) {
  const p = clamp(S.aimPitch, -1, 1.2), long = S.weapon === 'long', r = recoilAmt(S), s = M.s;
  AD.set(Math.cos(p), Math.sin(p), 0); AU.set(-Math.sin(p), Math.cos(p), 0);
  if (long) { // 槍管在右眼下面、槍托靠右肩
    boneWorld(M, S.Q, S.HP, B.head, WQ, WP);
    const A = M.restAbs, hb = B.head * 3;
    V_F.set(M.headX + 0.08 * M.hs - A[hb], M.eyeY - A[hb + 1], M.hk.F.eyeX * M.hs).applyQuaternion(WQ).add(WP);
    G1.copy(V_F).addScaledVector(AU, -0.13 * s).addScaledVector(AD, 0.14 * s);
  } else { // 手槍：右手伸直在右肩前面
    boneWorld(M, S.Q, S.HP, B.upR, WQ, WP);
    G1.copy(WP).addScaledVector(AD, (M.upper + M.fore + 0.065 * s) * 0.93).addScaledVector(AU, -0.03 * s); G1.z -= 0.03 * s;
  }
  G1.addScaledVector(AD, -r * (long ? 0.035 : 0.05) * s).addScaledVector(AU, r * (long ? 0.005 : 0.02) * s); // 後座力
  QRC.setFromAxisAngle(AR, p + r * (long ? 0.12 : 0.42)); // 槍口往上翹
  QH1.copy(QRC).multiply(QB_AIM);
  PL.set(long ? -0.2 : 0.1, long ? -0.5 : -1, long ? 1 : 0.5);
  handIK(S, M, 1, G1, QH1, PL);
  if (long) { // 左手托著前面：順著槍往前 support 公尺
    V_F.set(1, 0, 0).applyQuaternion(QRC); V_U.set(0, 1, 0).applyQuaternion(QRC);
    G2.copy(G1).addScaledVector(V_F, S.support).addScaledVector(V_U, 0.04 * s);
    QH1.copy(QRC).multiply(QB_SUP);
    PL.set(0.1, -1, -0.35);
    handIK(S, M, 0, G2, QH1, PL);
  }
}
function punchArms(S, M, t) {
  const w = punchW(t), s = M.s;
  if (w.on < 1e-3) return;
  armSave(S, 1);
  G1.set(lerp(0.13, 0.6, w.hit) * s, M.shY + lerp(0.05, 0.03, w.hit) * s, lerp(0.1, 0.05, w.hit) * s);
  QH1.copy(QB_AIM).slerp(QB_FISTH, w.hit);
  PL.set(lerp(-0.6, 0, w.hit), -1, 0.55);
  handIK(S, M, 1, G1, QH1, PL); armMix(S, 1, w.on);
  armSave(S, 0);
  G2.set(0.17 * s, M.shY + 0.07 * s, -0.09 * s); PL.set(-0.2, -1, -0.6);
  handIK(S, M, 0, G2, QB_AIM, PL); armMix(S, 0, w.on);
}
function sitArms(S, M, o) {
  const g = handsTarget(S, M, o), s = M.s, hy = sitHipJ(M);
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1;
    if (g) { G1.set(g[0], g[1], sd * Math.abs(g[2])); PL.set(-0.3, -0.6, sd); handIK(S, M, k, G1, QB_BAR[k], PL); }
    else { G1.set(0.55 * M.thigh, hy + 0.085 * s * M.limbK - 0.001 * s, sd * (M.hipZ + 0.012 * s)); PL.set(-1, -0.2, sd * 0.6); handIK(S, M, k, G1, QB_LAP[k], PL); }
  }
}
function sitLegs(S, M) {
  const hy = sitHipJ(M);
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1, b = SIDE_B[k], yaw = -sd * 0.14;
    let ay = M.ankleY, th = 0; const x = M.thigh * 0.98 + 0.03 * M.s;
    if (hy - M.shin * 0.97 > ay) { ay = hy - M.shin * 0.97; th = -0.35; } // 腳搆不到地（小孩）：垂著
    V_A.set(x, ay, sd * (M.hipZ + 0.02 * M.s)); footQ(yaw, th, Q_F);
    V_POLE.set(1, 0.7, sd * 0.15);
    ik2(M, S.Q, S.HP, b.thigh, b.shin, M.thigh, M.shin, V_A, V_POLE, true, Q_F, b.foot);
  }
}
function backHands(S, M) { // 老人背著手走路
  M.torso(M.waistY, TT);
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1;
    G1.set(TT[0] - TT[3] - 0.048 * M.s, M.waistY + (k ? 0.012 : -0.012) * M.s, sd * 0.02 * M.s); PL.set(-0.3, -0.3, sd);
    handIK(S, M, k, G1, QB_BACK[k], PL);
  }
}
// ---- 看某個點（頭、脖子轉過去；轉不過去就不看）----
const LV = new THREE.Vector3(), LM = new THREE.Matrix4();
function lookBody(C, S, M, P, dt, sitting) {
  let wy = 0, wp = 0;
  if (S.look) {
    C.group.updateWorldMatrix(true, false);
    LV.copy(S.look).applyMatrix4(LM.copy(C.group.matrixWorld).invert());
    const hy = sitting ? M.eyeY - (M.hipJY - sitHipJ(M)) : M.eyeY, dx = LV.x - M.headX, dz = LV.z;
    const yaw = Math.atan2(-dz, dx);
    if (Math.abs(yaw) < 2.2) { wy = clamp(yaw, -1.3, 1.3); wp = clamp(Math.atan2(LV.y - hy, Math.hypot(dx, dz)), -0.7, 0.6); }
  }
  const k = 1 - Math.exp(-dt * 7);
  S.lookYaw += (wy - S.lookYaw) * k; S.lookPitch += (wp - S.lookPitch) * k;
  P[CI.nw] += 0.35 * S.lookYaw; P[CI.kw] += 0.55 * S.lookYaw; P[CI.cw] += 0.1 * S.lookYaw;
  P[CI.np] += 0.35 * S.lookPitch; P[CI.kp] += 0.55 * S.lookPitch;
}
// 倒下、爬起來（關鍵格）
function keyedBody(S, M, P) {
  const st = S.state, t = S.t, A = st === 'fall' ? (S.front ? ANIM.fallFront : ANIM.fallBack) : S.front ? ANIM.upFront : ANIM.upBack;
  A.at(t, P);
  const h = M.hipsY; P[CI.hx] *= h; P[CI.hy] *= h; P[CI.hz] *= h;
  const lw = st === 'fall' ? sstep(0.45, 0.95, t) : 1 - sstep(0, 0.35, t), L = S.lie; // 每個人躺的樣子有點不一樣
  P[CI.kw] += 0.5 * L[0] * lw; P[CI.Lsa] += 0.4 * L[1] * lw; P[CI.Rsa] += 0.4 * L[2] * lw; P[CI.Lel] += 0.5 * L[3] * lw; P[CI.Rkn] += 0.4 * Math.abs(L[4]) * lw; P[CI.Ltt] += 0.3 * L[5] * lw;
  if (st === 'getup') { // 最後幾格換成這個人自己的站姿（老人駝背）
    baseStand(M, S.K); const e = sstep(0.8, ONCE.getup, t);
    for (let i = 3; i < NCH; i++) P[i] += (S.K[i] - KEY_BASE[i]) * e;
    P[CI.hy] += (S.K[CI.hy] - M.hipsY) * e;
  }
}

// ---- 每一格：狀態機（規則跟替身一樣）→ 姿勢 → 跟上一個動作混 0.2 秒 → 放到骨頭上 ----
function blendDur(a, b) {
  if (b === 'fall') return 0.1;
  if (a === 'fall') return 0.12;
  if (a === 'getup') return 0.15;
  if (a === 'sit' || b === 'sit') return 0.4;
  if ((a === 'aim' && b === 'shoot') || (a === 'shoot' && b === 'aim')) return 0.06;
  if (b === 'punch') return 0.08;
  return 0.2;
}
function switchTo(C, S, st) {
  const a = S.state;
  S.prev = a; S.state = st; S.t = 0; C.state = st;
  if (S.fresh) { S.bt = S.bd = 1; } else { S.SN.set(S.O); S.SH.set(S.OH); S.bt = 0; S.bd = blendDur(a, st); }
  if (STAND[st] && !STAND[a]) S.home = false;
  if (st === 'getup') { S.yaw0 = S.yaw; S.upAt = -1; }
  if (st === 'fall') { S.yaw0 = S.yaw; S.upAt = -1; }
  if (st === 'shoot') S.rec = 0;
  if (C.onState) C.onState(st, a);
}
function request(C, S, want, o) {
  const cur = S.state, T1 = ONCE_T[cur];
  if (T1 && S.t < T1 && want !== 'fall' && want !== 'sit') return; // 一次的動作做完才換（倒下、坐下例外）
  if (cur === 'fall' && want !== 'sit') { // 躺著：先爬起來（要 getup 就早一點）
    const at = want === 'getup' ? FALL_T : FALL_T + LIE_MIN;
    S.upAt = S.upAt < 0 ? at : Math.min(S.upAt, at);
    return;
  }
  if (want === 'fall') { // 往哪邊倒：dir＝本地角度（0 往前、π 往後，正＝往左）或世界的向量 {x, z}
    let d = PI;
    if (typeof o.dir === 'number') d = o.dir;
    else if (o.dir && typeof o.dir.x === 'number') { C.group.updateWorldMatrix(true, false); const e = C.group.matrixWorld.elements; const lx = o.dir.x * e[0] + (o.dir.z || 0) * e[2], lz = o.dir.x * e[8] + (o.dir.z || 0) * e[10]; d = Math.atan2(-lz, lx); }
    d = Math.atan2(Math.sin(d), Math.cos(d));
    S.front = Math.abs(d) < PI / 2;
    S.yawT = S.front ? d : Math.atan2(Math.sin(d - PI), Math.cos(d - PI));
  }
  switchTo(C, S, want);
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);
function animate(C, S, dt, o) {
  const M = C.M;
  dt = dt > 0 ? Math.min(dt, 0.25) : 0;
  const speed = Math.max(0, +o.speed || 0);
  if (o.aimPitch !== undefined) S.aimPitch = +o.aimPitch || 0;
  if (o.weapon) S.weapon = o.weapon === 'long' ? 'long' : 'pistol';
  if (o.support) S.support = +o.support;
  if (o.hands !== undefined) S.hands = o.hands;
  const want = o.state;
  if (want && want !== S.state && STATES[want]) request(C, S, want, o);
  S.t += dt; S.time += dt; S.rec += dt;
  const T1 = ONCE_T[S.state];
  if (T1 && S.t >= T1) switchTo(C, S, S.state === 'shoot' ? 'aim' : 'idle');
  if (S.state === 'fall' && S.upAt >= 0 && S.t >= S.upAt) switchTo(C, S, 'getup');
  const st = S.state, P = S.P;
  // 身體轉了多少（group.rotation.y）：踩在地上的腳要反著轉
  const ry = C.group.rotation.y;
  let dpsi = 0;
  if (S.lastRy !== null && C.plant) { dpsi = Math.atan2(Math.sin(ry - S.lastRy), Math.cos(ry - S.lastRy)); if (Math.abs(dpsi) > 1.2) { dpsi = 0; S.home = false; } }
  S.lastRy = ry;
  let gait = false;
  if (STAND[st]) {
    if (!S.home) { resetFeet(S, M); S.home = true; }
    feetMove(S, speed * dt, dpsi);
    baseStand(M, P);
    gait = st === 'walk' || st === 'run' || ((st === 'aim' || st === 'shoot') && speed > 0.15);
    if (gait) { gaitStep(S, M, dt, speed, st === 'run'); gaitBody(S, M, P, speed); } else { idleFeet(S, M, dt); idleBody(S, M, P, S.time); }
    if (st === 'talk') talkBody(S, M, P, S.time, sstep(0, 0.4, S.t));
    else if (st === 'wave') waveBody(S, M, P, S.t);
    else if (st === 'punch') { punchBody(S, M, P, S.t); const w = punchW(S.t).on; for (const k of SO) { P[k + X_FI] = lerp(P[k + X_FI], 1.5, w); P[k + X_TH] = lerp(P[k + X_TH], 0.9, w); } }
    else if (st === 'aim' || st === 'shoot') { aimBody(S, M, P); P[SO[1] + X_FI] = 1.25; P[SO[1] + X_TH] = 0.5; if (S.weapon === 'long') { P[SO[0] + X_FI] = 0.7; P[SO[0] + X_TH] = 0.3; } }
    const back = M.eld && S.handsBack && (st === 'idle' || (st === 'walk' && speed < 1.6));
    if (back) for (const k of SO) { P[k + X_FI] = 0.6; P[k + X_TH] = 0.4; }
    if (st !== 'punch') lookBody(C, S, M, P, dt, false);
    fk(P, S.Q); S.HP[0] = P[CI.hx]; S.HP[1] = P[CI.hy]; S.HP[2] = P[CI.hz];
    pelvisClamp(S, M, gait ? 0.985 : 0.9985); legsIK(S, M, gait && S.grun); toesIK(S, M);
    if (st === 'aim' || st === 'shoot') aimArms(S, M);
    else if (st === 'punch') punchArms(S, M, S.t);
    else if (back) backHands(S, M);
  } else if (st === 'sit') {
    S.home = false;
    sitBody(S, M, P, o);
    if (handsTarget(S, M, o)) for (const k of SO) { P[k + X_FI] = 1.3; P[k + X_TH] = 0.8; }
    lookBody(C, S, M, P, dt, true);
    fk(P, S.Q); S.HP[0] = P[CI.hx]; S.HP[1] = P[CI.hy]; S.HP[2] = P[CI.hz];
    sitLegs(S, M); toesIK(S, M); sitArms(S, M, o);
  } else { // fall、getup
    S.home = false;
    keyedBody(S, M, P);
    fk(P, S.Q); S.HP[0] = P[CI.hx]; S.HP[1] = P[CI.hy]; S.HP[2] = P[CI.hz];
    toesIK(S, M);
  }
  // 倒下的方向：root 轉過去；爬起來的時候轉回來
  if (st === 'fall') S.yaw = lerp(S.yaw0, S.yawT, sstep(0.02, 0.4, S.t));
  else if (st === 'getup') S.yaw = S.yaw0 * (1 - sstep(0.25, 1.05, S.t));
  else if (S.yaw) S.yaw = Math.abs(S.yaw) < 1e-3 ? 0 : S.yaw * Math.exp(-dt * 8);
  // 混
  const O = S.O, Q = S.Q;
  if (S.bt < S.bd) {
    S.bt += dt;
    const w = sstep(0, 1, S.bt / S.bd);
    for (let i = 0; i < NB * 4; i += 4) nlerp4(S.SN, i, Q, i, w, O, i);
    for (let i = 0; i < 3; i++) S.OH[i] = lerp(S.SH[i], S.HP[i], w);
  } else { O.set(Q); S.OH.set(S.HP); }
  S.fresh = false;
  // 放到骨頭上
  const bones = C.bones;
  for (let b = 1; b < NB; b++) bones[b].quaternion.set(O[b * 4], O[b * 4 + 1], O[b * 4 + 2], O[b * 4 + 3]);
  bones[B.root].quaternion.setFromAxisAngle(Y_AXIS, S.yaw);
  bones[B.hips].position.set(S.OH[0], S.OH[1], S.OH[2]);
}

// ---- look 整理：不認得的選項用預設；沒給身高的小孩、長輩用他們的平均身高 ----
const AGE_H = { kid: [1.32, 1.28], adult: [1.72, 1.6], elder: [1.64, 1.52] };
const pickKey = (v, table, d) => (v in table ? v : d);
function normLook(look, prev) {
  const src = look || {}, L = { ...DEF, ...(prev || {}), ...src };
  L.body = L.body === 'f' ? 'f' : 'm';
  L.age = L.age === 'kid' || L.age === 'elder' ? L.age : 'adult';
  const ageChanged = prev && src.age !== undefined && src.age !== prev.age, bodyChanged = prev && src.body !== undefined && src.body !== prev.body;
  if (src.height === undefined && (!prev || ageChanged || (bodyChanged && Math.abs(prev.height - AGE_H[prev.age][prev.body === 'f' ? 1 : 0]) < 0.005))) {
    if (!prev && src.age === undefined && src.body === undefined) L.height = DEF.height; else L.height = AGE_H[L.age][L.body === 'f' ? 1 : 0];
  }
  L.height = +(+L.height || DEF.height).toFixed(3);
  L.height = L.age === 'kid' ? clamp(L.height, 1.0, 1.6) : clamp(L.height, 1.35, 2.1);
  L.build = pickKey(L.build, { slim: 1, mid: 1, big: 1 }, 'mid');
  L.hair = pickKey(L.hair, { short: 1, buzz: 1, side: 1, long: 1, ponytail: 1, bun: 1, curly: 1, bald: 1, perm: 1 }, 'short');
  L.top = pickKey(L.top, TOPS, 'tee'); L.bottom = pickKey(L.bottom, BOTTOMS, 'jeans'); L.shoes = pickKey(L.shoes, SHOES, 'sneakers');
  L.hat = pickKey(L.hat, { none: 1, cap: 1, bucket: 1, helmet: 1, straw: 1 }, 'none');
  L.glasses = pickKey(L.glasses, { none: 1, glasses: 1, sunglasses: 1 }, 'none');
  L.mask = !!L.mask; L.face = (L.face | 0) & 1; L.seed = L.seed === undefined ? 0 : L.seed | 0;
  for (const k of [...COLOR_KEYS, 'maskColor']) if (typeof L[k] !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(L[k])) L[k] = DEF[k];
  return L;
}

// ---- 做一個角色 ----
const IDENT = new THREE.Matrix4(), RC = new Float32Array(18);
function shapeUp(C) { // 量身體、骨頭 rest 位置
  const M = measure(C.look);
  restBones(M);
  const A = M.restAbs, j = (b) => [A[b * 3], A[b * 3 + 1], A[b * 3 + 2]];
  M.shJ = [j(B.upL), j(B.upR)]; M.hipJ = [j(B.thighL), j(B.thighR)];
  M.tiles = tilesFor(C.look);
  C.M = M;
  return M;
}
function makeParts(C, keys) { const M = C.M; for (const k of keys) C.parts[k] = GEN[k](M); }
function assemble(C) {
  let nv = 0, ni = 0;
  for (const k of PART_KEYS) { nv += C.parts[k].n; ni += C.parts[k].ni; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), rough = new Float32Array(nv);
  const si = new Uint8Array(nv * 4), sw = new Float32Array(nv * 4), idx = nv < 65536 ? new Uint16Array(ni) : new Uint32Array(ni), role = new Uint8Array(nv), shd = new Float32Array(nv * 3);
  let vo = 0, io = 0;
  for (const k of PART_KEYS) {
    const p = C.parts[k];
    pos.set(p.pos, vo * 3); nor.set(p.nor, vo * 3); uv.set(p.uv, vo * 2); rough.set(p.rough, vo); si.set(p.si, vo * 4); sw.set(p.sw, vo * 4); role.set(p.role, vo); shd.set(p.shade, vo * 3);
    for (let i = 0; i < p.ni; i++) idx[io + i] = p.idx[i] + vo;
    vo += p.n; io += p.ni;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('rough', new THREE.BufferAttribute(rough, 1));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const H = C.look.height;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.45 * H, 0), 1.2 * H);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2 * H, -0.1, -1.2 * H), new THREE.Vector3(1.2 * H, 1.1 * H, 1.2 * H));
  C.role = role; C.shade = shd;
  const old = C.mesh.geometry; C.mesh.geometry = g; if (old) old.dispose();
  C.mesh.boundingSphere = g.boundingSphere.clone(); C.mesh.boundingBox = g.boundingBox.clone();
  C.info.tris = ni / 3; C.info.verts = nv;
  recolor(C);
}
function recolor(C) {
  roleColors(C.look, RC);
  const a = C.mesh.geometry.attributes.color, col = a.array, sh = C.shade, ro = C.role, n = ro.length;
  for (let i = 0; i < n; i++) {
    const r = ro[i], i3 = i * 3;
    if (r === R_FIX) { col[i3] = sh[i3]; col[i3 + 1] = sh[i3 + 1]; col[i3 + 2] = sh[i3 + 2]; } else { col[i3] = sh[i3] * RC[r * 3]; col[i3 + 1] = sh[i3 + 1] * RC[r * 3 + 1]; col[i3 + 2] = sh[i3 + 2] * RC[r * 3 + 2]; }
  }
  a.needsUpdate = true;
}
function rig(C) { // 骨頭放回 rest、重算反矩陣、掛點
  const M = C.M, R = M.rest, A = M.restAbs;
  for (let b = 0; b < NB; b++) { C.bones[b].position.set(R[b * 3], R[b * 3 + 1], R[b * 3 + 2]); C.skeleton.boneInverses[b].makeTranslation(-A[b * 3], -A[b * 3 + 1], -A[b * 3 + 2]); }
  handOff(M, 1, C.hand.position); handOff(M, -1, C.handL.position);
  C.eyes.position.set(M.headX + 0.07 * M.hs - A[B.head * 3], M.eyeY - A[B.head * 3 + 1], 0);
  C.height = C.look.height; C.radius = clamp(M.shZ + 0.085 * M.s * M.bw, 0.16, 0.42);
  if (C.shadow) C.shadow.scale.set(0.62 * M.s * M.bw, 1, 0.5 * M.s * M.bw);
  C.anim.home = false;
}
function buildCharacter(look = {}, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const L = normLook(look);
  if (look && look.seed === undefined) L.seed = (hash(Math.round(L.height * 1000), L.skin.length * 31 + (L.top.length << 3) + L.hair.length) * 1e6) | 0;
  const group = new THREE.Group(); group.name = 'character';
  const bones = BN.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  for (let b = 1; b < NB; b++) bones[PARENT[b]].add(bones[b]);
  const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), material());
  mesh.name = 'character-body'; mesh.add(bones[0]); group.add(mesh);
  const hand = new THREE.Object3D(), handL = new THREE.Object3D(), eyes = new THREE.Object3D();
  hand.name = 'hand'; handL.name = 'handL'; eyes.name = 'eyes';
  hand.rotation.z = handL.rotation.z = -PI / 2; // +x 順著手指、+y 大拇指那邊
  bones[B.handR].add(hand); bones[B.handL].add(handL); bones[B.head].add(eyes);
  const C = {
    group, mesh, bones, skeleton, hand, handL, eyes, look: L, state: 'idle', height: L.height, radius: 0.28, M: null, parts: {}, role: null, shade: null,
    info: { tris: 0, verts: 0, draws: 1, buildMs: 0 }, anim: newAnim(L.seed), plant: opts.plant !== false, onState: null, shadow: null,
    get yaw() { return C.anim.yaw; },
    setLook(p) { setLook(C, p); },
    update(dt, o) { animate(C, C.anim, dt, o || NO_OPTS); if (C.shadow) placeShadow(C); },
    lookAt(x, y, z) { const S = C.anim; if (x === null || x === undefined || x === false) S.look = null; else { S.look = S.look || new THREE.Vector3(); if (typeof x === 'object') S.look.copy(x); else S.look.set(+x || 0, +y || 0, +z || 0); } },
    recoil() { C.anim.rec = 0; },
    dispose() { group.removeFromParent(); mesh.geometry.dispose(); skeleton.dispose(); },
  };
  if (opts.shadow !== false) { const sh = shadowMat(); C.shadow = new THREE.Mesh(sh.geo, sh.mat); C.shadow.name = 'character-shadow'; C.shadow.position.y = 0.012; C.shadow.renderOrder = -1; group.add(C.shadow); C.info.draws = 2; }
  shapeUp(C);
  makeParts(C, PART_KEYS);
  assemble(C);
  rig(C);
  mesh.bind(skeleton, IDENT);
  C.update(0, { state: STATES[opts.state] ? opts.state : 'idle', speed: 0 });
  C.info.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return C;
}
const NO_OPTS = {};
function placeShadow(C) { // 影子跟著骨盆（躺著的時候往頭那邊拉長）
  const S = C.anim, M = C.M, lying = S.state === 'fall' || S.state === 'getup' ? sstep(0.6, 0.15, S.OH[1] / M.hipsY) : 0;
  const x = S.OH[0] + (S.front ? 0.35 : -0.35) * M.s * lying, z = S.OH[2], c = Math.cos(S.yaw), s = Math.sin(S.yaw);
  C.shadow.position.x = x * c + z * s; C.shadow.position.z = -x * s + z * c; C.shadow.rotation.y = S.yaw;
  C.shadow.scale.x = 0.62 * M.s * M.bw * (1 + 1.6 * lying);
}
function setLook(C, p) {
  if (!p) return;
  const old = C.look, L = normLook(p, old);
  const changed = Object.keys(L).filter((k) => L[k] !== old[k]);
  if (!changed.length) return;
  C.look = L;
  if (changed.some((k) => SHAPE.includes(k))) { // 身體變了：全部重做、骨頭重綁
    shapeUp(C); makeParts(C, PART_KEYS); assemble(C); rig(C);
    return;
  }
  const parts = new Set();
  for (const k of changed) for (const q of DEPS[k] || []) parts.add(q);
  C.M.L = L; C.M.tiles = tilesFor(L);
  if (parts.size) { makeParts(C, [...parts]); assemble(C); } else recolor(C);
}

// ---- 自訂角色的選項（畫面上的順序；label 是畫面上的字、swatch 是色塊）----
const SKIN_C = [['#f3d3b9', '白皙'], ['#e8bf9c', '淺膚色'], ['#dcae88', '自然'], ['#cc9a70', '小麥色'], ['#b07b53', '黝黑'], ['#7c5337', '深膚色']];
const HAIR_C = [['#141110', '黑色'], ['#2b1d15', '深咖啡'], ['#5a3b26', '咖啡色'], ['#8a5a33', '栗色'], ['#b98a52', '淺棕'], ['#d6b47a', '金色'], ['#9a9894', '灰色'], ['#dcdad5', '白髮'], ['#6b2226', '酒紅'], ['#2f3f6b', '藍黑']];
const TOP_C = [['#f4f3ef', '白色'], ['#1d1f24', '黑色'], ['#8b9096', '灰色'], ['#2a3b5e', '深藍'], ['#2f6fd6', '藍色'], ['#8fbbe6', '淺藍'], ['#c8322c', '紅色'], ['#e8742c', '橘色'], ['#f0c33c', '黃色'], ['#3f8f5a', '綠色'], ['#5d6b3a', '軍綠'], ['#eaa6bb', '粉紅'], ['#7d5ba6', '紫色'], ['#8a5a3c', '咖啡'], ['#d9c7a3', '卡其']];
const BOT_C = [['#2a3b5a', '深藍'], ['#4f6d96', '淺藍'], ['#1c1d21', '黑色'], ['#5d6066', '灰色'], ['#1f2a44', '藏青'], ['#8a7654', '卡其'], ['#4b5234', '軍綠'], ['#6b4a35', '咖啡'], ['#efede6', '白色'], ['#8e2b2e', '酒紅']];
const SHOE_C = [['#f1f1ee', '白色'], ['#1b1b1d', '黑色'], ['#6d7178', '灰色'], ['#2f5fb3', '藍色'], ['#c8322c', '紅色'], ['#6b4a35', '咖啡'], ['#f0c33c', '黃色'], ['#3f8f5a', '綠色']];
const HAT_C = [['#1d2a44', '深藍'], ['#1b1b1d', '黑色'], ['#f1f1ee', '白色'], ['#c8322c', '紅色'], ['#2f6fd6', '藍色'], ['#f0c33c', '黃色'], ['#3f8f5a', '綠色'], ['#d9c7a3', '卡其'], ['#eaa6bb', '粉紅']];
const MASK_C = [['#9cc7e4', '淺藍'], ['#f4f3ef', '白色'], ['#1d1f24', '黑色'], ['#eaa6bb', '粉紅'], ['#8b9096', '灰色']];
const sw = (list) => list.map(([v, l]) => ({ value: v, label: l, swatch: v }));
const ch = (list) => list.map(([v, l, x]) => ({ value: v, label: l, ...(x || {}) }));
const CHARACTER_OPTIONS = [
  { key: 'body', label: '性別', choices: ch([['m', '男生'], ['f', '女生']]) },
  { key: 'age', label: '年紀', choices: ch([['kid', '小孩', { height: 1.3 }], ['adult', '大人', { height: 1.72, heightF: 1.6 }], ['elder', '長輩', { height: 1.64, heightF: 1.52 }]]) },
  { key: 'height', label: '身高', type: 'range', min: 1.35, max: 2.0, minKid: 1.0, maxKid: 1.6, step: 0.01, unit: '公尺', choices: ch([[1.55, '矮'], [1.65, '普通'], [1.75, '高'], [1.85, '很高']]) },
  { key: 'build', label: '身材', choices: ch([['slim', '瘦'], ['mid', '普通'], ['big', '壯']]) },
  { key: 'skin', label: '膚色', type: 'color', choices: sw(SKIN_C) },
  { key: 'face', label: '長相', choices: ch([[0, '臉 1'], [1, '臉 2']]) },
  { key: 'hair', label: '髮型', choices: ch([['short', '短髮'], ['buzz', '平頭'], ['side', '旁分'], ['long', '長髮'], ['ponytail', '馬尾'], ['bun', '包頭'], ['curly', '捲髮'], ['bald', '光頭'], ['perm', '阿嬤燙髮']]) },
  { key: 'hairColor', label: '髮色', type: 'color', choices: sw(HAIR_C) },
  { key: 'top', label: '上衣', choices: ch([['tee', 'T恤'], ['shirt', '襯衫'], ['polo', 'POLO衫'], ['hoodie', '連帽外套'], ['jacket', '夾克'], ['vest', '背心'], ['undershirt', '白色汗衫'], ['uniform', '學生制服'], ['floral', '花襯衫']]) },
  { key: 'topColor', label: '上衣顏色', type: 'color', choices: sw(TOP_C) },
  { key: 'bottom', label: '褲子／裙子', choices: ch([['jeans', '牛仔褲'], ['shorts', '短褲'], ['pants', '長褲'], ['skirt', '裙子'], ['track', '運動褲']]) },
  { key: 'bottomColor', label: '褲子顏色', type: 'color', choices: sw(BOT_C) },
  { key: 'shoes', label: '鞋子', choices: ch([['sneakers', '球鞋'], ['slippers', '藍白拖', { fixedColor: true }], ['leather', '皮鞋'], ['boots', '雨鞋']]) },
  { key: 'shoesColor', label: '鞋子顏色', type: 'color', choices: sw(SHOE_C) },
  { key: 'hat', label: '帽子', choices: ch([['none', '不戴'], ['cap', '棒球帽'], ['bucket', '漁夫帽'], ['helmet', '機車安全帽'], ['straw', '斗笠', { fixedColor: true }]]) },
  { key: 'hatColor', label: '帽子顏色', type: 'color', choices: sw(HAT_C) },
  { key: 'glasses', label: '眼鏡', choices: ch([['none', '不戴'], ['glasses', '眼鏡'], ['sunglasses', '墨鏡']]) },
  { key: 'mask', label: '口罩', type: 'toggle', choices: ch([[false, '不戴'], [true, '戴口罩']]) },
  { key: 'maskColor', label: '口罩顏色', type: 'color', choices: sw(MASK_C) },
];

// ---- 隨機居民：村子裡會看到的人（學生、上班族、戴斗笠的農夫、穿汗衫藍白拖的阿伯、燙頭髮的阿嬤、小孩、戴安全帽口罩的騎士⋯）----
function randomLook(rng = Math.random) {
  const R = typeof rng === 'function' ? rng : Math.random;
  const pick = (a) => a[Math.min(a.length - 1, Math.floor(R() * a.length))];
  const wp = (list) => { let t = 0; for (const x of list) t += x[0]; let r = R() * t; for (const x of list) { r -= x[0]; if (r <= 0) return x[1]; } return list[list.length - 1][1]; };
  const nrm = (m, sd, a, b) => clamp(m + sd * (R() + R() + R() - 1.5) * 1.41, a, b);
  const tint = (hex, k = 0.06) => { const c = new THREE.Color(hex); const f = 1 + (R() * 2 - 1) * k; c.r = clamp(c.r * f, 0, 1); c.g = clamp(c.g * f, 0, 1); c.b = clamp(c.b * f, 0, 1); return '#' + c.getHexString(); };
  const L = { ...DEF, face: R() < 0.5 ? 0 : 1, seed: Math.floor(R() * 1e6), glasses: 'none', hat: 'none', mask: false, maskColor: pick(['#9cc7e4', '#9cc7e4', '#f4f3ef', '#f4f3ef', '#1d1f24', '#eaa6bb']) };
  L.skin = tint(wp([[3, '#f1cdb0'], [6, '#e6bc98'], [6, '#dcae88'], [4, '#cf9f78'], [2, '#bf8a60'], [1, '#a8744f']]), 0.03);
  const dark = () => wp([[10, '#141110'], [5, '#231812'], [2, '#3b2819'], [1, '#5a3b26'], [0.6, '#7a4a2a'], [0.3, '#6b2226']]);
  const grey = () => wp([[3, '#9a9894'], [3, '#bdbbb6'], [2, '#dcdad5'], [1.5, '#141110'], [0.6, '#5a4640']]);
  const casual = () => tint(wp([[6, '#f4f3ef'], [6, '#1d1f24'], [4, '#8b9096'], [4, '#2a3b5e'], [3, '#2f6fd6'], [2, '#8fbbe6'], [2, '#c8322c'], [1.5, '#e8742c'], [1.5, '#f0c33c'], [2, '#3f8f5a'], [2, '#5d6b3a'], [2, '#eaa6bb'], [1, '#7d5ba6'], [2, '#8a5a3c'], [2, '#d9c7a3']]));
  const muted = () => tint(pick(['#6f7a80', '#8a8f86', '#5b6770', '#a39a86', '#7b6a58', '#4f5d6b', '#8c7b6b', '#b0a89a', '#62704f']));
  const jeans = () => tint(wp([[5, '#2a3b5a'], [3, '#4f6d96'], [2, '#1c1d21'], [1, '#5d6066']]));
  const pantsC = () => tint(wp([[4, '#1c1d21'], [3, '#5d6066'], [3, '#1f2a44'], [2, '#8a7654'], [1, '#4b5234'], [1, '#6b4a35']]));
  const sneak = () => wp([[6, '#f1f1ee'], [3, '#1b1b1d'], [2, '#6d7178'], [1, '#2f5fb3'], [0.6, '#c8322c']]);
  const fem = (p) => R() < p;
  const type = wp([[15, 'young'], [13, 'office'], [9, 'student'], [9, 'kid'], [9, 'uncle'], [8, 'grandma'], [6, 'farmer'], [8, 'rider'], [6, 'sporty'], [5, 'mom'], [5, 'elderM']]);
  L.type = type;
  switch (type) {
    case 'young': {
      const f = fem(0.5); Object.assign(L, { body: f ? 'f' : 'm', age: 'adult', height: f ? nrm(1.61, 0.05, 1.48, 1.76) : nrm(1.73, 0.06, 1.58, 1.9), build: wp([[3, 'slim'], [6, 'mid'], [1.5, 'big']]) });
      L.hair = f ? wp([[5, 'long'], [4, 'ponytail'], [3, 'short'], [1, 'bun'], [0.6, 'curly']]) : wp([[6, 'short'], [4, 'side'], [2, 'buzz'], [0.6, 'curly']]);
      L.hairColor = R() < 0.25 ? pick(['#5a3b26', '#8a5a33', '#b98a52', '#6b2226']) : dark();
      L.top = wp([[6, 'tee'], [2, 'hoodie'], [2, 'polo'], [1.5, 'shirt'], [1, 'jacket'], [f ? 1 : 0.5, 'vest']]); L.topColor = casual();
      L.bottom = f ? wp([[4, 'jeans'], [3, 'shorts'], [3, 'skirt'], [1, 'track']]) : wp([[5, 'jeans'], [4, 'shorts'], [1.5, 'track'], [1, 'pants']]);
      L.bottomColor = L.bottom === 'jeans' ? jeans() : L.bottom === 'skirt' ? casual() : pantsC();
      L.shoes = wp([[7, 'sneakers'], [3, 'slippers']]); L.shoesColor = sneak();
      if (R() < 0.2) { L.hat = 'cap'; L.hatColor = casual(); }
      if (R() < 0.25) L.glasses = R() < 0.25 ? 'sunglasses' : 'glasses';
      L.mask = R() < 0.1; break;
    }
    case 'office': {
      const f = fem(0.45); Object.assign(L, { body: f ? 'f' : 'm', age: 'adult', height: f ? nrm(1.6, 0.05, 1.5, 1.74) : nrm(1.72, 0.06, 1.6, 1.86), build: wp([[2, 'slim'], [6, 'mid'], [2, 'big']]) });
      L.hair = f ? wp([[4, 'long'], [3, 'short'], [2, 'bun'], [2, 'ponytail']]) : wp([[5, 'side'], [4, 'short'], [1, 'buzz']]); L.hairColor = dark();
      L.top = wp([[5, 'shirt'], [3, 'polo'], [1, 'jacket']]); L.topColor = tint(wp([[6, '#f4f3ef'], [4, '#8fbbe6'], [2, '#dbe4ee'], [1.5, '#8b9096'], [1, '#eaa6bb'], [1, '#2a3b5e']]), 0.03);
      L.bottom = f ? wp([[3, 'pants'], [3, 'skirt']]) : 'pants'; L.bottomColor = tint(pick(['#1c1d21', '#1f2a44', '#3b3f46', '#5d6066', '#6b5a45']), 0.04);
      L.shoes = wp([[6, 'leather'], [1, 'sneakers']]); L.shoesColor = pick(['#1b1b1d', '#3b2a20']);
      if (R() < 0.4) L.glasses = 'glasses';
      L.mask = R() < 0.15; break;
    }
    case 'student': {
      const f = fem(0.5); Object.assign(L, { body: f ? 'f' : 'm', age: 'adult', height: f ? nrm(1.58, 0.04, 1.48, 1.68) : nrm(1.69, 0.05, 1.56, 1.8), build: wp([[4, 'slim'], [5, 'mid'], [0.8, 'big']]) });
      L.hair = f ? wp([[4, 'ponytail'], [3, 'short'], [3, 'long']]) : wp([[5, 'short'], [3, 'buzz'], [2, 'side']]); L.hairColor = dark();
      L.top = 'uniform'; L.topColor = pick(['#f4f3ef', '#f4f3ef', '#dfe9f5', '#f2efe2']);
      L.bottom = f ? wp([[5, 'skirt'], [1, 'pants']]) : wp([[4, 'pants'], [2, 'shorts']]); L.bottomColor = pick(['#1f2a44', '#1c1d21', '#2a3b5e', '#6b6e57', '#39414f']);
      L.shoes = 'sneakers'; L.shoesColor = pick(['#f1f1ee', '#f1f1ee', '#1b1b1d']);
      if (R() < 0.35) L.glasses = 'glasses';
      L.mask = R() < 0.2; break;
    }
    case 'kid': {
      const f = fem(0.5); Object.assign(L, { body: f ? 'f' : 'm', age: 'kid', height: nrm(1.3, 0.07, 1.12, 1.45), build: wp([[3, 'slim'], [5, 'mid'], [1.2, 'big']]) });
      L.hair = f ? wp([[4, 'ponytail'], [3, 'short'], [2, 'long'], [1, 'bun']]) : wp([[5, 'short'], [3, 'buzz'], [1, 'side']]); L.hairColor = dark();
      if (R() < 0.45) { L.top = 'uniform'; L.topColor = pick(['#f4f3ef', '#f4f3ef', '#dfe9f5']); L.bottom = f ? pick(['skirt', 'shorts']) : 'shorts'; L.bottomColor = pick(['#1f2a44', '#2a3b5e', '#1c1d21']); }
      else { L.top = wp([[6, 'tee'], [2, 'hoodie'], [1, 'polo']]); L.topColor = tint(pick(['#f0c33c', '#e8742c', '#2f6fd6', '#c8322c', '#3f8f5a', '#eaa6bb', '#8fbbe6', '#f4f3ef', '#7d5ba6'])); L.bottom = wp([[5, 'shorts'], [2, 'track'], [2, 'jeans'], [f ? 2 : 0, 'skirt']]); L.bottomColor = L.bottom === 'jeans' ? jeans() : pantsC(); }
      L.shoes = wp([[8, 'sneakers'], [2, 'slippers']]); L.shoesColor = pick(['#f1f1ee', '#2f5fb3', '#c8322c', '#f0c33c', '#eaa6bb', '#1b1b1d']);
      if (R() < 0.18) { L.hat = R() < 0.7 ? 'cap' : 'bucket'; L.hatColor = casual(); }
      break;
    }
    case 'uncle': {
      Object.assign(L, { body: 'm', age: 'elder', height: nrm(1.66, 0.05, 1.54, 1.78), build: wp([[1.5, 'slim'], [4, 'mid'], [4, 'big']]) });
      L.hair = wp([[4, 'buzz'], [3, 'short'], [2, 'bald'], [1.5, 'side']]); L.hairColor = grey();
      L.skin = tint(pick(['#dcae88', '#cf9f78', '#c99468', '#b98458']), 0.03);
      L.top = wp([[6, 'undershirt'], [2, 'polo'], [1.5, 'shirt']]); L.topColor = L.top === 'undershirt' ? pick(['#f2f0e8', '#f4f3ef', '#ece6d6']) : muted();
      L.bottom = wp([[5, 'shorts'], [3, 'pants'], [1, 'track']]); L.bottomColor = tint(pick(['#1c1d21', '#3b3f46', '#5d6066', '#6b5a45', '#1f2a44', '#8a7654']));
      L.shoes = wp([[6, 'slippers'], [2, 'leather'], [2, 'sneakers']]); L.shoesColor = L.shoes === 'leather' ? '#1b1b1d' : sneak();
      if (R() < 0.3) { L.hat = R() < 0.6 ? 'cap' : 'bucket'; L.hatColor = muted(); }
      if (R() < 0.3) L.glasses = 'glasses';
      L.mask = R() < 0.15; break;
    }
    case 'elderM': {
      Object.assign(L, { body: 'm', age: 'elder', height: nrm(1.64, 0.05, 1.52, 1.76), build: wp([[2, 'slim'], [4, 'mid'], [2, 'big']]) });
      L.hair = wp([[3, 'side'], [3, 'short'], [2, 'buzz'], [1, 'bald']]); L.hairColor = grey();
      L.top = wp([[3, 'shirt'], [3, 'polo'], [2, 'jacket']]); L.topColor = muted();
      L.bottom = 'pants'; L.bottomColor = pantsC(); L.shoes = wp([[3, 'leather'], [2, 'sneakers']]); L.shoesColor = L.shoes === 'leather' ? '#2b211b' : sneak();
      if (R() < 0.35) { L.hat = 'cap'; L.hatColor = muted(); }
      if (R() < 0.5) L.glasses = 'glasses';
      L.mask = R() < 0.25; break;
    }
    case 'grandma': {
      Object.assign(L, { body: 'f', age: 'elder', height: nrm(1.52, 0.04, 1.42, 1.62), build: wp([[1.5, 'slim'], [4, 'mid'], [3, 'big']]) });
      L.hair = wp([[6, 'perm'], [2, 'bun'], [1.5, 'short']]); L.hairColor = wp([[3, '#9a9894'], [2, '#bdbbb6'], [2, '#141110'], [1, '#dcdad5'], [1, '#3a2a24'], [0.8, '#5b2a2e']]);
      L.top = wp([[5, 'floral'], [2, 'shirt'], [1.5, 'polo'], [1, 'jacket']]); L.topColor = tint(pick(['#b04a5a', '#6b4f8f', '#2f6f8f', '#8f3b3b', '#d6d2c4', '#5a7a4a', '#c8743a', '#3b4f7a']));
      L.bottom = wp([[6, 'pants'], [1, 'skirt'], [1.5, 'track']]); L.bottomColor = tint(pick(['#1c1d21', '#2b2f3a', '#3b3f46', '#4a3b35', '#1f2a44']));
      L.shoes = wp([[4, 'slippers'], [3, 'sneakers'], [1, 'leather']]); L.shoesColor = pick(['#1b1b1d', '#6d7178', '#f1f1ee', '#6b4a35']);
      if (R() < 0.3) { L.hat = 'bucket'; L.hatColor = pick(['#d9c7a3', '#eaa6bb', '#f1f1ee', '#8fbbe6']); }
      if (R() < 0.3) L.glasses = 'glasses';
      L.mask = R() < 0.3; break;
    }
    case 'farmer': {
      const f = fem(0.35), old = R() < 0.55; Object.assign(L, { body: f ? 'f' : 'm', age: old ? 'elder' : 'adult', height: f ? nrm(1.55, 0.04, 1.44, 1.66) : nrm(1.67, 0.05, 1.55, 1.8), build: wp([[3, 'slim'], [4, 'mid'], [1, 'big']]) });
      L.skin = tint(pick(['#c99468', '#b98458', '#a8744f', '#cf9f78']), 0.03);
      L.hair = f ? wp([[3, 'bun'], [2, 'short'], [1, 'perm']]) : wp([[4, 'buzz'], [3, 'short'], [1, 'bald']]); L.hairColor = old ? grey() : dark();
      L.top = wp([[5, 'shirt'], [2, 'jacket'], [1, f ? 'floral' : 'tee']]); L.topColor = muted();
      L.bottom = wp([[4, 'pants'], [2, 'track']]); L.bottomColor = tint(pick(['#3b3f46', '#4b5234', '#6b5a45', '#2b2f3a', '#5d6066']));
      L.shoes = 'boots'; L.shoesColor = pick(['#1b1b1d', '#1b1b1d', '#2b3a2f', '#6b2a24', '#d8c23a']);
      if (R() < 0.8) L.hat = 'straw'; else { L.hat = 'bucket'; L.hatColor = muted(); }
      L.mask = R() < 0.2; if (L.mask) L.maskColor = pick(['#f4f3ef', '#9cc7e4', '#6d7178']); break;
    }
    case 'rider': {
      const f = fem(0.45); Object.assign(L, { body: f ? 'f' : 'm', age: 'adult', height: f ? nrm(1.6, 0.05, 1.48, 1.74) : nrm(1.72, 0.06, 1.58, 1.88), build: wp([[2, 'slim'], [5, 'mid'], [2, 'big']]) });
      L.hair = f ? wp([[4, 'long'], [3, 'ponytail'], [2, 'short']]) : wp([[5, 'short'], [3, 'side'], [2, 'buzz']]); L.hairColor = dark();
      L.top = wp([[4, 'jacket'], [3, 'hoodie'], [2, 'tee'], [1, 'shirt']]); L.topColor = casual();
      L.bottom = wp([[5, 'jeans'], [3, 'pants'], [1.5, 'shorts'], [f ? 1 : 0, 'skirt']]); L.bottomColor = L.bottom === 'jeans' ? jeans() : pantsC();
      L.shoes = wp([[6, 'sneakers'], [3, 'slippers'], [1, 'leather']]); L.shoesColor = sneak();
      L.hat = 'helmet'; L.hatColor = pick(['#f1f1ee', '#f1f1ee', '#1b1b1d', '#c8322c', '#2f6fd6', '#f0c33c', '#eaa6bb', '#8b9096']);
      L.mask = R() < 0.7; if (R() < 0.15) L.glasses = 'sunglasses'; break;
    }
    case 'sporty': {
      const f = fem(0.45); Object.assign(L, { body: f ? 'f' : 'm', age: R() < 0.2 ? 'elder' : 'adult', height: f ? nrm(1.62, 0.05, 1.5, 1.76) : nrm(1.74, 0.06, 1.6, 1.9), build: wp([[4, 'slim'], [5, 'mid'], [1, 'big']]) });
      L.hair = f ? wp([[5, 'ponytail'], [2, 'short'], [1, 'bun']]) : wp([[5, 'short'], [4, 'buzz']]); L.hairColor = L.age === 'elder' ? grey() : dark();
      L.top = wp([[5, 'tee'], [2, 'vest'], [2, 'hoodie']]); L.topColor = casual();
      L.bottom = wp([[5, 'track'], [4, 'shorts']]); L.bottomColor = pantsC(); L.shoes = 'sneakers'; L.shoesColor = sneak();
      if (R() < 0.4) { L.hat = 'cap'; L.hatColor = casual(); }
      if (R() < 0.15) L.glasses = 'sunglasses'; break;
    }
    case 'mom': {
      Object.assign(L, { body: 'f', age: 'adult', height: nrm(1.58, 0.05, 1.46, 1.7), build: wp([[2, 'slim'], [5, 'mid'], [2.5, 'big']]) });
      L.hair = wp([[3, 'bun'], [3, 'short'], [2, 'ponytail'], [2, 'long'], [1, 'perm']]); L.hairColor = R() < 0.3 ? pick(['#5a3b26', '#6b2226', '#3b2819']) : dark();
      L.top = wp([[3, 'floral'], [3, 'tee'], [2, 'polo'], [1.5, 'shirt']]); L.topColor = casual();
      L.bottom = wp([[3, 'pants'], [3, 'jeans'], [2, 'skirt'], [1, 'track']]); L.bottomColor = L.bottom === 'jeans' ? jeans() : pantsC();
      L.shoes = wp([[4, 'slippers'], [4, 'sneakers']]); L.shoesColor = sneak();
      if (R() < 0.2) { L.hat = 'bucket'; L.hatColor = casual(); }
      if (R() < 0.25) L.glasses = 'glasses';
      L.mask = R() < 0.25; break;
    }
  }
  L.height = +L.height.toFixed(3);
  return L;
}


return { buildCharacter, randomLook, CHARACTER_OPTIONS, PLAYER_LOOK };
})();
