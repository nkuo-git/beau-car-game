// ---- 畫質（第 29 批）：Nick 2026-10-23「就用5號的真實度」（範例 https://claude.ai/artifact/4qQroLLTQSbopBgVqoHeHv 的 5 號「最真實」）----
// 三種（全螢幕開車「⋯」→「✨」→ 畫質 最真實／漂亮／順；每支手機自己記 carid.look，不在存檔裡）：
//   0 順：原本的樣子（卡通、亮的顏色、沒有影子）
//   1 漂亮＝範例 3 號：真的天空（雲）、太陽的影子、遠的地方有一點霧；地面細細的紋路、草地深淺、顏色淡一點；山和樹變圓；樹冠換成一片一片的葉子卡片
//   2 最真實＝範例 5 號：1 號的全部＋路、草、水泥的材質貼圖（顏色＋凹凸）、山和草地的起伏、車漆反射天空、草地上一叢一叢的草、樹葉更密、
//     角落陰影（GTAO，半張大小）、一點點光暈、四角暗一點；自己畫：場景（半精度、4 倍多重取樣）→ AO → 光暈 → 色調＋四角 → 畫面
// 每種都換得回去：原本的天空、霧、燈、反射、材質（onBeforeCompile）、法線、顏色、樹冠的三角形、內湖的樹都記著
// 只改開車出門的世界（scene）：車庫頁、房子裡面、警察局、槍店照舊；畫到別的地方（後照鏡）不做後製、不重算影子（用這一格的）
// 第 30 批（Nick 2026-10-24「什麼時候會變晚上的街景」，卡片選「自動輪流」）：一天的時間（只有漂亮、最真實）
//   遊戲裡 12 分鐘＝一天（第 34 批起；以前 24）（照手機的時鐘算：(現在的分鐘 % 12) / 12 × 24 小時，大家不用連線就一樣）；6 點太陽從東邊出來、12 點南邊最高（55 度）、18 點西邊下山
//   天空、太陽（顏色、亮度、影子的方向）、天空光、霧的顏色、反射的圖（照太陽高度分 5 段，第一次用到才做）、曝光都跟著時間變；晚上月亮當太陽（藍藍的、暗、有影子）
//   傍晚起（太陽 6 度以下）：路燈（最近的 4 支真的有光，其他只有亮的燈頭）、招牌亮（emissiveMap 的材質）、大家的車燈亮（masks.js PAINT_NIGHT、carlod.js buildLodCar.night：town.src.js 的 night 回呼）、
//   自己的車兩盞大燈真的照路（SpotLight 跟著車）、光暈（最真實）；最真實：路面像下過雨（濕、暗、水窪，倒影＝把世界倒過來再畫一次到半張大小的圖；只有路面高度附近的地面）
//   look.hour＝現在幾點、look.setHour(h)（測試、試做頁；null＝照時鐘）、look.night＝燈亮多少（0–1）
// 座標跟 village.js 一樣：x 往東、y 往上、z 往南
// 【API】
//   const look = createLook({ renderer, scene, world: V, getCar: () => 現在開的車（Object3D）或 null,
//     plain: () => 不要加地面紋路的那一棟（圓塔：大理石、玻璃是設計好的）, indoor: (cam) => 鏡頭在屋頂底下（圓塔裡面）→ 補光,
//     night: (k) => 燈亮多少變了（0–1；車燈：PAINT_NIGHT、buildLodCar.night）, carDims: (car) => { hx, hz, cx }（車身長方形：大燈放在車頭兩邊）,
//     police: () => 警車 [{ x, z, heading, lights }]（第 32 批：紅藍燈）, traffic: () => 路上的車 [{ x, z, heading, hx, active, kind, crushed }]（第 32 批：大燈照在路上） })
//   await look.set(lv)      換畫質；第一次 1、2 要先找樹冠、算法線（約 0.5–1 秒），第一次 2 要先畫材質貼圖（time-slice）
//   look.level              現在的；look.can.post＝這支手機畫得了最真實嗎（半精度的畫面）；look.half＝半精度的畫面（後照鏡用）
//   look.treeK(j, k)        crush.js：輾扁的樹（j.grp 裡每棵樹 2 公尺內的葉子卡片跟著扁，k＝高度倍數，1＝長回來）
//   look.stats              { calls, tris, ms, maxMs, crowns, cells, grass, mats, smooth, prepMs, texMs }
//   renderer.render 包起來：畫 scene 到畫面的時候（level > 0）先 frame()：影子跟著鏡頭、遠近換樹、草、車漆、隧道裡面補光、新的東西加影子
//   影子：反射、天空光的那張圖不要太陽本身（不然影子裡面也被照到）；車身是一片一片的殼：車的材質兩面都算影子（shadowSide）
//   草、樹葉卡片：兩面用同一個法線（背面不翻成朝下）；最真實的時候 alpha 寫 0，AO 不蓋在它們上面（密密的草葉自己的深度會弄得很黑）
// 【效能】影子 2048（120 公尺見方，跟著鏡頭前面 35 公尺）；樹 200 公尺一格（看不到的不畫、遠的換 36 張卡片的）；
//   草 16 公尺一格 7×7 格（每格 900 叢、換格每幀最多 2 格）；AO 用場景的深度（不用多畫一次場景）、半張大小
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const { createLook, LOOK_NAMES } = (() => {
const LOOK_NAMES = ['順', '漂亮', '最真實'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// 光線（範例 2 號以後都一樣）
const LT = { elev: 38, az: 233, turb: 6, ray: 1.3, mie: 0.004, exp: 0.45, sunI: 4.6, sunC: 0xfff0dc, envI: 0.3, hemiI: 0.12, hemiC: 0xdde6ef, hemiG: 0x474a3c, fog: 0xc3ccd3, gnd: 0x3c4235, cloud: 0.32, cden: 0.5 };
const DAY_MIN = 12; // 第 30 批：遊戲裡一天＝真的 24 分鐘（照手機的時鐘：大家一樣）；第 34 批：Nick「一天時間改成12分鐘」→ 12 分鐘
const SUN_MAX = 55; // 中午太陽多高（度）
const DUSK = { sunC: 0xffb070, hemiI: 0.18, hemiC: 0xc9b2a8, hemiG: 0x2e2c30, fog: 0xd8b49a, envI: 0.4, turb: 6, ray: 2.0, mie: 0.002, g: 0.7, exp: 0.38, sunK: 0.6 }; // 太陽低的時候（橘色、天空濁、霧暖色）；第 31 批：夕陽的光調弱（sunK＝最多少掉幾成）；第 34 批：Nick「面像太陽的時候光線還是有點太亮」：太陽的光暈小一點（turb 8 → 6、mie 0.004 → 0.002、g 0.8 → 0.7）、曝光 0.45 → 0.38
const NIGHT = { hemiI: 0.95, hemiC: 0x46536f, hemiG: 0x1c1f27, fog: 0x161c29, envI: 0.18, exp: 1.15 }; // 晚上：天空光藍藍的、暗；第 37 批（Nick「晚上整體的光線不要太過黑 開車看不太到」）：天空光 0.55 → 0.95、顏色亮一點、霧不要全黑、曝光 0.95 → 1.15
const MOON = { elev: 48, az: 300, c: 0x9fb4d8, I: 0.8 }; // 月亮當太陽（有影子）；第 37 批 0.5 → 0.8
const LAMP = { n: 4, nLow: 2, c: 0xffd9a0, I: 180, dist: 46, fade0: 50, fade1: 88, headC: 0xfff0d0, headI: 18, headDecay: 0.6, headDist: 200, headAim: 70, headAng: 0.72, bloom: 0.18, thr: 2.6, sign: 0.5 }; // 路燈（最近 4 支真的有光；離鏡頭 50–88 公尺慢慢變暗＝換支的時候不跳）、自己的車的大燈（第 31 批：520 → 150，車前面不再一片白；第 34 批：Nick「晚上車燈可以照遠一點嗎」：衰減改成 1／距離^0.6（以前 1／距離²）、強度 18、照到 150 公尺、對準前面 60 公尺——車前面一樣亮（5 公尺 6.8），30 公尺 2.3、60 公尺 1.5（以前 0.17、0.04））、晚上的光暈
const NSKY = { stars: 900, starR: 870, starSz: 2.4, moonR: 24, moonD: 860, moonC: 0xe9eef7, winC: [1.9, 1.45, 0.85], shopC: [1.5, 1.55, 1.45], winP: 0.6, shopP: 0.85, polI: 70, polD: 34, polT: 0.8, poolN: 12, poolI: 0.34, poolL: 9.5, poolW: 4.4, hwK: 2.2, parkK: 1.4, beamL: 100, beamW: 30, beamI: 0.8 }; // 第 37 批（Nick「車燈要能照廣照遠一點」）：自己的大燈在路上的光斑 70 → 100 公尺、18 → 30 公尺寬、0.65 → 0.8；SpotLight 照到 200 公尺、角度 0.5 → 0.72 // 第 32 批：晚上的天空（星星、月亮的圓盤）、透天厝一樓窗戶、店面的燈（幾成亮）、警車的紅藍燈（最近一台）、路上車子的大燈照在路上（最近 12 台）、快速道路／停車場的路燈比電線桿的亮（燈頭比較高）
const WET = { dark: 0.62, pud: 0.55, rough: 0.3, pudRough: 0.04, base: 0.28, lod: 4.5 }; // 下過雨的路（最真實）：變暗、水窪更暗、粗糙度、倒影（水窪外面 35%、模糊）
const CAVE_I = 1.5, CAVE_C = 0xf4f1ea, CAVE_G = 0x8a8478; // 隧道裡面（hills.js 的 dimK 0.42）、圓塔裡面：天空光補到這麼多、顏色白一點（太陽被擋住了，不然一片黑、藍藍的）
// 材質（範例 3 號、5 號）
const MB = { desat: 0.9, grain: 0.08, grass: 0.38, patch: 0.3, fine2: 0.22, olive: 0.75, clump: 0.5, albedo: 0.78, leaf: 3.5, pk: 0.9, pn: 1.6, macro: 5, wallS: 1.7, wallK: 0.75, streak: 0.16, wallN: 1.1 }; // 第 39 批：牆的材質（wall*：貼圖幾公尺一格、顏色多強、髒水痕、凹凸）
const TREE = [null, { cards: 110, cone: 8 }, { cards: 230, cone: 14 }], TREE_FAR = { cards: 36, cone: 4 }, TREE_NEAR = 190, CELL = 200;
const SHADOW = 2048, SH_R = 60, SH_AHEAD = 35;
// 第 37 批（Nick 2026-10-25「漂亮那階不順 有些舊手機跑不太動」，選 1 2 3）：漂亮＝影子圖 1024、範圍 40 公尺（前面 22 公尺為中心）；最真實照舊
const SHL = [null, { map: 1024, r: 40, ahead: 22, rad: 2 }, { map: 4096, r: 110, ahead: 60, rad: 3.5 }];
// 第 39 批（Nick 2026-10-25「做1234 只做在最真實」；最真實＝不管手機）：1 影子圖 4096、照 ±110 公尺（前面 60 公尺為中心）、邊邊柔一點（PCF 半徑 3.5）；手機畫不了 4096 就 2048
const GC = 16, GN = 7, GPER = 900; // 草：一格幾公尺、幾格見方、一格最多幾叢
const POST = { bloom: 0.07, bRad: 0.35, thr: 10, aoR: 2.2, aoS: 2.2, vig: 0.55, carEnv: 0.7, skyMax: 6 }; // 第 34 批 skyMax：看得到的天空最亮到幾（太陽的圓盤在 shader 裡是幾千、幾萬：光暈一糊整個畫面都白；夾住就只是一顆白太陽）
const GROUND = /(^|[-_|])(ground|area|walk|road|paint|grass|paddy|water|asph|line|lane|trail|sea|sand|island|shadow)\b/i; // 地上的：只接影子，不投影子（省）
const f3 = (v) => v.toFixed(3);
const NOISE = `
  float bhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bhash(i), bhash(i + vec3(1,0,0)), f.x), mix(bhash(i + vec3(0,1,0)), bhash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(bhash(i + vec3(0,0,1)), bhash(i + vec3(1,0,1)), f.x), mix(bhash(i + vec3(0,1,1)), bhash(i + vec3(1,1,1)), f.x), f.y), f.z); }
  vec3 bN() { vec3 n = vBN; if (dot(n, n) < 0.25) { n = cross(dFdx(vBW), dFdy(vBW)); if (dot(n, cameraPosition - vBW) < 0.0) n = -n; } return normalize(n); }`; // 沒有法線的網格（內湖）：用畫面上的斜率算
const PBRH = `
  uniform sampler2D tAsA, tAsN, tGrA, tGrN, tCoA, tCoN; float bUp = 0.0, bG = 0.0, bA = 0.0, bW = 0.0; vec2 bWuv = vec2(0.0);
  vec3 bDet(sampler2D t, vec2 w, float s) { return texture(t, w / s).rgb + texture(t, w / (s * 5.3) + vec2(0.37, 0.71)).rgb; }`;
// 顏色：灰的（柏油、水泥）細顆粒；綠的（草、樹、山）一塊一塊深淺、黃綠、偏橄欖綠；樹冠一叢一叢；很亮的灰暗一點；彎很大的綠色邊邊挖成葉子
// 第 35 批（內容 22，Nick「先把路跟房子做更真」）：柏油（材質 userData.role＝'road'）：標線磨損（露出柏油）、裂縫（只有某些區域有）、補丁、一塊一塊的深淺；concU＝貼圖 u 從這裡起是水泥農路（不動）
const ROADX = (cu) => `{ float rn = smoothstep(170.0, 20.0, vBD) * ${cu >= 0 ? `(1.0 - step(${f3(cu)}, vMapUv.x))` : '1.0'};
      if (rn > 0.0) {
        float paint = clamp(smoothstep(0.42, 0.6, l) + smoothstep(0.18, 0.32, sat) * step(c.b, c.r), 0.0, 1.0);
        float wear = smoothstep(0.5, 0.78, bnoise(vBW * 2.3) * 0.55 + bnoise(vBW * 7.0) * 0.45);
        c = mix(c, vec3(0.045, 0.047, 0.05) * (0.8 + 0.4 * fine), paint * wear * 0.85 * rn);
        float r1 = 1.0 - abs(2.0 * bnoise(vBW * 0.55 + vec3(3.1, 0.0, 7.7)) - 1.0), r2 = 1.0 - abs(2.0 * bnoise(vBW * 1.7 + vec3(9.0, 0.0, 1.0)) - 1.0);
        float crack = smoothstep(0.90, 0.985, r1 * (0.7 + 0.3 * r2)) * step(0.55, bnoise(vBW * 0.05 + vec3(5.0)));
        c *= 1.0 - (1.0 - paint) * crack * 0.55 * rn;
        float pat = bnoise(vBW * 0.09 + vec3(11.0)); c *= 1.0 + (1.0 - paint) * (step(0.64, pat) * -0.1 + 0.07 * (bnoise(vBW * 0.25) - 0.5)) * rn;
      } }`;
const COLOR = (pbr, road) => `#include <color_fragment>
  { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)), mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-3);
    float nr = smoothstep(140.0, 15.0, vBD), mid = smoothstep(500.0, 60.0, vBD);
    float fine = 0.5, med = 0.5, pch = 0.5;
    if (nr > 0.0) fine = bnoise(vBW * 11.0) * 0.5 + bnoise(vBW * 31.0) * 0.5;
    if (mid > 0.0) { med = bnoise(vBW * 1.3); pch = bnoise(vBW * 0.11) * 0.65 + bnoise(vBW * 0.035) * 0.35; }
    float green = step(mn, c.b) * smoothstep(0.08, 0.3, sat) * step(c.r, c.g) * step(c.b, c.g);
    c = mix(vec3(l), c, ${f3(MB.desat)});
    float gr = 1.0 - green;
    c *= 1.0 + gr * (${f3(MB.grain)} * (fine - 0.5) * nr + 0.03 * (med - 0.5) * mid);
    c *= 1.0 + green * (${f3(MB.grass)} * (pch - 0.5) * mid + ${f3(MB.fine2)} * (fine - 0.5) * nr);
    c = mix(c, c * vec3(1.12, 1.02, 0.72), green * ${f3(MB.patch)} * smoothstep(0.45, 0.8, pch));
    c = mix(c, c * vec3(${f3(MB.olive)}, ${f3(MB.olive * 1.06)}, ${f3(MB.olive * 0.82)}), green);
    vec3 nn = bN();
    if (green > 0.0 && mid > 0.0) { float side = 1.0 - smoothstep(0.8, 0.97, nn.y), cl = bnoise(vBW * 1.8) * 0.6 + bnoise(vBW * 4.5) * 0.4; c *= 1.0 + green * side * ${f3(MB.clump)} * (cl - 0.5) * mid; }
    c *= mix(1.0, ${f3(MB.albedo)}, smoothstep(0.35, 0.75, l) * (1.0 - smoothstep(0.05, 0.25, sat)));
    if (green > 0.5 && vBD < 90.0) { float curv = length(fwidth(nn)) / max(length(fwidth(vBW)), 1e-4), crown = green * smoothstep(0.12, 0.3, curv) * smoothstep(90.0, 30.0, vBD);
      if (crown > 0.0) { vec3 vd = normalize(cameraPosition - vBW); float rim = 1.0 - abs(dot(nn, vd)), lf = bnoise(vBW * ${MB.leaf.toFixed(2)}) * 0.65 + bnoise(vBW * ${(MB.leaf * 2.7).toFixed(2)}) * 0.35;
        if (crown > 0.5 && lf < (rim - 0.45) * 2.2) discard;
        c *= 1.0 + crown * 0.55 * (lf - 0.5); } }
    ${pbr ? `{ bUp = smoothstep(0.6, 0.85, nn.y); bG = green; bA = (1.0 - green) * (1.0 - smoothstep(0.1, 0.22, l));
      float near = smoothstep(260.0, 25.0, vBD);
      if (bUp * near > 0.0) { vec3 d = mix(mix(bDet(tCoA, vBW.xz, 2.2), bDet(tAsA, vBW.xz, 2.6), bA), bDet(tGrA, vBW.xz, 1.6), bG);
        c *= mix(vec3(1.0), vec3(1.0) + (d - 1.0) * ${f3(MB.pk)}, bUp * near); }
      bW = (1.0 - smoothstep(0.35, 0.7, abs(nn.y))) * (1.0 - green) * smoothstep(90.0, 8.0, vBD); // 第 39 批 4：牆（直的面）：水泥的顆粒＋直直的髒水痕
      if (bW > 0.0) { bWuv = abs(nn.x) > abs(nn.z) ? vBW.zy : vBW.xy; vec3 d = bDet(tCoA, bWuv, ${f3(MB.wallS)});
        c *= mix(vec3(1.0), vec3(1.0) + (d - 1.0) * ${f3(MB.wallK)}, bW);
        float stk = bnoise(vec3(bWuv.x * 2.6, bWuv.y * 0.22, 3.7)) * 0.7 + bnoise(vec3(bWuv.x * 9.0, bWuv.y * 0.6, 1.3)) * 0.3;
        c *= 1.0 - ${f3(MB.streak)} * bW * smoothstep(0.55, 0.85, stk); } }` : ''}
    ${road != null ? ROADX(road) : ''}
    diffuseColor.rgb = c; }`;
// 5 號：地面（朝上的面）的凹凸＋山和草地大大小小的起伏
const PBRN = `#include <normal_fragment_maps>
  { vec3 N = bN(); float k = bUp * smoothstep(120.0, 15.0, vBD);
    if (k > 0.01) { vec3 tn = mix(mix(texture(tCoN, vBW.xz / 2.2).xyz, texture(tAsN, vBW.xz / 2.6).xyz, bA), texture(tGrN, vBW.xz / 1.6).xyz, bG) * 2.0 - 1.0;
      vec3 Tx = normalize(vec3(1.0, 0.0, 0.0) - N * N.x), Tz = normalize(vec3(0.0, 0.0, 1.0) - N * N.z);
      vec3 wn = normalize(N + (Tx * tn.x + Tz * tn.y) * ${f3(MB.pn)});
      normal = normalize(mix(normal, normalize((viewMatrix * vec4(wn, 0.0)).xyz), k)); }
    float kg = bG * smoothstep(0.25, 0.55, N.y) * smoothstep(1600.0, 250.0, vBD);
    if (kg > 0.01) { vec2 q = vBW.xz; const float e = 1.5;
      #define BMH(p) (bnoise(vec3((p) * 0.04, 1.0)) + 0.5 * bnoise(vec3((p) * 0.1, 7.0)) + 0.25 * bnoise(vec3((p) * 0.26, 3.0)))
      float h0 = BMH(q), hx = BMH(q + vec2(e, 0.0)) - h0, hz = BMH(q + vec2(0.0, e)) - h0;
      vec3 Tx = normalize(vec3(1.0, 0.0, 0.0) - N * N.x), Tz = normalize(vec3(0.0, 0.0, 1.0) - N * N.z);
      vec3 wn = normalize(N - (Tx * hx + Tz * hz) * (${MB.macro.toFixed(2)} / e));
      normal = normalize(mix(normal, normalize((viewMatrix * vec4(wn, 0.0)).xyz), kg)); }
    float kw = bW * smoothstep(60.0, 6.0, vBD); // 第 39 批 4：牆的凹凸（水泥）
    if (kw > 0.01) { vec3 tn = texture(tCoN, bWuv / ${f3(MB.wallS)}).xyz * 2.0 - 1.0; vec3 T1 = abs(N.x) > abs(N.z) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0); T1 = normalize(T1 - N * dot(N, T1)); vec3 T2 = normalize(cross(N, T1));
      vec3 wn = normalize(N + (T1 * tn.x + T2 * tn.y) * ${f3(MB.wallN)}); normal = normalize(mix(normal, normalize((viewMatrix * vec4(wn, 0.0)).xyz), kw)); } }`;
// 第 30 批：濕的路（最真實）：朝上、不是草的地面：變暗、水窪、粗糙度變小；路面高度（wetY）1 公尺內的地方混上倒影（tRefl：倒過來畫的世界，reflM 把世界座標投到那張圖上）
const WETH = 'uniform sampler2D tRefl; uniform mat4 reflM; uniform float wetK, wetY; float wWet = 0.0, wPud = 0.0;';
const WETR = `#include <roughnessmap_fragment>
  if (wetK > 0.0) { wWet = wetK * bUp * (1.0 - bG) * smoothstep(400.0, 60.0, vBD); if (wWet > 0.0) { float pn = bnoise(vBW * 0.45) * 0.6 + bnoise(vBW * 1.9) * 0.4; wPud = wWet * smoothstep(0.56, 0.63, pn);
    diffuseColor.rgb *= mix(1.0, ${f3(WET.dark)}, wWet) * mix(1.0, ${f3(WET.pud)}, wPud); roughnessFactor = mix(roughnessFactor, mix(${f3(WET.rough)}, ${f3(WET.pudRough)}, wPud), wWet); } }`;
const WETO = `if (wWet > 0.0 && abs(vBW.y - wetY) < 1.0) { vec4 rp = reflM * vec4(vBW, 1.0); vec2 ruv = rp.xy / rp.w;
    if (rp.w > 0.0 && ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) { vec3 vd = normalize(cameraPosition - vBW); float ct = max(dot(vd, vec3(0.0, 1.0, 0.0)), 0.0), F = 0.04 + 0.96 * pow(1.0 - ct, 5.0);
      vec3 rc = textureLod(tRefl, ruv, mix(${f3(WET.lod)}, 0.0, wPud)).rgb; outgoingLight = mix(outgoingLight, rc * mix(0.6, 1.0, wPud), clamp(F * 1.3, 0.0, 1.0) * wWet * (1.0 - smoothstep(0.7, 1.0, abs(vBW.y - wetY))) * mix(${f3(WET.base)}, 1.0, wPud)); } }
  #include <opaque_fragment>`;
const VDECL = 'varying vec3 vBW; varying float vBD; varying vec3 vBN;';
const VPOS = `#include <project_vertex>
  { vec4 w4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    w4 = instanceMatrix * w4;
  #endif
    vBW = (modelMatrix * w4).xyz; vBD = -mvPosition.z; vBN = normalize(mat3(modelMatrix) * objectNormal); }`;
// 最後一道：曝光、色調（ACES）、sRGB、四角暗一點（跟 OutputPass＋VignetteShader 一樣）
const FINAL = {
  uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: LT.exp }, offset: { value: 0.7 }, darkness: { value: POST.vig } },
  vertexShader: `precision highp float; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `precision highp float; uniform sampler2D tDiffuse; uniform float offset, darkness;
    #define ACES_FILMIC_TONE_MAPPING
    #define SRGB_TRANSFER
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    varying vec2 vUv;
    void main() { vec4 c = texture2D(tDiffuse, vUv); c.rgb = ACESFilmicToneMapping(c.rgb); c = sRGBTransferOETF(c);
      vec2 u = (vUv - vec2(0.5)) * vec2(offset); gl_FragColor = vec4(mix(c.rgb, vec3(1.0 - darkness), dot(u, u)), 1.0); }`,
};

function createLook(o) {
  const R = o.renderer, scene = o.scene, V = o.world, getCar = o.getCar || (() => null), plainOf = o.plain || (() => null), indoor = o.indoor || (() => false), nightCb = o.night || (() => {}), carDims = o.carDims || (() => null);
  const gl = R.getContext();
  const st = { calls: 0, tris: 0, ms: 0, maxMs: 0, crowns: 0, cells: 0, grass: 0, mats: 0, smooth: 0, prepMs: 0, texMs: 0, sets: 0 };
  const half = R.extensions.has('EXT_color_buffer_float') || R.extensions.has('EXT_color_buffer_half_float');
  const mobile = (() => { try { const n = navigator, ua = String(n.userAgent || ''); return !!(n.userAgentData && n.userAgentData.mobile) || /Android|iPhone|iPad|iPod|Mobile|BeauCarApp/i.test(ua) || (/Macintosh/.test(ua) && n.maxTouchPoints > 1); } catch { return false; } })(); // 第 39 批
  const soft = (() => { try { const x = gl.getExtension('WEBGL_debug_renderer_info'); return /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER))); } catch { return false; } })();
  let LV = 0, busy = null, S0 = null, prepped = false;
  let dl = null, hemi = null; for (const c of scene.children) { if (!dl && c.isDirectionalLight) dl = c; if (!hemi && c.isHemisphereLight) hemi = c; }
  const skyM = scene.getObjectByName('sky');
  const sun = new THREE.Vector3(), EXP0 = R.toneMappingExposure;
  // ==== 第 30 批：一天的時間 ====
  let hourOv = null; // 測試、試做頁：固定幾點（null＝照時鐘）
  const hourNow = () => (hourOv != null ? hourOv : (((Date.now() / 60000) % DAY_MIN) / DAY_MIN) * 24);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TD = { h: 12, elev: SUN_MAX, az: 270, day: 1, warm: 0, night: 0, lamp: 0, moon: 0, exp: LT.exp, envI: LT.envI, hemiI: LT.hemiI, sunI: LT.sunI, dlI: LT.sunI, fog: new THREE.Color(LT.fog), hemiC: new THREE.Color(LT.hemiC), hemiG: new THREE.Color(LT.hemiG), sunC: new THREE.Color(LT.sunC), band: '' };
  const C_D = { sunC: new THREE.Color(LT.sunC), fog: new THREE.Color(LT.fog), hC: new THREE.Color(LT.hemiC), hG: new THREE.Color(LT.hemiG) }, C_K = { sunC: new THREE.Color(DUSK.sunC), fog: new THREE.Color(DUSK.fog), hC: new THREE.Color(DUSK.hemiC), hG: new THREE.Color(DUSK.hemiG) }, C_N = { fog: new THREE.Color(NIGHT.fog), hC: new THREE.Color(NIGHT.hemiC), hG: new THREE.Color(NIGHT.hemiG), moon: new THREE.Color(MOON.c) };
  const dirOf = (out, elev, az) => { const e = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(az); return out.set(Math.cos(e) * Math.cos(a), Math.sin(e), -Math.cos(e) * Math.sin(a)).normalize(); };
  function timeStep() { // 現在幾點 → 太陽在哪、多亮、多暖、晚上多深、燈亮多少、各種顏色（每一格算，都很便宜）
    const h = hourNow(), t = (((h - 6) / 12) % 2 + 2) % 2, elev = SUN_MAX * Math.sin(Math.PI * t), az = ((360 - (h - 6) * 15) % 360 + 360) % 360;
    TD.h = h; TD.elev = elev; TD.az = az;
    TD.day = ss(-6, 8, elev); TD.warm = 1 - ss(3, 22, elev); TD.night = 1 - ss(-10, -1, elev); TD.lamp = 1 - ss(-2, 8, elev); TD.moon = 1 - ss(-9, -6, elev);
    const w = TD.warm, n = TD.night;
    TD.exp = THREE.MathUtils.lerp(THREE.MathUtils.lerp(LT.exp, DUSK.exp, w), NIGHT.exp, n);
    TD.envI = THREE.MathUtils.lerp(THREE.MathUtils.lerp(LT.envI, DUSK.envI, w), NIGHT.envI, n);
    TD.hemiI = THREE.MathUtils.lerp(THREE.MathUtils.lerp(LT.hemiI, DUSK.hemiI, w), NIGHT.hemiI, n);
    TD.fog.lerpColors(C_D.fog, C_K.fog, w).lerp(C_N.fog, n); TD.hemiC.lerpColors(C_D.hC, C_K.hC, w).lerp(C_N.hC, n); TD.hemiG.lerpColors(C_D.hG, C_K.hG, w).lerp(C_N.hG, n);
    if (TD.day > 0.001) { dirOf(sun, elev, az); TD.sunC.lerpColors(C_D.sunC, C_K.sunC, w); TD.dlI = LT.sunI * TD.day * (1 - DUSK.sunK * w); } // 第 31 批：太陽低的時候光也弱（夕陽不刺眼）
    else { dirOf(sun, MOON.elev, MOON.az); TD.sunC.copy(C_N.moon); TD.dlI = MOON.I * TD.moon; }
    TD.band = n > 0.5 ? 'n' : 'b' + Math.floor(clamp(elev, 0, SUN_MAX - 0.01) / 5); // 反射的圖每 5 度一段（第 31 批：以前 5 段，換段的時候反射看得出跳；現在 11 段＋晚上，每段差很少，第一次用到才做）
  }
  timeStep();
  const V3 = new THREE.Vector3(), V3b = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), S3 = new THREE.Vector3(), COL = new THREE.Color();
  // 影子相機的軸（對齊影子的格子，鏡頭動的時候影子邊邊不會閃）；太陽會動：每一格重算
  const LX = new THREE.Vector3(), LY = new THREE.Vector3(); let SH = SHL[2], TEXEL = (SH.r * 2) / SH.map; // 第 37 批：影子照層級（shadowCfg）
  const own = (m, k) => Object.prototype.hasOwnProperty.call(m, k);
  const hl = () => V.hills || null;
  function setBase(light, v) { // 換燈的亮度：hills.js 隧道裡面變暗用的原本亮度也一起換
    const H = hl(); let k = 1;
    if (H && H.lights) for (const e of H.lights) if (e[0] === light) { e[1] = v; k = H.dimK ?? 1; }
    light.intensity = v * k;
  }

  // ==== 天空、反射 ====
  let skyMat = null, envTex = null; const ENVS = new Map(); let envBand = '';
  const skyUni = (u) => { const w = TD.warm; u.turbidity.value = THREE.MathUtils.lerp(LT.turb, DUSK.turb, w); u.rayleigh.value = THREE.MathUtils.lerp(LT.ray, DUSK.ray, w); u.mieCoefficient.value = THREE.MathUtils.lerp(LT.mie, DUSK.mie, w); u.mieDirectionalG.value = THREE.MathUtils.lerp(0.8, DUSK.g, w);
    if (TD.day > 0.001) u.sunPosition.value.copy(sun); else dirOf(u.sunPosition.value, TD.elev, TD.az); // 晚上：天空照（地平線下的）太陽算＝黑的；月亮只當燈
    if (u.cloudCoverage) { u.cloudCoverage.value = LT.cloud; u.cloudDensity.value = LT.cden; } };
  function skyOf(scale) { const k = new Sky(); skyUni(k.material.uniforms); k.scale.setScalar(scale); return k; }
  function makeSky() {
    if (!skyMat) { const k = skyOf(1); skyMat = k.material; skyMat.depthWrite = false; k.geometry.dispose();
      const f0 = 'gl_FragColor = vec4( texColor, 1.0 );'; if (skyMat.fragmentShader.includes(f0)) { skyMat.fragmentShader = skyMat.fragmentShader.replace(f0, `gl_FragColor = vec4( min( texColor, vec3( ${POST.skyMax.toFixed(1)} ) ), 1.0 );`); skyMat.needsUpdate = true; } else console.warn('look: sky shader changed, no skyMax clamp'); } // 第 34 批：太陽那一點夾住（反射圖那個 skyOf(100) 不夾：本來就沒有太陽）
    skyUni(skyMat.uniforms);
    const band = TD.band; if (band === envBand && envTex) return; envBand = band;
    let tex = ENVS.get(band);
    if (!tex) { // 這一段太陽高度的反射圖（第一次用到才做，之後換來換去不用再做）
      const es = new THREE.Scene(), k2 = skyOf(100); es.add(k2); if (k2.material.uniforms.showSunDisc) k2.material.uniforms.showSunDisc.value = 0; // 反射、天空光不要太陽本身（不然影子裡面也被太陽照到，影子很淡）
      const gnd = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: LT.gnd })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -2; es.add(gnd);
      const pm = new THREE.PMREMGenerator(R); tex = pm.fromScene(es, 0.03).texture; pm.dispose(); ENVS.set(band, tex);
      k2.geometry.dispose(); k2.material.dispose(); gnd.geometry.dispose(); gnd.material.dispose();
    }
    envTex = tex; if (LV > 0) { scene.environment = envTex; const ce = carEnvTex(); for (const c of CARM) if (c[0].envMap) { c[0].envMap = ce; } }
  }

  // ==== 影子、材質（新的東西慢慢找：每幀最多 300 個）====
  const SHAD = new Set(), MATS = new Set(), SSIDE = new Set(), HIDE = [], GND = new Set(); let SEEN = new WeakSet(); // 開了影子的、改了的材質、看過的東西、藏起來的（地上畫的假影子）、地上的（倒影不畫）
  let grassMat = null, leafMat = null, TEX = null;
  const MASKU = { value: 0 }; // 5 號：草、樹葉卡片在場景圖的 alpha 寫 0 → AO 不蓋在它們上面（不然密密的草葉被自己的深度弄得很黑）
  const maskObc = (sh) => { sh.uniforms.lkMask = MASKU; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float lkMask;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a *= 1.0 - lkMask;')
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  #ifndef FLAT_SHADED\n  normal = normalize(vNormal);\n  #endif'); }; // 卡片兩面都用同一個法線（背面不要翻成朝下：一半的草葉、葉子會黑黑的）
  const pbrOk = (m) => LV === 2 && !!TEX && !m.transparent && !(m.alphaTest > 0);
  const roadOf = (m) => (m.userData.role === 'road' && m.map ? (m.userData.concU ?? -1) : null); // 第 35 批：柏油的材質（village／neihu／circuit／race 標的）→ 水泥農路從 u 幾起（沒有＝−1）
  const WU = { tRefl: { value: null }, reflM: { value: new THREE.Matrix4() }, wetK: { value: 0 }, wetY: { value: 0 } }; // 濕路：所有材質共用
  const SIGNS = new Map(); // 第 30 批：招牌（emissiveMap＝map 的材質）→ 原本的 emissiveIntensity；晚上加亮
  let lampSent = -1, signK = -1;
  let PLAINR = null; const PLAINM = new Set(); // 圓塔（plain）的材質：別的家的外殼也用同一個，所以記材質不是記東西
  function plainMats() { const r = plainOf(); if (r === PLAINR) return; PLAINR = r; PLAINM.clear(); if (r) r.traverse((x) => { if (x.material) for (const m of [].concat(x.material)) PLAINM.add(m); }); }
  function patchMat(m) {
    if (!m || MATS.has(m) || !m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m === grassMat || m.isShaderMaterial || PLAINM.has(m)) return;
    MATS.add(m);
    const ud = m.userData; if (!ud.lk) ud.lk = { obc: own(m, 'onBeforeCompile') ? m.onBeforeCompile : null, key: own(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null };
    const obc0 = ud.lk.obc, key0 = ud.lk.key;
    m.onBeforeCompile = function (sh, r) {
      if (obc0) obc0.call(this, sh, r);
      if (LV === 0) return;
      const pbr = pbrOk(this), road = roadOf(this);
      if (pbr) { const T = TEX; Object.assign(sh.uniforms, { tAsA: { value: T.asA }, tAsN: { value: T.asN }, tGrA: { value: T.grA }, tGrN: { value: T.grN }, tCoA: { value: T.coA }, tCoN: { value: T.coN } }, WU); }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VDECL).replace('#include <project_vertex>', VPOS);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + VDECL + NOISE + (pbr ? PBRH + WETH : ''))
        .replace('#include <color_fragment>', COLOR(pbr, road))
        .replace('#include <normal_fragment_maps>', pbr ? PBRN : '#include <normal_fragment_maps>')
        .replace('#include <roughnessmap_fragment>', (pbr ? WETR : '#include <roughnessmap_fragment>') + '\nroughnessFactor = clamp(roughnessFactor * (0.85 + 0.3 * bnoise(vBW * 5.0)), 0.04, 1.0);')
        .replace('#include <opaque_fragment>', pbr ? WETO : '#include <opaque_fragment>');
    };
    m.customProgramCacheKey = function () { const rd = roadOf(this); return (key0 ? key0.call(this) : obc0 ? obc0.toString() : '') + '|lk' + LV + (pbrOk(this) ? 'p' : '') + (rd != null ? 'r' + rd : ''); };
    m.needsUpdate = true; st.mats = MATS.size;
    if (m.emissiveMap && m.emissiveMap === m.map && m.emissiveIntensity < 0.5 && !SIGNS.has(m)) { SIGNS.set(m, m.emissiveIntensity); signK = -1; } // 招牌：晚上加亮
  }
  function signsK(k) { if (Math.abs(k - signK) < 0.02) return; signK = k; for (const [m, b] of SIGNS) m.emissiveIntensity = b + LAMP.sign * k; }
  function unpatchAll() {
    for (const [m, b] of SIGNS) m.emissiveIntensity = b; SIGNS.clear(); signK = -1;
    for (const m of MATS) { const lk = m.userData.lk; if (lk.obc) m.onBeforeCompile = lk.obc; else delete m.onBeforeCompile; if (lk.key) m.customProgramCacheKey = lk.key; else delete m.customProgramCacheKey; delete m.userData.lk; m.needsUpdate = true; }
    MATS.clear(); st.mats = 0;
  }
  function visit(x, car) { // 一個東西：開影子、改材質（車子的材質不改：車漆另外弄）
    if (x === skyM || SEEN.has(x)) return; SEEN.add(x);
    if (x.name === 'st-shadow' && x.visible) { x.visible = false; HIDE.push(x); return; } // 村子地上畫的假影子：有真的了
    if (!x.isMesh || x.isSprite) return;
    const m0 = Array.isArray(x.material) ? x.material[0] : x.material; if (!m0 || m0.isMeshBasicMaterial || m0.transparent || m0.isShaderMaterial) return;
    if (GROUND.test(x.name) || x.name === 'ground' || x.name === 'lk-grass') GND.add(x);
    if (!x.castShadow || !x.receiveShadow) { const cast = !GROUND.test(x.name) && m0 !== grassMat; if (cast !== x.castShadow || !x.receiveShadow) { SHAD.add(x); x.castShadow = cast; x.receiveShadow = true; } }
    if (!car) for (const m of [].concat(x.material)) patchMat(m);
    else if (car === 1) for (const m of [].concat(x.material)) if (m && m.shadowSide === null && !SSIDE.has(m)) { SSIDE.add(m); m.shadowSide = THREE.DoubleSide; } // 車身是一片一片的殼（底下沒封起來）：兩面都算影子，不然只剩一圈邊
  }
  const SCAN = { stack: [], wait: 0 };
  function scanStep(n, dt) { // 新的東西（路上的車、警察、朋友、換開的車）：慢慢找
    const st2 = SCAN.stack, car = getCar(), plain = plainOf();
    if (!st2.length) { if ((SCAN.wait -= dt) > 0) return; SCAN.wait = 1.5; st2.push(scene, 0); plainMats(); }
    while (n-- > 0 && st2.length) { const isCar = st2.pop(), x = st2.pop(); const c = isCar || (x === car ? 1 : x === plain ? 2 : 0); visit(x, c); const ch = x.children; for (let i = ch.length - 1; i >= 0; i--) st2.push(ch[i], c); }
  }
  function scanAll() { SCAN.stack.length = 0; SCAN.wait = 0; plainMats(); const car = getCar(), plain = plainOf(); const go = (x, c) => { c = c || (x === car ? 1 : x === plain ? 2 : 0); visit(x, c); for (const ch of x.children) go(ch, c); }; go(scene, false); }

  // ==== 樹冠、圓滑（第一次 1、2 做；之後換來換去只改回去／改過來）====
  const TRK = []; // 樹冠縮成一點：{ A（position）, tri（三角形）, old（另外兩個頂點原本的位置） }
  const SMO = []; // 綠色的三角形變圓滑：{ N, C, idx, n0, n1, c0, c1 }
  const CELLS = new Map(); // 卡片的樹：'i,j' → { meshes: [闊葉, 松樹], pts: [[x, y, z, 地面]…] × 2, cx, cz }
  let NHT = []; // 內湖的樹（InstancedMesh）：{ m, geo, mat, hill, c }
  const GEO = new Map();
  function leafAtlas() { // 左邊一叢闊葉、中間一枝松針、右上角一小塊樹皮
    let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
    const leafCol = () => `hsl(${80 + rnd() * 30},${32 + rnd() * 22}%,${24 + rnd() * 20}%)`;
    for (let i = 0; i < 3400; i++) {
      const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * 236; if (r > 200 && rnd() < 0.6) continue;
      const x = 256 + Math.cos(a) * r, y = 256 + Math.sin(a) * r, L = 9 + rnd() * 9, W = L * (0.38 + rnd() * 0.2);
      g.save(); g.translate(x, y); g.rotate(rnd() * Math.PI * 2); g.fillStyle = leafCol(); g.beginPath(); g.ellipse(0, 0, L, W, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,220,0.10)'; g.beginPath(); g.ellipse(-L * 0.2, -W * 0.25, L * 0.6, W * 0.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    { const x0 = 520, x1 = 1000, yc = 256; g.strokeStyle = '#3a2e22'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, yc); g.lineTo(x1, yc); g.stroke();
      for (let i = 0; i < 1500; i++) { const t = rnd(), x = x0 + t * (x1 - x0), w = (1 - t * 0.85) * 210, side = rnd() < 0.5 ? -1 : 1, d = rnd() * w, y = yc + side * d, L = 14 + rnd() * 16;
        g.strokeStyle = `hsl(${120 + rnd() * 30},${25 + rnd() * 25}%,${12 + rnd() * 18}%)`; g.lineWidth = 2 + rnd() * 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L * 0.8, y + side * L * 0.5); g.stroke(); } }
    g.fillStyle = '#5a4634'; g.fillRect(1000, 0, 24, 24);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(4, R.capabilities.getMaxAnisotropy());
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.82, metalness: 0 }); m.onBeforeCompile = maskObc; m.customProgramCacheKey = () => 'lk-leaf'; return m;
  }
  const UVL = [0, 0, 0.5, 1], UVN = [0.5, 0, 0.975, 1], UVB = [0.979, 0.955, 0.998, 0.999];
  function cardGeo(kind, P) { // kind：b 闊葉、c 松樹、n 內湖（樹幹＋樹冠）、h 內湖山上的
    const key = kind + P.cards + '/' + P.cone; let g = GEO.get(key); if (g) return g;
    let sd = 7 + kind.charCodeAt(0); const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const pos = [], nor = [], uv = [], col = [], idx = [], tmp = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
    const card = (c, ax, ay, uvr, nrm, shade) => { const k = pos.length / 3, [u0, v0, u1, v1] = uvr;
      for (const [sx, sy, u, v] of [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]]) { pos.push(c[0] + ax[0] * sx + ay[0] * sy, c[1] + ax[1] * sx + ay[1] * sy, c[2] + ax[2] * sx + ay[2] * sy); nor.push(nrm[0], nrm[1], nrm[2]); uv.push(u, v); col.push(shade, shade, shade); }
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3); };
    const broad = (cy = 0, sx = 1, sy = 1) => { // 單位樹冠（半徑 1，中心 (0, cy, 0)）：很多張「一叢葉子」的卡片，法線從中間往外（光才會像一團）
      for (let i = 0; i < P.cards; i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 0.3 + 0.62 * Math.pow(rnd(), 0.45), q = Math.sqrt(1 - u * u), c = [Math.cos(a) * q * r * sx, cy + u * r * sy * 0.9, Math.sin(a) * q * r * sx];
        tmp.set(c[0] / sx, (c[1] - cy) / sy, c[2] / sx).normalize(); tmp.set(tmp.x, tmp.y * 0.8 + 0.2, tmp.z).normalize();
        tA.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); tC.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5); tB.crossVectors(tA, tC).normalize(); tA.crossVectors(tB, tA).normalize();
        const h = (0.32 + rnd() * 0.12) * Math.min(sx, 1.4) * (P.cards < 60 ? 1.5 : 1), shade = 0.72 + 0.18 * (u * 0.5 + 0.5) + 0.18 * r; // 遠的（卡片少）：每張大一點，樹冠一樣滿
        card(c, [tA.x * h, tA.y * h, tA.z * h], [tB.x * h, tB.y * h, tB.z * h], UVL, [tmp.x, tmp.y, tmp.z], shade);
      } };
    const conif = () => { // 單位松樹：底下半徑 1 在 y 0、尖在 y 1
      const tiers = P.cone < 6 ? 5 : 9;
      for (let t = 0; t < tiers; t++) { const y = 0.04 + (t / tiers) * 0.86, Rr = (1 - y) * 1.05 + 0.04, n = P.cone;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + t * 0.7 + rnd() * 0.3, dx = Math.cos(a), dz = Math.sin(a), droop = 0.22 * Rr, w = Rr * (P.cone < 6 ? 0.7 : 0.42);
          card([dx * Rr * 0.5, y - droop * 0.5, dz * Rr * 0.5], [dx * Rr * 0.5, -droop * 0.5, dz * Rr * 0.5], [-dz * w, 0.05, dx * w], UVN, [dx * 0.7, 0.7, dz * 0.7], 0.55 + 0.45 * (y * 0.7 + 0.3)); } }
      card([0, 0.55, 0], [0, 0.45, 0], [0.04, 0, 0], UVB, [0, 1, 0], 0.6); };
    const trunk = () => { card([0, 1.4, 0], [0.16, 0, 0], [0, 1.4, 0], UVB, [1, 0, 0], 0.7); card([0, 1.4, 0], [0, 0, 0.16], [0, 1.4, 0], UVB, [0, 0, 1], 0.7); };
    if (kind === 'b') broad(); else if (kind === 'c') conif(); else if (kind === 'n') { trunk(); broad(3.6, 2.3, 1.7); } else broad(2.2, 1.9, 1.6);
    g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere();
    GEO.set(key, g); return g;
  }
  function prep() { // 找樹冠（綠色、連在一起、小小一團）、算圓滑的法線；做卡片的樹（藏著）
    const T0 = performance.now();
    const meshes = [], car = getCar();
    scene.traverse((x) => {
      if (!x.isMesh || x.isInstancedMesh || x.isSkinnedMesh) return;
      for (let p = x; p; p = p.parent) if (p === car) return;
      const m0 = [].concat(x.material)[0]; if (!m0 || !m0.isMeshStandardMaterial || m0.isMeshPhysicalMaterial || !m0.vertexColors || m0.transparent) return;
      const g = x.geometry; if (g.index || !g.attributes.color || !g.attributes.normal || g.attributes.position.count < 30) return;
      meshes.push(x);
    });
    const crowns = [];
    for (const x of meshes) {
      const g = x.geometry, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, PA = P.array, NA = N.array, CA = C.array, nt = P.count / 3;
      x.updateWorldMatrix(true, false); const E = x.matrixWorld.elements, ox = E[12], oy = E[13], oz = E[14], plain = Math.abs(E[0] - 1) + Math.abs(E[5] - 1) + Math.abs(E[10] - 1) + Math.abs(E[4]) + Math.abs(E[8]) < 1e-4;
      const green = new Uint8Array(nt);
      for (let t = 0; t < nt; t++) { let ok = 1; for (let k = 0; k < 3; k++) { const i = (t * 3 + k) * 3, r = CA[i], gg = CA[i + 1], b = CA[i + 2]; if (!(gg > r && gg > b && gg - Math.min(r, b) > 0.03)) { ok = 0; break; } } green[t] = ok; }
      // 1. 樹冠：同一個位置（2 公分）連在一起的綠色三角形
      const kq = (i, s) => (Math.round(PA[i * 3] * s) + 200000) + (Math.round(PA[i * 3 + 1] * s) + 20000) * 400001 + (Math.round(PA[i * 3 + 2] * s) + 200000) * 400001 * 40001; // 數字當 key（不超過 2^53）
      const par = new Int32Array(nt); for (let t = 0; t < nt; t++) par[t] = t;
      const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
      { const first = new Map(); for (let t = 0; t < nt; t++) if (green[t]) for (let k = 0; k < 3; k++) { const kk = kq(t * 3 + k, 50), f = first.get(kk); if (f === undefined) first.set(kk, t); else { const a = find(f), b = find(t); if (a !== b) par[a] = b; } } }
      const comp = new Map();
      for (let t = 0; t < nt; t++) if (green[t]) { const r = find(t); let c = comp.get(r); if (!c) comp.set(r, (c = { n: 0, t0: t, b: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] })); c.n++; for (let k = 0; k < 3; k++) { const i = (t * 3 + k) * 3; for (let d = 0; d < 3; d++) { if (PA[i + d] < c.b[d]) c.b[d] = PA[i + d]; if (PA[i + d] > c.b[d + 3]) c.b[d + 3] = PA[i + d]; } } }
      const isCrown = new Map();
      for (const [r, c] of comp) { const dx = c.b[3] - c.b[0], dy = c.b[4] - c.b[1], dz = c.b[5] - c.b[2], w = Math.max(dx, dz), cone = dy > w * 1.15;
        if (c.n < (cone ? 6 : 16) || c.n > (cone ? 40 : 200) || w > 9 || dy > 14 || w < 0.8 || !plain) continue;
        isCrown.set(r, 1); crowns.push({ x: (c.b[0] + c.b[3]) / 2 + ox, y: (cone ? c.b[1] : (c.b[1] + c.b[4]) / 2) + oy, z: (c.b[2] + c.b[5]) / 2 + oz, rx: w / 2, ry: cone ? dy : dy / 2, cone }); }
      if (isCrown.size) { let n = 0; for (let t = 0; t < nt; t++) if (green[t] && isCrown.has(find(t))) n++;
        const tri = new Int32Array(n), old = new Float32Array(n * 6); let j = 0;
        for (let t = 0; t < nt; t++) if (green[t] && isCrown.has(find(t))) { tri[j] = t; for (let d = 0; d < 6; d++) old[j * 6 + d] = PA[t * 9 + 3 + d]; green[t] = 0; j++; }
        TRK.push({ A: P, tri, old }); }
      // 2. 圓滑：剩下的綠色三角形，同一個位置（12 公分）、方向差不到 60 度的平均法線；顏色平均
      let ns = 0; for (let t = 0; t < nt; t++) ns += green[t]; if (ns < 12) continue;
      const at = new Map(); for (let t = 0; t < nt; t++) if (green[t]) for (let k = 0; k < 3; k++) { const kk = kq(t * 3 + k, 8); const l = at.get(kk); if (l) l.push(t); else at.set(kk, [t]); }
      const idx = new Int32Array(ns * 3), n0 = new Float32Array(ns * 9), n1 = new Float32Array(ns * 9), c0 = new Float32Array(ns * 9), c1 = new Float32Array(ns * 9); let j = 0;
      for (let t = 0; t < nt; t++) if (green[t]) for (let k = 0; k < 3; k++) {
        const v = t * 3 + k, kv = kq(v, 8), l = at.get(kv), fx = NA[t * 9], fy = NA[t * 9 + 1], fz = NA[t * 9 + 2]; let sx = 0, sy = 0, sz = 0, r = 0, gg = 0, b = 0, cn = 0;
        for (const u of l) { const ux = NA[u * 9], uy = NA[u * 9 + 1], uz = NA[u * 9 + 2]; if (fx * ux + fy * uy + fz * uz > 0.5) { sx += ux; sy += uy; sz += uz; }
          for (let q = 0; q < 3; q++) { const w = u * 3 + q; if (kq(w, 8) === kv) { r += CA[w * 3]; gg += CA[w * 3 + 1]; b += CA[w * 3 + 2]; cn++; } } }
        const ll = Math.hypot(sx, sy, sz) || 1; idx[j] = v;
        for (let d = 0; d < 3; d++) { n0[j * 3 + d] = NA[v * 3 + d]; c0[j * 3 + d] = CA[v * 3 + d]; }
        n1[j * 3] = sx / ll; n1[j * 3 + 1] = sy / ll; n1[j * 3 + 2] = sz / ll; c1[j * 3] = r / cn; c1[j * 3 + 1] = gg / cn; c1[j * 3 + 2] = b / cn; j++;
      }
      SMO.push({ N, C, idx, n0, n1, c0, c1 }); st.smooth += ns;
    }
    st.crowns = crowns.length;
    // 3. 卡片的樹：200 公尺一格，闊葉、松樹各一個 InstancedMesh（看不到的格子不畫；遠的換少的卡片）
    leafMat = leafAtlas();
    let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const byCell = new Map();
    for (const c of crowns) { const k = Math.floor(c.x / CELL) + ',' + Math.floor(c.z / CELL); let L = byCell.get(k); if (!L) byCell.set(k, (L = [[], []])); L[c.cone ? 1 : 0].push(c); }
    for (const [k, L] of byCell) {
      const cell = { meshes: [null, null], pts: [[], []], cx: 0, cz: 0, n: 0 };
      for (let s = 0; s < 2; s++) { const list = L[s]; if (!list.length) continue;
        const m = new THREE.InstancedMesh(cardGeo(s ? 'c' : 'b', TREE_FAR), leafMat, list.length); m.name = 'lk-trees-' + k + (s ? 'c' : 'b'); m.visible = false; m.castShadow = true; m.receiveShadow = true;
        list.forEach((c, i) => { Q.setFromAxisAngle(UP, rnd() * Math.PI * 2); if (c.cone) M4.compose(V3.set(c.x, c.y, c.z), Q, S3.set(c.rx * 1.1, c.ry * 1.05, c.rx * 1.1)); else M4.compose(V3.set(c.x, c.y, c.z), Q, S3.set(c.rx * 1.15, c.ry * 1.25, c.rx * 1.15));
          m.setMatrixAt(i, M4); COL.setRGB(0.85 + rnd() * 0.3, 0.88 + rnd() * 0.2, 0.8 + rnd() * 0.25); m.setColorAt(i, COL);
          cell.pts[s].push(c.x, c.y, c.z, V.heightAt ? V.heightAt(c.x, c.z) : 0); cell.cx += c.x; cell.cz += c.z; cell.n++; });
        m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); scene.add(m); cell.meshes[s] = m; }
      cell.cx /= cell.n; cell.cz /= cell.n; cell.lod = 0; CELLS.set(k, cell);
    }
    st.cells = CELLS.size;
    scene.traverse((x) => { if (x.isInstancedMesh && /^nh-trees-/.test(x.name)) NHT.push({ m: x, geo: x.geometry, mat: x.material, hill: !!x.userData.hill, c: x.userData.c || [0, 0], lod: 0 }); });
    prepped = true; st.prepMs = Math.round(performance.now() - T0);
  }
  function crownsOn(on) {
    for (const r of TRK) { const PA = r.A.array, T = r.tri, O = r.old;
      for (let j = 0; j < T.length; j++) { const b = T[j] * 9; if (on) for (let d = 0; d < 6; d++) PA[b + 3 + d] = PA[b + (d % 3)]; else for (let d = 0; d < 6; d++) PA[b + 3 + d] = O[j * 6 + d]; }
      r.A.needsUpdate = true; }
    for (const s of SMO) { const NA = s.N.array, CA = s.C.array, I = s.idx, Nn = on ? s.n1 : s.n0, Cc = on ? s.c1 : s.c0;
      for (let j = 0; j < I.length; j++) for (let d = 0; d < 3; d++) { NA[I[j] * 3 + d] = Nn[j * 3 + d]; CA[I[j] * 3 + d] = Cc[j * 3 + d]; }
      s.N.needsUpdate = true; s.C.needsUpdate = true; }
    for (const c of CELLS.values()) for (const m of c.meshes) if (m) m.visible = on;
    // 內湖的樹：原本的網格沒有法線，不能跟卡片的材質一起畫（會編成 FLAT_SHADED，其他的樹也跟著用那個）→ 馬上換成卡片
    for (const t of NHT) { if (on) { t.m.geometry = cardGeo(t.hill ? 'h' : 'n', TREE_FAR); t.m.material = leafMat; t.m.castShadow = true; t.m.receiveShadow = true; t.lod = 2; } else { t.m.geometry = t.geo; t.m.material = t.mat; t.m.castShadow = t.m.receiveShadow = false; } }
    for (const c of CELLS.values()) c.lod = -1;
  }
  let lodN = 0;
  function lodStep(cam, force) { // 遠近換樹（每 10 幀看一次）
    if (!force && ++lodN % 10) return;
    const P = TREE[LV], px = cam.position.x, pz = cam.position.z;
    for (const c of CELLS.values()) { const d = Math.hypot(c.cx - px, c.cz - pz) - CELL * 0.72, want = d < TREE_NEAR ? 1 : 2; if (want === c.lod) continue; c.lod = want;
      const Pp = want === 1 ? P : TREE_FAR; if (c.meshes[0]) c.meshes[0].geometry = cardGeo('b', Pp); if (c.meshes[1]) c.meshes[1].geometry = cardGeo('c', Pp); }
    for (const t of NHT) { const want = !t.hill && Math.hypot(t.c[0] - px, t.c[1] - pz) < TREE_NEAR + 125 ? 1 : 2; if (want === t.lod) continue; t.lod = want; t.m.geometry = cardGeo(t.hill ? 'h' : 'n', want === 1 ? P : TREE_FAR); }
  }
  // crush.js：輾扁的樹，葉子卡片跟著扁（樹幹那棵 2 公尺內的；往地面壓）
  function treeK(j, k) {
    if (!prepped) return;
    if (!j.lk) { j.lk = [];
      for (const g of j.grp) { if (g.t !== 'circle') continue;
        for (const c of CELLS.values()) { if (Math.abs(c.cx - g.x) > CELL * 1.5 || Math.abs(c.cz - g.z) > CELL * 1.5) continue;
          for (let s = 0; s < 2; s++) { const m = c.meshes[s], p = c.pts[s]; if (!m) continue;
            for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - g.x) < 2 && Math.abs(p[i + 2] - g.z) < 2) { const e = m.instanceMatrix.array.slice((i / 4) * 16, (i / 4) * 16 + 16); j.lk.push({ m, i: i / 4, e, gy: p[i + 3] }); } } } } }
    for (const q of j.lk) { const A = q.m.instanceMatrix, E = A.array, o16 = q.i * 16, e = q.e, kk = Math.max(k, 0.04), w = 1 + (1 - kk) * 0.35;
      for (let r = 0; r < 12; r++) E[o16 + r] = e[r] * (r < 3 || (r >= 8 && r < 11) ? w : r >= 4 && r < 7 ? kk : 1);
      E[o16 + 12] = e[12]; E[o16 + 13] = q.gy + (e[13] - q.gy) * kk; E[o16 + 14] = e[14]; E[o16 + 15] = e[15]; A.needsUpdate = true; }
    if (k >= 1) j.lk = null;
  }

  // ==== 5 號：材質貼圖（程式畫的柏油碎石、草、水泥：顏色＋凹凸；512 見方，分幾幀畫）====
  async function makeTex() {
    const N = 512, T0 = performance.now(); let tq = performance.now();
    const breath = async () => { if (performance.now() - tq > 12) { await new Promise((r) => setTimeout(r, 0)); tq = performance.now(); } };
    const hsh = (i, j, s) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const md = (a, p) => ((a % p) + p) % p;
    const vn = (x, y, p, s) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = hsh(md(i, p), md(j, p), s), b = hsh(md(i + 1, p), md(j, p), s), c = hsh(md(i, p), md(j + 1, p), s), d = hsh(md(i + 1, p), md(j + 1, p), s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    const fbm = (u, v, p0, oct, s) => { let t = 0, a = 0.5, w = 0; for (let k = 0; k < oct; k++) { const p = p0 << k; t += a * vn(u * p, v * p, p, s + k * 17); w += a; a *= 0.5; } return t / w; };
    const WOR = [0, 0];
    const wor = (u, v, p, s) => { const X = u * p, Y = v * p, i0 = Math.floor(X), j0 = Math.floor(Y); let d1 = 9, id = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = i0 + di, j = j0 + dj, ii = md(i, p), jj = md(j, p), d = Math.hypot(X - i - hsh(ii, jj, s), Y - j - hsh(ii, jj, s + 1)); if (d < d1) { d1 = d; id = hsh(ii, jj, s + 2); } }
      WOR[0] = d1; WOR[1] = id; return WOR; };
    const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const tx = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = R.capabilities.getMaxAnisotropy(); t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; };
    // 一張：fill(C, H, y) 一行一行填顏色、高度 → 顏色每個頻道除以平均（乘在原本的顏色上，不改色調）＋法線
    const make = async (fill, bump) => {
      const C = new Float32Array(N * N * 3), H = new Float32Array(N * N), m = [0, 0, 0];
      for (let y = 0; y < N; y++) { fill(C, H, y); await breath(); }
      for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) m[k] += C[i * 3 + k] / (N * N);
      const cvA = document.createElement('canvas'), cvN = document.createElement('canvas'); cvA.width = cvA.height = cvN.width = cvN.height = N;
      const ia = new ImageData(N, N), inn = new ImageData(N, N);
      for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) { const i = y * N + x;
        for (let k = 0; k < 3; k++) ia.data[i * 4 + k] = clamp(Math.round((C[i * 3 + k] / m[k]) * 0.5 * 255), 0, 255); ia.data[i * 4 + 3] = 255;
        const hx = H[y * N + md(x + 1, N)] - H[y * N + md(x - 1, N)], hy = H[md(y + 1, N) * N + x] - H[md(y - 1, N) * N + x];
        let nx = -hx * bump, ny = -hy * bump, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        inn.data[i * 4] = Math.round((nx * 0.5 + 0.5) * 255); inn.data[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255); inn.data[i * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255); inn.data[i * 4 + 3] = 255; }
        if ((y & 31) === 31) await breath(); }
      cvA.getContext('2d').putImageData(ia, 0, 0); cvN.getContext('2d').putImageData(inn, 0, 0);
      return [tx(cvA), tx(cvN)];
    };
    // 柏油：一顆一顆的碎石（亮暗不一樣）＋黑色的瀝青＋大塊的深淺
    const [asA, asN] = await make((C, H, y) => { for (let x = 0; x < N; x++) { const u = x / N, v = y / N, i = y * N + x;
      const w1 = wor(u, v, 150, 11), f = w1[0], id = w1[1], w2 = wor(u, v, 330, 21), f2 = w2[0], id2 = w2[1], s1 = id > 0.25 ? 1 - ss(0.26, 0.42, f) : 0, s2 = id2 > 0.5 ? 1 - ss(0.2, 0.36, f2) : 0;
      const fine = fbm(u, v, 96, 2, 5), big = fbm(u, v, 3, 3, 9);
      const L = Math.max(0.03, 0.2 + 0.06 * fine + s1 * (0.07 + 0.16 * (id - 0.25)) + s2 * 0.07 * (id2 - 0.3) + (big - 0.5) * 0.08), w = (id - 0.5) * 0.04 * s1;
      C[i * 3] = L * (1 + w); C[i * 3 + 1] = L; C[i * 3 + 2] = L * (1 - w + 0.02); H[i] = s1 * (0.6 + 0.4 * id) + s2 * 0.4 + 0.25 * fine; } }, 1.6 * 0.5);
    // 草：很多短短的草葉（各種方向、黃綠深綠，下面深上面亮），下面一點泥土；自己一點一點畫進陣列（canvas 畫 4 萬條線手機要好幾秒）
    const tA = performance.now(), SR = new Float32Array(N * N * 3);
    { let sd = 99; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), S = N / 1024;
      const hsl = (h, sa, l, o, k) => { h = ((h % 360) + 360) % 360 / 60; sa /= 100; l /= 100; const c = (1 - Math.abs(2 * l - 1)) * sa, x = c * (1 - Math.abs((h % 2) - 1)), m = l - c / 2;
        const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]; o[k] = r + m; o[k + 1] = g + m; o[k + 2] = b + m; };
      const put = (x, y, r, g, b, a) => { const i = md(x, N) + md(y, N) * N; if (a >= 1) { SR[i * 3] = r; SR[i * 3 + 1] = g; SR[i * 3 + 2] = b; return; } SR[i * 3] += (r - SR[i * 3]) * a; SR[i * 3 + 1] += (g - SR[i * 3 + 1]) * a; SR[i * 3 + 2] += (b - SR[i * 3 + 2]) * a; };
      const splat = (x, y, r, g, b, a) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; put(i, j, r, g, b, a * (1 - fx) * (1 - fy)); put(i + 1, j, r, g, b, a * fx * (1 - fy)); put(i, j + 1, r, g, b, a * (1 - fx) * fy); put(i + 1, j + 1, r, g, b, a * fx * fy); };
      for (let i = 0; i < N * N; i++) { SR[i * 3] = 0x3f / 255; SR[i * 3 + 1] = 0x4a / 255; SR[i * 3 + 2] = 0x26 / 255; }
      for (let i = 0; i < 2600; i++) { const r = (90 + rnd() * 40) / 255, g = (70 + rnd() * 30) / 255, b = (40 + rnd() * 20) / 255, x = rnd() * N, y = rnd() * N, rr = (1 + rnd() * 4) * S;
        for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) { const a = clamp(rr + 0.5 - Math.hypot(dx + 0.5 - (x % 1), dy + 0.5 - (y % 1)), 0, 1) * 0.5; if (a > 0) put(Math.floor(x) + dx, Math.floor(y) + dy, r, g, b, a); } }
      const NB = 42000, c0 = [0, 0, 0], c1 = [0, 0, 0];
      for (let i = 0; i < NB; i++) { const x = rnd() * N, y = rnd() * N, a = rnd() * 6.283, L = (7 + rnd() * 16) * S, w = Math.max(0.8, (1.2 + rnd() * 1.8) * S), h = 62 + rnd() * 48, sa = 30 + rnd() * 35, l = 14 + rnd() * 34 + (i / NB) * 12;
        const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L, bx = x + Math.cos(a + 0.5) * L * 0.5, by = y + Math.sin(a + 0.5) * L * 0.5;
        hsl(h, sa, l * 0.6, c0, 0); hsl(h - 6, sa + 8, l * 1.15, c1, 0);
        const n = Math.ceil(L * 2), side = (w - 1) * 0.5, nx = -Math.sin(a), ny = Math.cos(a);
        for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t, px = u * u * x + 2 * u * t * bx + t * t * ex, py = u * u * y + 2 * u * t * by + t * t * ey;
          const r = c0[0] + (c1[0] - c0[0]) * t, g = c0[1] + (c1[1] - c0[1]) * t, b = c0[2] + (c1[2] - c0[2]) * t;
          if (side > 0.05) { splat(px + nx * side, py + ny * side, r, g, b, 0.85); splat(px - nx * side, py - ny * side, r, g, b, 0.85); } else splat(px, py, r, g, b, Math.min(1, w) * 0.95); }
        if ((i & 4095) === 4095) await breath(); } }
    const tB = performance.now();
    const [grA, grN] = await make((C, H, y) => { for (let x = 0; x < N; x++) { const i = y * N + x, r = clamp(SR[i * 3], 0, 1), gg = clamp(SR[i * 3 + 1], 0, 1), b = clamp(SR[i * 3 + 2], 0, 1); C[i * 3] = Math.pow(r, 2.2); C[i * 3 + 1] = Math.pow(gg, 2.2); C[i * 3 + 2] = Math.pow(b, 2.2); H[i] = (r * 0.3 + gg * 0.6 + b * 0.1) * 1.6; } }, 2.2 * 0.5);
    const tC = performance.now();
    // 水泥：細細的砂＋一塊一塊的污漬＋小洞
    const [coA, coN] = await make((C, H, y) => { for (let x = 0; x < N; x++) { const u = x / N, v = y / N, i = y * N + x;
      const fine = fbm(u, v, 128, 2, 31), mid = fbm(u, v, 16, 3, 41), big = fbm(u, v, 2, 3, 51), w1 = wor(u, v, 200, 61), pore = w1[1] > 0.85 ? 1 - ss(0.08, 0.2, w1[0]) : 0;
      const L = Math.max(0.05, 0.5 + 0.08 * (fine - 0.5) + 0.07 * (mid - 0.5) + 0.12 * (big - 0.5) - 0.25 * pore); C[i * 3] = L * 1.01; C[i * 3 + 1] = L; C[i * 3 + 2] = L * 0.97; H[i] = 0.3 * fine + 0.1 * mid - 0.5 * pore; } }, 1.2 * 0.5);
    TEX = { asA, asN, grA, grN, coA, coN }; st.texMs = Math.round(performance.now() - T0); st.texParts = [tA - T0, tB - tA, tC - tB, performance.now() - tC].map(Math.round);
  }

  // ==== 5 號：草地上一叢一叢的草（鏡頭附近 7×7 格；遠的在 shader 裡變小，跟草地貼圖接起來）====
  let GR = null;
  function makeGrass() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d'); let sd = 5; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 140; i++) { const x = 8 + rnd() * 240, h = 120 + rnd() * 130, lean = (rnd() - 0.5) * 70, w = 2.5 + rnd() * 3, l = 30 + rnd() * 20;
      const gr = g.createLinearGradient(0, 256, 0, 256 - h); gr.addColorStop(0, `hsl(${76 + rnd() * 14},38%,${l * 0.62}%)`); gr.addColorStop(1, `hsl(${66 + rnd() * 22},${34 + rnd() * 20}%,${l * 0.95}%)`); g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - w, 256); g.quadraticCurveTo(x + lean * 0.3, 256 - h * 0.6, x + lean, 256 - h); g.quadraticCurveTo(x + lean * 0.3 + w * 0.4, 256 - h * 0.6, x + w, 256); g.closePath(); g.fill(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(4, R.capabilities.getMaxAnisotropy());
    grassMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true });
    grassMat.onBeforeCompile = (sh) => { maskObc(sh); sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        { float gd = distance(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), cameraPosition.xz); transformed *= 1.0 - 0.85 * clamp((gd - 22.0) / 26.0, 0.0, 1.0); }
      #endif`); };
    grassMat.customProgramCacheKey = () => 'lk-grass';
    const pos = [], nor = [], uv = [], col = [], idx = [];
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI, cx = Math.cos(a) * 0.32, cz = Math.sin(a) * 0.32, b = pos.length / 3;
      for (const [sx, sy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { pos.push(cx * sx * 0.8, sy * 0.34, cz * sx * 0.8); nor.push(0, 1, 0); uv.push(sx * 0.5 + 0.5, sy); const sh = 0.8 + 0.2 * sy; col.push(sh, sh, sh); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const MAX = GN * GN * GPER, im = new THREE.InstancedMesh(geo, grassMat, MAX); im.name = 'lk-grass'; im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false; im.visible = false;
    M4.makeScale(0, 0, 0); for (let i = 0; i < MAX; i++) im.setMatrixAt(i, M4); im.setColorAt(0, COL.setRGB(1, 1, 1)); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    // 擋路的東西（樹幹、柱子、牆）：32 公尺一格先分好（每叢草只看那一格）
    const cg = new Map(); for (const c of V.colliders || []) { const r = c.t === 'circle' ? c.r : Math.hypot(c.hx, c.hz); if (r > 30) continue; for (let i = Math.floor((c.x - r) / 32); i <= Math.floor((c.x + r) / 32); i++) for (let j = Math.floor((c.z - r) / 32); j <= Math.floor((c.z + r) / 32); j++) { const k = i * 100003 + j; let L = cg.get(k); if (!L) cg.set(k, (L = [])); L.push(c); } }
    GR = { im, cg, slot: new Map(), want: [], wi: 0, ci: 1e9, cj: 1e9, R: [], RC: [] };
    for (let s = 0; s < GN * GN; s++) { GR.R.push({ start: 0, count: 0 }); GR.RC.push({ start: 0, count: 0 }); }
  }
  const upd = (A, Rr, start, count) => { if (A.updateRanges.indexOf(Rr) < 0) { Rr.start = start; Rr.count = count; A.updateRanges.push(Rr); } A.needsUpdate = true; };
  function grassCell(ci, cj) { // 一格：撒草（同一格每次都一樣）
    const s = (((ci % GN) + GN) % GN) * GN + (((cj % GN) + GN) % GN), A = GR.im.instanceMatrix, CA = GR.im.instanceColor, base = s * GPER;
    let sd = ((Math.imul(ci, 73856093) ^ Math.imul(cj, 19349663)) >>> 0) % 2147483646 + 1; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    let n = 0;
    for (let t = 0; t < GPER * 1.4 && n < GPER; t++) {
      const x = (ci + rnd()) * GC, z = (cj + rnd()) * GC, sc = 0.7 + rnd() * 0.6, sy = 0.7 + rnd() * 0.6, rot = rnd() * Math.PI, cr = rnd(), cgg = rnd(), cb = rnd();
      if (V.surfaceAt(x, z) !== 1) continue;
      const L = GR.cg.get(Math.floor(x / 32) * 100003 + Math.floor(z / 32)); let hit = false;
      if (L) for (const c of L) { if (c.t === 'circle') { if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < (c.r + 0.3) * (c.r + 0.3)) { hit = true; break; } } else { const co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0), dx = x - c.x, dz = z - c.z, u = dx * co - dz * si, w = dx * si + dz * co; if (Math.abs(u) < c.hx + 0.3 && Math.abs(w) < c.hz + 0.3) { hit = true; break; } } }
      if (hit) continue;
      Q.setFromAxisAngle(UP, rot); M4.compose(V3.set(x, (V.heightAt ? V.heightAt(x, z) : 0) - 0.03, z), Q, S3.set(sc, sc * sy, sc)); M4.toArray(A.array, (base + n) * 16);
      CA.array[(base + n) * 3] = 0.9 + cr * 0.25; CA.array[(base + n) * 3 + 1] = 0.92 + cgg * 0.2; CA.array[(base + n) * 3 + 2] = 0.8 + cb * 0.2; n++;
    }
    for (let i = n; i < GPER; i++) { const o16 = (base + i) * 16; for (let k = 0; k < 16; k++) A.array[o16 + k] = 0; }
    upd(A, GR.R[s], base * 16, GPER * 16); upd(CA, GR.RC[s], base * 3, GPER * 3); // 只上傳這一格（three.js 合併範圍的時候會改 start、count：每次重新放）
    GR.slot.set(s, ci * 100003 + cj); return n;
  }
  function grassStep(cam) { // 鏡頭換格：要的格子排隊，每幀最多做 2 格
    const ci = Math.floor(cam.position.x / GC), cj = Math.floor(cam.position.z / GC), h = GN >> 1;
    if (ci !== GR.ci || cj !== GR.cj) { GR.ci = ci; GR.cj = cj; GR.want.length = 0;
      for (let di = -h; di <= h; di++) for (let dj = -h; dj <= h; dj++) { const i = ci + di, j = cj + dj, s = (((i % GN) + GN) % GN) * GN + (((j % GN) + GN) % GN); if (GR.slot.get(s) !== i * 100003 + j) GR.want.push(i, j, Math.abs(di) + Math.abs(dj)); }
      for (let a = 0; a < GR.want.length; a += 3) for (let b = a + 3; b < GR.want.length; b += 3) if (GR.want[b + 2] < GR.want[a + 2]) for (let k = 0; k < 3; k++) { const t = GR.want[a + k]; GR.want[a + k] = GR.want[b + k]; GR.want[b + k] = t; } // 近的先
      GR.wi = 0; }
    for (let k = 0; k < 2 && GR.wi < GR.want.length; k++, GR.wi += 3) st.grass = grassCell(GR.want[GR.wi], GR.want[GR.wi + 1]);
  }
  function grassReset() { if (!GR) return; GR.slot.clear(); GR.ci = GR.cj = 1e9; }

  // ==== 第 30 批：晚上的燈（路燈最近 4 支＋自己的車的大燈；漂亮、最真實都有；白天亮度 0，一直留在場景裡，shader 不用重編）====
  let PL = null, HLT = null, lampPts = null, lampKs = null, headCar = null, headDims = null, lampN = 0; const HEAD = [new THREE.Vector3(), new THREE.Vector3()], HTGT = [new THREE.Vector3(), new THREE.Vector3()];
  function lampList() { // 所有路燈的燈頭：村子的電線桿（有路燈的）、快速道路（中間護欄上 60 公尺一支、兩邊）、大停車場 5 支；第 32 批：每支多一個亮度倍數（快速道路、停車場的燈頭高，光要強一點才照得到路）
    const P = [], K = [];
    for (const p of V.poles || []) if (p.lamp) { P.push(p.x + p.fx * 2.2, 7.6, p.z + p.fz * 2.2); K.push(1); }
    const H = V.highway; if (H && H.center && H.center.length > 1) { const C = H.center; let s = 0, next = 30; for (let i = 1; i < C.length; i++) { const dx = C[i][0] - C[i - 1][0], dz = C[i][1] - C[i - 1][1], L = Math.hypot(dx, dz); if (L < 1e-6) continue;
      while (next <= s + L && next <= H.len - 25) { const t = (next - s) / L, x = C[i - 1][0] + dx * t, z = C[i - 1][1] + dz * t, nx = -dz / L, nz = dx / L; if (!(V.hills && V.hills.inTunnel && V.hills.inTunnel(x, z, 3))) { P.push(x + nx * 2.65, 11.0, z + nz * 2.65, x - nx * 2.65, 11.0, z - nz * 2.65); K.push(NSKY.hwK, NSKY.hwK); } next += 60; } s += L; } }
    const Kp = V.parking; if (Kp) { const X0 = Kp.x - Kp.hx, X1 = Kp.x + Kp.hx, Z0 = Kp.z - Kp.hz, Z1 = Kp.z + Kp.hz, zm = (Z0 + Z1) / 2; for (const [x, z] of [[X0 + 17.1, Z0 + 1.5], [X0 + 17.1, zm], [X0 + 17.1, Z1 - 1.5], [X0 + 2.2, zm], [X1 - 2.2, zm]]) { P.push(x, 6.3, z); K.push(NSKY.parkK); } }
    lampKs = new Float32Array(K);
    return new Float32Array(P);
  }
  function lampsOn() {
    if (PL) return;
    // 第 37 批（漂亮省一點）：每一盞燈每個東西都要多算一次（亮度 0 也算）：漂亮＝路燈最近 2 支、大燈一盞在車頭中間（最真實 4 支、左右兩盞）、警車的紅藍燈沒有（nightOn）
    const low = LV === 1;
    PL = []; for (let i = 0; i < (low ? LAMP.nLow : LAMP.n); i++) { const l = new THREE.PointLight(LAMP.c, 0, LAMP.dist, 2); l.name = 'lk-lamp'; l.position.set(0, -100, 0); scene.add(l); PL.push(l); }
    HLT = []; for (let i = 0; i < (low ? 1 : 2); i++) { const l = new THREE.SpotLight(LAMP.headC, 0, LAMP.headDist, LAMP.headAng, 0.7, LAMP.headDecay); l.name = 'lk-head'; l.position.set(0, -100, 0); scene.add(l); scene.add(l.target); HLT.push(l); }
    if (!lampPts) lampPts = lampList(); headCar = null; lampN = 0;
    nightOn(); // 第 32 批
  }
  function lampsOff() { if (!PL) return; for (const l of PL) l.removeFromParent(); for (const l of HLT) { l.target.removeFromParent(); l.removeFromParent(); } PL = HLT = null; headCar = null; nightOff(); }
  const lampPos = new THREE.Vector3(1e9, 0, 0);
  function lampStep(cam) {
    if (!PL) return; const k = TD.lamp;
    if (k > 0.001 && (lampN++ % 10 === 0 || cam.position.distanceToSquared(lampPos) > 36)) { lampPos.copy(cam.position); // 鏡頭前面 12 公尺附近最近的 4 支（每 10 格，鏡頭跳了 6 公尺以上馬上算）
      cam.getWorldDirection(V3b); const px = cam.position.x + V3b.x * 12, pz = cam.position.z + V3b.z * 12, P = lampPts, best = [1e18, 1e18, 1e18, 1e18], bi = [-1, -1, -1, -1];
      for (let i = 0; i < P.length; i += 3) { const d = (P[i] - px) * (P[i] - px) + (P[i + 2] - pz) * (P[i + 2] - pz); if (d >= best[3]) continue; let j = 3; while (j > 0 && best[j - 1] > d) { best[j] = best[j - 1]; bi[j] = bi[j - 1]; j--; } best[j] = d; bi[j] = i; }
      for (let j = 0; j < PL.length; j++) { const l = PL[j], i = bi[j]; if (i < 0 || best[j] > LAMP.fade1 * LAMP.fade1) { l.intensity = 0; continue; } l.position.set(P[i], P[i + 1] - 0.3, P[i + 2]); l.intensity = LAMP.I * lampKs[i / 3] * k * (1 - ss(LAMP.fade0, LAMP.fade1, Math.hypot(P[i] - cam.position.x, P[i + 2] - cam.position.z))); } // 第 31 批：離鏡頭遠的慢慢暗（換支不跳）；第 32 批：每支自己的倍數
    } else if (k <= 0.001) for (const l of PL) l.intensity = 0;
    const car = getCar();
    if (car !== headCar) { headCar = car; headDims = car ? carDims(car) : null; }
    if (car && headDims && k > 0.001) { const D = headDims, xf = D.cx + D.hx - 0.15; car.updateMatrixWorld();
      for (let i = 0; i < HLT.length; i++) { const sz = HLT.length < 2 ? 0 : (i ? -1 : 1) * D.hz * 0.62, l = HLT[i]; HEAD[i].set(xf, 0.62, sz).applyMatrix4(car.matrixWorld); HTGT[i].set(xf + LAMP.headAim, -0.3, sz * 1.6).applyMatrix4(car.matrixWorld); // 漂亮：一盞在中間
        l.position.copy(HEAD[i]); l.target.position.copy(HTGT[i]); l.target.updateMatrixWorld(); l.intensity = LAMP.headI * k; }
      if (NS) { const bm = NS.beam; bm.position.set(xf, 0.06, 0).applyMatrix4(car.matrixWorld); car.getWorldQuaternion(bm.quaternion); bm.material.opacity = NSKY.beamI * k; if (!bm.visible) bm.visible = true; } } // 第 34 批：路上的長光斑跟著車頭
    else { for (const l of HLT) l.intensity = 0; if (NS && NS.beam.visible) NS.beam.visible = false; }
    nightStep(cam, k);
    signsK(k);
    if (Math.abs(k - lampSent) > 0.02 || (k === 0) !== (lampSent === 0)) { lampSent = k; nightCb(k); }
  }

  // ==== 第 32 批：晚上的天空和燈：星星（跟著鏡頭的點）、月亮的圓盤（光本來就是月亮：方向一樣）、透天厝一樓的窗戶和店面（加亮的面，蓋在原本的窗戶上）、警車的紅藍燈（最近一台、一顆燈換顏色）、路上車子的大燈照在路上（加亮的橢圓，最近 12 台）；白天透明度 0，都留在場景裡 ====
  let NS = null; const MD = new THREE.Vector3(), POOLC = []; const policeOf = o.police || (() => null), trafficOf = o.traffic || (() => null);
  function nightOn() {
    if (NS) return;
    let sd = 20261024; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    // 星星
    const n = NSKY.stars, sp = new Float32Array(n * 3), sc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { let x, y, z; do { x = rnd() * 2 - 1; y = rnd(); z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1 || y < 0.06); const L = Math.hypot(x, y, z) / NSKY.starR; sp[i * 3] = x / L; sp[i * 3 + 1] = y / L; sp[i * 3 + 2] = z / L;
      const b = 0.35 + rnd() * rnd() * 1.1, t = rnd(); sc[i * 3] = b * (t < 0.2 ? 1.0 : 0.85); sc[i * 3 + 1] = b * 0.9; sc[i * 3 + 2] = b * (t < 0.2 ? 0.75 : 1.0); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: NSKY.starSz, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
    stars.name = 'lk-stars'; stars.frustumCulled = false; stars.renderOrder = -999; stars.matrixAutoUpdate = false;
    stars.onBeforeRender = (r, s2, c) => { const e = c.matrixWorld.elements; stars.matrixWorld.makeTranslation(e[12], e[13], e[14]); };
    // 月亮
    const moon = new THREE.Mesh(new THREE.CircleGeometry(NSKY.moonR, 24), new THREE.MeshBasicMaterial({ color: NSKY.moonC, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
    moon.name = 'lk-moon'; moon.frustumCulled = false; moon.renderOrder = -998; moon.matrixAutoUpdate = false; dirOf(MD, MOON.elev, MOON.az);
    moon.onBeforeRender = (r, s2, c) => { V3b.setFromMatrixPosition(c.matrixWorld); V3.copy(V3b).addScaledVector(MD, NSKY.moonD); M4.lookAt(V3b, V3, UP); moon.matrixWorld.copy(M4).setPosition(V3); };
    // 透天厝的窗戶、店面（village.js 的 houses：一樓 kind 'door' 兩邊的窗、'shop' 的店面；鐵捲門的沒有燈）
    const wp = [], wc = [], wi = []; let lit = 0;
    const quad = (h, x0, x1, y0, y1, col) => { const c = Math.cos(h.ry), sn = Math.sin(h.ry), z = 0.06, b = wp.length / 3;
      for (const [lx, ly] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { wp.push(h.x + lx * c + z * sn, ly, h.z - lx * sn + z * c); wc.push(col[0], col[1], col[2]); }
      wi.push(b, b + 1, b + 2, b, b + 2, b + 3); lit++; };
    for (const h of V.houses || []) { const r = rnd(), w = h.w;
      if (h.kind === 'shop') { if (r < NSKY.shopP) quad(h, -w / 2 + 0.2, w / 2 - 0.2, 0.1, 2.7, NSKY.shopC); }
      else if (h.kind === 'door' && w >= 4.6 && r < NSKY.winP) { const warm = 0.85 + rnd() * 0.3, col = [NSKY.winC[0] * warm, NSKY.winC[1] * warm, NSKY.winC[2] * (1.3 - warm * 0.3)]; quad(h, -w / 2 + 0.35, -1.05, 0.9, 2.4, col); if (rnd() < 0.75) quad(h, 1.05, w / 2 - 0.35, 0.9, 2.4, col); } }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3)); wg.setIndex(wi);
    const win = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); win.name = 'lk-win'; win.visible = false;
    // 警車的紅藍燈：一顆燈，0.8 秒紅藍換
    const pol = LV === 1 ? null : new THREE.PointLight(0xff2a1a, 0, NSKY.polD, 2); if (pol) { pol.name = 'lk-pol'; pol.position.set(0, -100, 0); } // 第 37 批：漂亮沒有（車頂的燈本來就會閃）
    // 大燈照在路上：橢圓的光斑（貼圖畫一次）
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(22, 64, 0, 22, 64, 104);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const pt = new THREE.CanvasTexture(cv); pt.colorSpace = THREE.SRGBColorSpace;
    const pg = new THREE.PlaneGeometry(NSKY.poolL, NSKY.poolW); pg.rotateX(-Math.PI / 2); pg.translate(NSKY.poolL / 2, 0, 0);
    const pool = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ map: pt, color: LAMP.headC, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NSKY.poolN);
    pool.name = 'lk-pool'; pool.frustumCulled = false; pool.count = 0; pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pool.visible = false; pool.renderOrder = 3;
    // 第 34 批：自己的車的大燈照在路上（Nick「晚上車燈可以照遠一點嗎 不然看不清楚路」）：SpotLight 打在路面是掠射（0.6 公尺高照 30 公尺外＝1 度），Lambert 幾乎是 0，再亮也只照亮樹和護欄；
    // 所以路面用一片加亮的長光斑（車頭前面 0–70 公尺、越遠越寬越淡；貼圖算一次），跟著車（含坡度）；SpotLight 留著照前面的東西
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 64; const bg = bc.getContext('2d'), im = bg.createImageData(256, 64), px = im.data;
    for (let j = 0; j < 64; j++) for (let i = 0; i < 256; i++) { const u = (i + 0.5) / 256, v = ((j + 0.5) / 64) * 2 - 1, hw = 0.32 + 0.68 * u, lat = Math.exp(-(v / hw) * (v / hw) * 2.0), lon = Math.pow(1 - u, 1.6) * (1 - Math.exp(-u * 40)), a = Math.max(0, Math.min(1, lat * lon * 1.15)); const o = (j * 256 + i) * 4; px[o] = px[o + 1] = px[o + 2] = 255; px[o + 3] = Math.round(a * 255); }
    bg.putImageData(im, 0, 0); const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
    const bgm = new THREE.PlaneGeometry(NSKY.beamL, NSKY.beamW); bgm.rotateX(-Math.PI / 2); bgm.translate(NSKY.beamL / 2, 0, 0);
    const beam = new THREE.Mesh(bgm, new THREE.MeshBasicMaterial({ map: bt, color: LAMP.headC, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    beam.name = 'lk-beam'; beam.frustumCulled = false; beam.visible = false; beam.renderOrder = 3;
    scene.add(stars, moon, win, pool, beam); if (pol) scene.add(pol);
    NS = { stars, moon, win, pol, pool, beam, lit, polCar: null, polD: 1e9, pools: 0 };
  }
  function nightOff() { if (!NS) return; for (const k of ['stars', 'moon', 'win', 'pol', 'pool', 'beam']) { const x = NS[k]; if (!x) continue; x.removeFromParent(); x.geometry?.dispose(); if (x.material) { x.material.map?.dispose(); x.material.dispose(); } } NS = null; }
  function nightStep(cam, k) {
    if (!NS) return;
    const nk = TD.night * TD.night * (1 - cave); NS.stars.material.opacity = nk; NS.moon.material.opacity = TD.moon * (1 - cave); // 隧道、塔裡面看不到天
    NS.win.material.opacity = k; if (NS.win.visible !== (k > 0.001 && NS.lit > 0)) NS.win.visible = k > 0.001 && NS.lit > 0;
    // 警車：最近的、燈在閃的那台
    const PC = k > 0.001 ? policeOf() : null; let best = 70 * 70, bc = null;
    if (PC) for (let i = 0; i < PC.length; i++) { const c = PC[i]; if (!c.lights || c.x > 1e5) continue; const d = (c.x - cam.position.x) * (c.x - cam.position.x) + (c.z - cam.position.z) * (c.z - cam.position.z); if (d < best) { best = d; bc = c; } }
    NS.polCar = bc; NS.polD = bc ? Math.sqrt(best) : 1e9;
    if (bc && NS.pol) { const ph = ((performance.now() / 1000) % NSKY.polT) / NSKY.polT, red = ph < 0.5, h = bc.heading, side = red ? 0.45 : -0.45, gy = V.heightAt ? V.heightAt(bc.x, bc.z) : 0;
      NS.pol.color.setHex(red ? 0xff2a1a : 0x2a60ff); NS.pol.position.set(bc.x + Math.sin(h) * side, gy + 2.0, bc.z + Math.cos(h) * side); NS.pol.intensity = NSKY.polI * k * (1 - ss(45, 70, NS.polD)); }
    else if (NS.pol) NS.pol.intensity = 0;
    // 路上車子的大燈：最近 12 台（路上的車、警車）車頭前面的光斑
    const pool = NS.pool; let n = 0;
    if (k > 0.001) { const L = POOLC; L.length = 0; const cx = cam.position.x, cz = cam.position.z, R2 = 110 * 110;
      const TC = trafficOf(); if (TC) for (let i = 0; i < TC.length; i++) { const c = TC[i]; if (!c.active || c.kind !== 'car' || c.crushed) continue; const d = (c.x - cx) * (c.x - cx) + (c.z - cz) * (c.z - cz); if (d < R2) L.push(d, c); }
      if (PC) for (let i = 0; i < PC.length; i++) { const c = PC[i]; if (c.x > 1e5) continue; const d = (c.x - cx) * (c.x - cx) + (c.z - cz) * (c.z - cz); if (d < R2) L.push(d, c); }
      const m = L.length / 2; // 近的先（選擇排序：最多 12 個）
      for (let a = 0; a < m && a < NSKY.poolN; a++) { let bi = a; for (let b = a + 1; b < m; b++) if (L[b * 2] < L[bi * 2]) bi = b; if (bi !== a) { const d0 = L[a * 2], c0 = L[a * 2 + 1]; L[a * 2] = L[bi * 2]; L[a * 2 + 1] = L[bi * 2 + 1]; L[bi * 2] = d0; L[bi * 2 + 1] = c0; }
        const c = L[a * 2 + 1], h = c.heading, fx = Math.cos(h), fz = -Math.sin(h), hx = c.hx || 2.2, x = c.x + fx * (hx + 0.3), z = c.z + fz * (hx + 0.3), gy = V.heightAt ? V.heightAt(x, z) : 0;
        Q.setFromAxisAngle(UP, h); M4.compose(V3.set(x, gy + 0.05, z), Q, S3.set(1, 1, 1)); pool.setMatrixAt(n++, M4); }
      if (n) pool.instanceMatrix.needsUpdate = true; }
    pool.count = n; NS.pools = n; pool.material.opacity = NSKY.poolI * k; if (pool.visible !== n > 0) pool.visible = n > 0;
  }

  // ==== 第 30 批：濕的路的倒影（最真實、燈亮的時候）：把世界從路面倒過來再畫一次到半張大小的圖（地上的東西不畫、鏡頭在路面下面、路面以上才畫）====
  const WR = { rt: null, cam: new THREE.PerspectiveCamera(), hid: [], n: new THREE.Vector3(0, 1, 0), P0: new THREE.Vector3(), cp: new THREE.Vector3(), rot: new THREE.Matrix4(), view: new THREE.Vector3(), look: new THREE.Vector3(), tgt: new THREE.Vector3(), pl: new THREE.Plane(), cpl: new THREE.Vector4(), q: new THREE.Vector4(), w: 0, h: 0 };
  function wetRender(cam) {
    const W = WR; R.getDrawingBufferSize(SZ); const w = Math.max(64, (SZ.x | 0) >> 1), h = Math.max(64, (SZ.y | 0) >> 1);
    if (!W.rt || W.w !== w || W.h !== h) { if (W.rt) W.rt.dispose(); W.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter }); W.w = w; W.h = h; }
    const rc = W.cam, n = W.n, yp = V.heightAt ? V.heightAt(cam.position.x, cam.position.z) : 0; W.P0.set(0, yp, 0); WU.wetY.value = yp;
    W.cp.setFromMatrixPosition(cam.matrixWorld); W.rot.extractRotation(cam.matrixWorld);
    W.view.subVectors(W.P0, W.cp).reflect(n).negate().add(W.P0);
    W.look.set(0, 0, -1).applyMatrix4(W.rot).add(W.cp); W.tgt.subVectors(W.P0, W.look).reflect(n).negate().add(W.P0);
    rc.position.copy(W.view); rc.up.set(0, 1, 0).applyMatrix4(W.rot).reflect(n); rc.lookAt(W.tgt); rc.fov = cam.fov; rc.aspect = cam.aspect; rc.near = cam.near; rc.far = Math.min(cam.far, 600); rc.updateProjectionMatrix(); rc.updateMatrixWorld();
    WU.reflM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
    { const pl = W.pl.setFromNormalAndCoplanarPoint(n, W.P0).applyMatrix4(rc.matrixWorldInverse), c = W.cpl.set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant), pm = rc.projectionMatrix, q = W.q; // 斜的近平面＝路面（路面下面的不畫）
      q.x = (Math.sign(c.x) + pm.elements[8]) / pm.elements[0]; q.y = (Math.sign(c.y) + pm.elements[9]) / pm.elements[5]; q.z = -1; q.w = (1 + pm.elements[10]) / pm.elements[14]; c.multiplyScalar(2 / c.dot(q));
      pm.elements[2] = c.x; pm.elements[6] = c.y; pm.elements[10] = c.z + 1; pm.elements[14] = c.w; }
    const hid = W.hid; hid.length = 0; for (const x of GND) if (x.visible) { x.visible = false; hid.push(x); }
    WU.tRefl.value = null; const c0 = R.info.render.calls; R.setRenderTarget(W.rt); R.clear(); r0(scene, rc); R.setRenderTarget(null); st.wetCalls = R.info.render.calls - c0;
    for (const x of hid) x.visible = true; WU.tRefl.value = W.rt.texture;
  }

  // ==== 第 39 批 2：自己的車真的反射周圍（最真實）：車子上面一顆 256 的方塊相機，每格畫 2 面（3 格一輪），畫完一輪重新做模糊的反射圖；車子、草不畫進去 ====
  const CUBE = { rt: null, cam: null, face: 0, n: 0, faces: 2, calls: 0 };
  function cubeStep(car) {
    if (!car) return;
    if (!CUBE.rt) { CUBE.rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: false }); CUBE.cam = new THREE.CubeCamera(0.5, 450, CUBE.rt); CUBE.cam.coordinateSystem = R.coordinateSystem; CUBE.cam.updateCoordinateSystem(); }
    car.getWorldPosition(V3); CUBE.cam.position.set(V3.x, V3.y + 1.1, V3.z); CUBE.cam.updateMatrixWorld(true);
    const prev = R.getRenderTarget(), vis = car.visible, gv = GR ? GR.im.visible : false, ar = R.autoClear, c0 = R.info.render.calls; car.visible = false; if (GR) GR.im.visible = false; R.autoClear = true;
    for (let k = 0; k < CUBE.faces; k++) { const i = CUBE.face; R.setRenderTarget(CUBE.rt, i); r0(scene, CUBE.cam.children[i]); CUBE.face = (i + 1) % 6; if (CUBE.face === 0) { CUBE.rt.texture.needsPMREMUpdate = true; CUBE.n++; } }
    R.setRenderTarget(prev); car.visible = vis; if (GR) GR.im.visible = gv; R.autoClear = ar; CUBE.calls = R.info.render.calls - c0;
  }
  const carEnvTex = () => (LV === 2 && CUBE.rt && CUBE.n > 0 ? CUBE.rt.texture : envTex); // 方塊畫好一輪以前先用天空的

  // ==== 5 號：車漆反射天空、透明漆 ====
  let carOn = null; const CARM = [];
  function carEnv(car) {
    if (car === carOn) return;
    for (const [m, e, ei, cc, cr] of CARM) { m.envMap = e; m.envMapIntensity = ei; if (m.isMeshPhysicalMaterial) { m.clearcoat = cc; m.clearcoatRoughness = cr; } m.needsUpdate = true; }
    CARM.length = 0; carOn = car; if (!car) return;
    const seen = new Set();
    car.traverse((x) => { if (!x.material) return; for (const m of [].concat(x.material)) { if (!m || seen.has(m) || !m.isMeshStandardMaterial || m.transparent) continue; seen.add(m);
      CARM.push([m, m.envMap, m.envMapIntensity, m.clearcoat || 0, m.clearcoatRoughness || 0]); m.envMap = carEnvTex(); m.envMapIntensity = POST.carEnv;
      if (m.isMeshPhysicalMaterial && m.metalness < 0.5) { m.clearcoat = Math.max(m.clearcoat || 0, 1); m.clearcoatRoughness = 0.05; } m.needsUpdate = true; } });
  }

  // ==== 5 號：後製（場景 → AO → 光暈 → 色調＋四角）====
  let PP = null; const SZ = new THREE.Vector2();
  function postSize() {
    R.getDrawingBufferSize(SZ); const w = SZ.x | 0, h = SZ.y | 0;
    if (PP && PP.w === w && PP.h === h) return;
    if (!PP) {
      PP = { w: 0, h: 0 };
      PP.ao = new GTAOPass(scene, new THREE.PerspectiveCamera(), Math.max(1, w >> 1), Math.max(1, h >> 1));
      PP.ao.updateGtaoMaterial({ radius: POST.aoR, distanceExponent: 1.0, distanceFallOff: 1.0, thickness: 4, scale: POST.aoS, samples: 16 });
      PP.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 }); PP.ao.blendIntensity = 1;
      PP.ao.gtaoMaterial.defines.FRAGMENT_OUTPUT = 'vec4(vec3(mix(ao, 1.0, smoothstep(70.0, 170.0, -viewPos.z))), 1.)'; // 遠的地方不算（深度不準會有黑影）
      { const bm = PP.ao.blendMaterial; bm.uniforms.tMask = { value: null }; // 場景圖 alpha 0 的地方（草、樹葉）不蓋 AO
        bm.fragmentShader = bm.fragmentShader.replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse, tMask;').replace('mix(vec3(1.), texel.rgb, intensity)', 'mix(vec3(1.), texel.rgb, intensity * texture2D(tMask, vUv).a)'); bm.needsUpdate = true; }
      PP.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, w >> 1), Math.max(1, h >> 1)), POST.bloom, POST.bRad, POST.thr);
      PP.q = new FullScreenQuad(new THREE.RawShaderMaterial({ ...FINAL, uniforms: THREE.UniformsUtils.clone(FINAL.uniforms), depthTest: false, depthWrite: false }));
    } else { PP.a.dispose(); PP.b.dispose(); PP.a.depthTexture.dispose(); }
    PP.w = w; PP.h = h;
    const dt = new THREE.DepthTexture(w, h); dt.format = THREE.DepthStencilFormat; dt.type = THREE.UnsignedInt248Type;
    PP.a = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: Math.min(4, R.capabilities.maxSamples || 0), depthBuffer: true, stencilBuffer: true, depthTexture: dt }); // stencil：圓塔電梯的洞（town.src.js shaftCut）
    PP.a.resolveDepthBuffer = true; PP.a.resolveStencilBuffer = false; PP.ao.blendMaterial.uniforms.tMask.value = PP.a.texture;
    PP.b = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    PP.ao.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); PP.ao.setGBuffer(dt); // 深度用場景的（法線從深度算），不用再畫一次場景
    PP.ao.gtaoMaterial.defines.NORMAL_VECTOR_TYPE = 0; PP.ao.pdMaterial.defines.NORMAL_VECTOR_TYPE = 0; PP.ao.gtaoMaterial.needsUpdate = true; PP.ao.pdMaterial.needsUpdate = true;
    PP.bloom.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
  }
  function postRender(cam) {
    postSize();
    R.info.autoReset = false; R.info.reset();
    WU.wetK.value = TD.night; if (TD.night > 0.01) wetRender(cam); else st.wetCalls = 0; // 第 34 批：濕路照「晚上」（以前照「燈亮」：傍晚太陽還在，濕路把太陽那片天空整個反到路上，前面一片白）
    R.setRenderTarget(PP.a); MASKU.value = 1; r0(scene, cam); MASKU.value = 0;
    PP.ao.camera = cam; PP.ao.render(R, PP.b, PP.a);
    PP.bloom.strength = THREE.MathUtils.lerp(POST.bloom, LAMP.bloom, TD.night); PP.bloom.threshold = THREE.MathUtils.lerp(POST.thr, LAMP.thr, TD.night); // 第 34 批：光暈照「晚上」不照「燈亮」：傍晚太陽還在的時候不會把天空暈成一片白 PP.q.material.uniforms.toneMappingExposure.value = TD.exp;
    PP.bloom.render(R, null, PP.b, 0, false);
    PP.q.material.uniforms.tDiffuse.value = PP.b.texture; R.setRenderTarget(null); PP.q.render(R);
    R.info.autoReset = true;
  }

  // ==== 換畫質 ====
  function capture() {
    if (S0) return;
    const H = hl(); const base = (l) => { if (H && H.lights) for (const e of H.lights) if (e[0] === l) return e[1]; return l.intensity; };
    S0 = { dlC: dl && dl.color.getHex(), dlI: dl && base(dl), dlP: dl && dl.position.clone(), dlT: dl && dl.target.position.clone(),
      hemiI: hemi && base(hemi), hemiC: hemi && hemi.color.getHex(), hemiG: hemi && hemi.groundColor.getHex(), skyMat: skyM && skyM.material,
      fogC: scene.fog && scene.fog.color.getHex(), env: scene.environment, envI: scene.environmentIntensity, sh: R.shadowMap.enabled, shT: R.shadowMap.type, shA: R.shadowMap.autoUpdate };
  }
  function lights(on) {
    if (on) {
      makeSky(); if (skyM) skyM.material = skyMat;
      scene.environment = envTex; scene.environmentIntensity = LT.envI;
      if (scene.fog) scene.fog.color.set(LT.fog);
      R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFShadowMap; R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = true;
      if (dl) { dl.color.set(LT.sunC); setBase(dl, LT.sunI); dl.castShadow = true; dl.shadow.bias = -0.0001; dl.shadow.normalBias = 0.05; shadowCfg(LV); }
      if (hemi) { setBase(hemi, LT.hemiI); hemi.color.set(LT.hemiC); hemi.groundColor.set(LT.hemiG); }
      lampsOn(); // 第 30 批：路燈、大燈（白天亮度 0）
    } else if (S0) {
      lampsOff(); signsK(0); if (lampSent !== 0) { lampSent = 0; nightCb(0); } WU.wetK.value = 0; if (WR.rt) { WR.rt.dispose(); WR.rt = null; WU.tRefl.value = null; }
      if (skyM) skyM.material = S0.skyMat;
      scene.environment = S0.env; scene.environmentIntensity = S0.envI;
      if (scene.fog) scene.fog.color.set(S0.fogC);
      R.shadowMap.enabled = S0.sh; R.shadowMap.type = S0.shT; R.shadowMap.autoUpdate = S0.shA;
      if (dl) { dl.color.set(S0.dlC); setBase(dl, S0.dlI); dl.castShadow = false; dl.position.copy(S0.dlP); dl.target.position.copy(S0.dlT); dl.target.updateMatrixWorld(); dl.updateMatrixWorld(); if (dl.shadow.map) { dl.shadow.map.dispose(); dl.shadow.map = null; } }
      if (hemi) { setBase(hemi, S0.hemiI); hemi.color.set(S0.hemiC); hemi.groundColor.set(S0.hemiG); }
      R.toneMappingExposure = EXP0;
    }
  }
  function shadowCfg(lv) { // 第 37 批：影子圖多大、照多遠（漂亮小一點）；圖大小變了要重做
    SH = SHL[lv] || SHL[2]; if (SH.map > R.capabilities.maxTextureSize) SH = { ...SH, map: Math.min(SH.map, R.capabilities.maxTextureSize) }; TEXEL = (SH.r * 2) / SH.map; if (!dl) return; dl.shadow.radius = SH.rad;
    if (dl.shadow.mapSize.x !== SH.map) { dl.shadow.mapSize.set(SH.map, SH.map); if (dl.shadow.map) { dl.shadow.map.dispose(); dl.shadow.map = null; } }
    Object.assign(dl.shadow.camera, { left: -SH.r, right: SH.r, top: SH.r, bottom: -SH.r, near: 100, far: 500 }); dl.shadow.camera.updateProjectionMatrix();
  }
  function apply(lv) {
    const was = LV; LV = lv;
    if (lv > 0) {
      if (was === 0) { capture(); lights(true); crownsOn(true); }
      else if (was !== lv) { shadowCfg(lv); lampsOff(); lampsOn(); } // 第 37 批：漂亮 ↔ 最真實：影子大小、燈的數目不一樣
      scanAll(); // 影子、材質（換層級：材質重新編）
      for (const m of MATS) m.needsUpdate = true;
      if (leafMat) leafMat.needsUpdate = true;
    } else {
      lights(false); if (prepped) crownsOn(false);
      for (const x of SHAD) { x.castShadow = false; x.receiveShadow = false; } SHAD.clear();
      for (const x of HIDE) x.visible = true; HIDE.length = 0;
      for (const m of SSIDE) m.shadowSide = null; SSIDE.clear(); PLAINR = null; PLAINM.clear();
      unpatchAll();
      SCAN.stack.length = 0;
    }
    if (GR) { GR.im.visible = lv === 2; if (lv !== 2) grassReset(); }
    if (lv !== 2) carEnv(null);
    for (const c of CELLS.values()) c.lod = -1; for (const t of NHT) t.lod = -1;
    st.sets++;
  }
  async function set(lv) {
    lv = clamp(lv | 0, 0, 2); if (lv === 2 && !half) lv = 1;
    while (busy) await busy;
    if (lv === LV) return LV;
    busy = (async () => {
      if (lv > 0 && !prepped) prep();
      if (lv === 2 && !TEX) await makeTex();
      if (lv === 2 && !GR) makeGrass();
      reseen();
      apply(lv);
    })();
    try { await busy; } finally { busy = null; }
    return LV;
  }
  function reseen() { SEEN = new WeakSet(); SCAN.stack.length = 0; SCAN.wait = 0; } // 換了層級：所有東西重新看一次

  // ==== 每一格（renderer.render 包起來）====
  const r0 = R.render.bind(R);
  let cave = 0, ind = 0; const CC = new THREE.Color(CAVE_C), CG = new THREE.Color(CAVE_G);
  function frame(cam, dt) {
    const t0 = performance.now();
    timeStep(); makeSky(); // 第 30 批：現在幾點 → 太陽、天空、反射的圖
    LX.crossVectors(sun, UP).normalize(); LY.crossVectors(LX, sun).normalize();
    if (dl) { dl.color.copy(TD.sunC); setBase(dl, TD.dlI); }
    if (scene.fog) scene.fog.color.copy(TD.fog);
    // 影子：跟著鏡頭（前面 35 公尺），對齊影子的格子
    if (dl) {
      cam.getWorldDirection(V3b); V3b.y = 0; if (V3b.lengthSq() > 1e-6) V3b.normalize();
      const H = hl(), A = SH.ahead, gy = V.heightAt ? V.heightAt(cam.position.x + V3b.x * A, cam.position.z + V3b.z * A) : 0;
      V3.set(cam.position.x + V3b.x * A, H && H.inside && H.inside(cam.position.x, cam.position.z, cam.position.y) ? cam.position.y : gy, cam.position.z + V3b.z * A);
      const a = V3.dot(LX), b = V3.dot(LY), sa = Math.round(a / TEXEL) * TEXEL - a, sb = Math.round(b / TEXEL) * TEXEL - b;
      V3.addScaledVector(LX, sa).addScaledVector(LY, sb);
      dl.target.position.copy(V3); dl.position.copy(V3).addScaledVector(sun, 300); dl.target.updateMatrixWorld(); dl.updateMatrixWorld();
    }
    // 隧道裡面（hills.js 變暗）、圓塔裡面：太陽被擋住了，天空光補一點
    { const H = hl(), k = H && H.dimK != null ? H.dimK : 1; ind += ((indoor(cam) ? 1 : 0) - ind) * (1 - Math.exp(-dt * 6)); cave = Math.max(clamp((1 - k) / 0.58, 0, 1), ind);
      scene.environmentIntensity = TD.envI * k + cave * 0.3;
      if (hemi) { hemi.intensity = TD.hemiI + (CAVE_I - TD.hemiI) * cave; hemi.color.lerpColors(TD.hemiC, CC, cave); hemi.groundColor.lerpColors(TD.hemiG, CG, cave); } }
    lodStep(cam, false);
    scanStep(300, dt);
    lampStep(cam);
    if (LV === 2) { if (GR) grassStep(cam); const car = getCar(); carEnv(car); if (car) { cubeStep(car); const ce = carEnvTex(); for (const c of CARM) if (c[0].envMap !== ce) c[0].envMap = ce; } } // 第 39 批：方塊反射
    const ms = performance.now() - t0; st.ms = st.ms * 0.95 + ms * 0.05; if (ms > st.maxMs) st.maxMs = ms;
  }
  let lastT = 0;
  R.render = function (sc, cam) {
    if (LV === 0 || sc !== scene) { if (carOn && sc.isScene && sc !== scene) carEnv(null); if (lampSent > 0 && sc.isScene) { lampSent = -1; nightCb(0); } R.toneMappingExposure = EXP0; if (sc.isScene) st.wetCalls = 0; return r0(sc, cam); } // 車庫頁：車燈關掉（回世界再開） // 車庫頁、房子裡面：車漆換回來（後製的那幾道不是 Scene）
    if (R.getRenderTarget() !== null) return r0(sc, cam); // 後照鏡：不重算影子、沒有後製
    const now = performance.now(), dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0; lastT = now;
    frame(cam, dt);
    R.shadowMap.needsUpdate = true;
    if (LV === 2) { postRender(cam); st.calls = R.info.render.calls; st.tris = R.info.render.triangles; return; }
    R.toneMappingExposure = TD.exp; st.wetCalls = 0; r0(sc, cam); R.toneMappingExposure = EXP0;
    st.calls = R.info.render.calls; st.tris = R.info.render.triangles;
  };
  const API = {
    get level() { return LV; },
    get busy() { return !!busy; },
    can: { post: half, soft },
    half,
    pref: soft ? 0 : mobile ? 1 : half ? 2 : 1, // 沒有設定過：電腦模擬的（測試）＝順，手機＝漂亮（第 39 批：最真實不管手機，太重），電腦畫得了半精度＝最真實
    set, treeK, stats: st,
    get hour() { return hourNow(); }, setHour(h) { hourOv = h == null ? null : clamp(+h, 0, 24) % 24; timeStep(); lampN = 0; }, get night() { return TD.lamp; }, get sun() { return TD.elev; }, // 第 30 批：一天的時間
    _tex: () => TEX, _td: () => TD,
    info: () => ({ level: LV, crowns: st.crowns, cells: CELLS.size, nh: NHT.length, mats: MATS.size, shad: SHAD.size, grass: GR ? GR.im.count : 0, hour: +hourNow().toFixed(2), sun: +TD.elev.toFixed(1), night: +TD.lamp.toFixed(2), lamps: lampPts ? lampPts.length / 3 : 0, signs: SIGNS.size, envs: ENVS.size, band: TD.band, stars: NS ? +NS.stars.material.opacity.toFixed(2) : null, moon: NS ? +NS.moon.material.opacity.toFixed(2) : null, win: NS ? NS.lit : 0, winK: NS ? +NS.win.material.opacity.toFixed(2) : 0, pools: NS ? NS.pools : 0, pol: NS && NS.pol ? +NS.pol.intensity.toFixed(1) : 0, polD: NS && NS.polCar ? +NS.polD.toFixed(1) : null, sh: LV ? SH.map : 0, shR: LV ? SH.r : 0, shRad: dl ? dl.shadow.radius : 0, cube: CUBE.n, cubeCalls: CUBE.calls, carCube: !!(CARM.length && CUBE.rt && CARM[0][0].envMap === CUBE.rt.texture), nLamp: PL ? PL.length : 0, nHead: HLT ? HLT.length : 0, polOn: !!(NS && NS.pol) }), // 第 37 批：影子大小、燈幾盞
    _ns: () => NS, _az: () => TD.az,
  };
  return API;
}
return { createLook, LOOK_NAMES };
})();
