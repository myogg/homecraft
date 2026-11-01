// 房屋外壳：墙体、楼板、屋顶、楼梯、登顶梯，全部用方块搭建。
// 岛屿本体由引擎 terrain.js 的 buildIsland 负责（用本文件的 surfaceAt 决定顶面贴图）。
import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { HOUSE, LOFT, STAIRS, ENTRANCE, ROOF_LIFT, ROOF_SOLID, ROOF_BEAM_STEP, POOL, POOL_DECK, POOL_LADDER, POOL_LAMPS,
  LOFT_LIFT, ROOF_HATCH } from './layout.js';
import { inRect } from '@engine/world/terrain.js';

const SHELL = { x0: HOUSE.x0 - 1, x1: HOUSE.x1 + 1, z0: HOUSE.z0 - 1, z1: HOUSE.z1 + 1 };

// 外墙承重柱：四角必为柱，东西墙按 z、南北墙按 x 每 4 m 一根；南墙门洞（ENTRANCE）不立柱。
// 墙体其余皆为玻璃。注意：东西墙只按 z 判定，绝不能落到“按 x 判定”的收尾分支，否则整面墙变柱。
const PILLAR_STEP = 4;
const isPillarCell = (x, z) => {
  const onW = x === HOUSE.x0 - 1, onE = x === HOUSE.x1, onN = z === HOUSE.z0 - 1, onS = z === HOUSE.z1;
  if (!onW && !onE && !onN && !onS) return false;
  if ((onW || onE) && (onN || onS)) return true;            // 四角必为柱
  const mod = v => ((v % PILLAR_STEP) + PILLAR_STEP) % PILLAR_STEP;
  if (onW || onE) return mod(z - HOUSE.z0) === 0;            // 东西墙：沿 z 每 4 m 一根
  if (onS && x >= ENTRANCE.x0 && x <= ENTRANCE.x1) return false; // 门洞留空，不立柱
  return mod(x - (HOUSE.x0 - 1)) === 0;                      // 南北墙：沿 x 每 4 m 一根
};

export function defineHouseBlocks(grid) {
  const interior = (x, y, z) => x >= HOUSE.x0 && x < HOUSE.x1 && z >= HOUSE.z0 && z < HOUSE.z1 && y >= 0 && y < HOUSE.height;
  const wallTex = (face, x, y, z) => {
    if (face.n[1] === 1) return 'steel';
    if (face.n[1] === -1) return 'black_metal';
    const nx = x + face.n[0], nz = z + face.n[2];
    if (!interior(nx, y, nz)) return 'black_metal';
    return 'wood_panel';
  };
  grid.define('wood_floor', { tex: { all: 'greige_floor' }, merge: true });
  grid.define('wall', { tex: wallTex, merge: true });
  grid.define('partition', { tex: { all: 'wood_panel' }, merge: true });
  grid.define('roof', { tex: { top: 'roof', side: 'black_metal', bottom: 'wood_panel' }, merge: true });
  grid.define('parapet', { tex: { top: 'steel', side: 'black_metal', bottom: 'black_metal' } });
  grid.define('loft', { tex: { top: 'greige_floor', side: 'wood_panel', bottom: 'wood_panel' }, merge: true });
  // 玻璃只保留一面，读起来是一片完整玻璃而非厚板。
  const paneFace = (x, y, z) => y >= HOUSE.height ? 2
    : x === HOUSE.x0 - 1 ? 0 : x === HOUSE.x1 ? 1 : z === HOUSE.z0 - 1 ? 4
    : z === HOUSE.z1 ? 5 : -1;
  grid.define('glass', { kind: 'glass', tex: { all: 'glass' }, merge: true,
    skipFace: (f, x, y, z) => { const keep = paneFace(x, y, z); return keep >= 0 && f !== keep; } });
  // 泳池：池底深砖、池壁瓷砖、池缘（顶石灰华、侧面瓷砖）。
  grid.define('pool_tile', { tex: { all: 'pool_tile' } });
  grid.define('pool_deep', { tex: { all: 'pool_deep' } });
  grid.define('coping', { tex: { top: 'travertine', side: 'pool_tile', bottom: 'pool_tile' } });
  grid.define('beam', { tex: { all: 'black_metal' }, merge: true });
  grid.define('pillar', { tex: { all: 'black_metal' }, merge: true });
}

// 屋内铺木地板、屋外草地；泳池周围的露台铺石材。
export function surfaceAt(x, z) {
  if (inRect(SHELL, x, z)) return 'wood_floor';
  if (inRect(POOL_DECK, x, z)) return 'travertine';
  return 'grass';
}

// 搭建外壳：四壁（窗带+门）、屋顶+围栏、北半部二层楼板（避开楼梯井）、
// 楼板下的实体基座、一层与二层隔墙。
export function buildShell(grid) {
  const { x0, x1, z0, z1, height } = HOUSE;
  const cell = (x, y, z, door) => door ? null : (isPillarCell(x, z) ? 'pillar' : 'glass');
  // 四壁，每面一个 group，便于相机需要时可单独隐藏。
  for (let y = 0; y < height; y++) {
    for (let x = x0 - 1; x <= x1; x++) {
      const southDoor = x >= ENTRANCE.x0 && x < ENTRANCE.x1 && y <= 2;
      grid.set(x, y, z0 - 1, cell(x, y, z0 - 1, false), 'wallN');
      grid.set(x, y, z1, cell(x, y, z1, southDoor), 'wallS');
    }
    for (let z = z0; z < z1; z++) {
      grid.set(x0 - 1, y, z, cell(x0 - 1, y, z, false), 'wallW');
      grid.set(x1, y, z, cell(x1, y, z, false), 'wallE');
    }
  }
  // 屋顶：玻璃顶（横梁分隔），放桌椅的正下方留实心；四周 1 m 围栏，东侧留梯口。
  // 室内电梯井那一格挖空（ROOF_HATCH）：井道从洞里穿出去，洞口外仍是完整台面。
  for (let x = x0 - 1; x <= x1; x++) for (let z = z0 - 1; z <= z1; z++) {
    if (inRect(ROOF_HATCH, x, z)) continue;
    const solid = ROOF_SOLID.some(s => inRect(s, x, z));
    const beam = !solid && ((x - (x0 - 1)) % ROOF_BEAM_STEP === 0 || (z - (z0 - 1)) % ROOF_BEAM_STEP === 0);
    grid.set(x, height, z, solid ? 'roof' : beam ? 'beam' : 'glass', 'roof');
    const rim = x === x0 - 1 || x === x1 || z === z0 - 1 || z === z1;
    const gate = x === x1 && z >= ROOF_LIFT.gate0 && z < ROOF_LIFT.gate1;
    if (rim && !gate) grid.set(x, height + 1, z, 'parapet', 'roof');
  }
  // 二层楼板（loft）：只铺北半部，中央楼梯井留空（斜坡从中穿过、光与视线贯通）。
  grid.fill(LOFT.x0, LOFT.y - 1, LOFT.z0, LOFT.x1, LOFT.y, LOFT.z1, 'loft');
  for (let x = STAIRS.x0; x < STAIRS.x1; x++) for (let z = STAIRS.z0; z < STAIRS.z1; z++) grid.set(x, LOFT.y - 1, z, null);
  // 室内电梯井那一格楼板保持实心：它就是井道底板，轿厢空载时停在这上面。
  // （nav 把这格标成障碍，站立面由 buildLoftLift 的 levels() 补上。）
  // 楼板下的实体基座：填死 y0..2 的暗层（免得透过一层窗看到黑洞），楼梯从中穿出。
  grid.fill(x0, 0, LOFT.z0, x1, LOFT.y - 1, LOFT.z1, 'partition');
  // 隔墙：yBase 起铺 h 高，doors 为门洞（格子中心落在门矩形内即留空）。
  // 门洞可选 y0/y1（绝对高度）：给了就只在该高度段开洞，上方留过梁；不给则通高。
  const partition = (x0p, z0p, x1p, z1p, doors, yBase = 0, h = 3) => {
    for (let y = yBase; y < yBase + h; y++) for (let x = x0p; x < x1p; x++) for (let z = z0p; z < z1p; z++) {
      const door = doors.some(d => x + 0.5 >= d.x0 && x + 0.5 < d.x1 && z + 0.5 >= d.z0 && z + 0.5 < d.z1
        && (d.y0 === undefined || y + 0.5 >= d.y0) && (d.y1 === undefined || y + 0.5 < d.y1));
      grid.set(x, y, z, door ? null : 'partition', 'partition');
    }
  };
  // 一层西南角：卫生间与衣帽间（北墙各留 2 m 门洞，中间实体隔墙）。
  partition(-12, 6, -6, 7, [{ x0: -11.5, z0: 6, x1: -9.5, z1: 7 }, { x0: -8.6, z0: 6, x1: -6.4, z1: 7 }]);
  partition(-9, 6, -8, 10, []);
  // 二层（y 4..8）：两间卧室各自围成独立房间，外墙是玻璃幕墙（落地窗）、
  // 屋顶是玻璃顶（天窗），只在南墙开 2 m 门通向楼梯北侧的过厅——即「只有门窗」。
  const LY = LOFT.y, WALL_H = 4, DOOR_TOP = LY + 3;   // 墙顶到玻璃顶；门净高 3 m，其上 1 m 过梁
  const doorway = (x0d, z0d, x1d, z1d) => ({ x0: x0d, z0: z0d, x1: x1d, z1: z1d, y1: DOOR_TOP });
  // 卫生间（x[-3,3) z[-10,-5)）南墙，门在 x[-1,1)，朝过厅。
  partition(-3, -5, 3, -4, [doorway(-1, -5, 1, -4)], LY, WALL_H);
  // 主卧（西，x[-12,-3) z[-10,-4)）：南墙 z=-4，门 x[-6,-4) 正对楼梯出口。
  partition(-12, -4, -3, -3, [doorway(-6, -5, -4, -3)], LY, WALL_H);
  // 次卧（东，x[5,12) z[-10,-4)）：南墙 z=-4，门 x[6,8)；西侧 x=4 让给二层楼梯。
  partition(5, -4, 12, -3, [doorway(6, -5, 8, -3)], LY, WALL_H);
  // 两卧内侧墙（含卫生间两侧墙段），把卧室与过厅/楼梯平台隔开。
  partition(-3, -10, -2, -3, [], LY, WALL_H);
  partition(2, -10, 3, -3, [], LY, WALL_H);   // 卫生间东墙，同时是电梯井西壁
  partition(4, -10, 5, -3, [], LY, WALL_H);   // 电梯井东壁（次卧西墙）
}

// 泳池池体：从 bed 到地面把池内挖空（池底 pool_deep、池内 null），池缘一圈
// coping（顶石灰华、侧面瓷砖），南缘（朝海）留开成无边水面。先判 SHELL，避免
// 与房屋重叠时把地板误判成瓷砖。
export function buildPool(grid) {
  for (let x = POOL.x0 - 1; x <= POOL.x1; x++) for (let z = POOL.z0 - 1; z <= POOL.z1; z++) {
    if (inRect(SHELL, x, z)) continue;
    const inside = x >= POOL.x0 && x < POOL.x1 && z >= POOL.z0 && z < POOL.z1;
    const seaEdge = x >= POOL.x0 && x < POOL.x1 && z === POOL.z1;
    for (let y = POOL.bed - 2; y < 0; y++) {
      if (inside) grid.set(x, y, z, y < POOL.bed ? 'pool_deep' : null);
      // 池内正下方每格都必须清空：y=-2 会在海面之上留下一道宽台，且紧邻水线
      // 墙的那一格会共享面而闪烁。
      else if (seaEdge) grid.set(x, y, z, y < POOL.bed ? 'pool_tile' : null);
      else grid.set(x, y, z, y === -1 ? 'coping' : 'pool_tile');
}
}
}

// 入户门：门洞在 grid 里保持 null（可通行），这里只加视觉门板——两扇玻璃门各向
// 室内打开 90°、贴在门洞两侧，中间通道不挡。门板走 BoxBatch，不参与碰撞。
export function buildOpenings(layer) {
  const B = new BoxBatch(layer);
  const glass = { glass: true, tex: 'glass' }, steel = { tex: 'steel' };
  const { x0, x1 } = ENTRANCE;
  const z = HOUSE.z1;                       // 南墙中心线
  const h = 2.86;                           // 门高（门洞 3 m）
  const w = (x1 - x0) / 2;                  // 每扇宽 2 m
  // 两扇玻璃门（透明玻璃板 + 细钢框），向室内打开 90° 贴两侧。
  for (const [hinge, dir] of [[x0, 1], [x1, -1]]) {
    B.at(hinge, 0, z, dir * Math.PI / 2, () => {
      // 玻璃主面板（透明）。
      B.box(w / 2, 0, 0, w - 0.1, h - 0.1, 0.04, glass);
      // 钢框：上、下、铰链侧、自由侧。
      B.box(w / 2, h - 0.06, 0, w, 0.06, 0.06, steel);
      B.box(w / 2, 0.06, 0, w, 0.06, 0.06, steel);
      B.box(0.06, h / 2, 0, 0.06, h, 0.06, steel);
      B.box(w - 0.06, h / 2, 0, 0.06, h, 0.06, steel);
      // 把手（自由侧）。
      B.box(w - 0.18, 1.0, 0.1, 0.05, 0.2, 0.05, steel);
    });
  }
  return B;
}

// 中央直跑楼梯：台阶从地面（z=STAIRS.z0）升到二层（z=STAIRS.z1），视觉块；
// 实际可走高度由 layout.floorAt 的斜坡给出。返回台阶信息供 furnish 加扶手/灯。
export function buildStairs(layer) {
  const B = new BoxBatch(layer);
  const { x0: sx0, x1: sx1, z0: sz0, z1: sz1 } = STAIRS;
  const steps = 16, run = (sz1 - sz0) / steps;
  const stairX = (sx0 + sx1) / 2, stairWidth = (sx1 - sx0) - 0.3;
  const steel = { tex: 'steel' }, floor = { tex: 'greige_floor' }, light = { tex: 'paint', tint: 0xffdba6, emissive: 0.4 };
  for (let i = 0; i < steps; i++) {
    const z = sz1 - (i + 0.5) * run, y = (i + 1) * LOFT.y / steps;
    B.box(stairX, 0, z, stairWidth - 0.05, y - 0.06, run, steel);
    B.box(stairX, y - 0.06, z, stairWidth, 0.06, run, floor);
    B.box(stairX, y - 0.12, z + run / 2 + 0.012, stairWidth - 0.4, 0.035, 0.025, light);
  }
  // 两侧扶手。
  const length = Math.hypot(sz1 - sz0, LOFT.y), slope = Math.atan2(LOFT.y, sz1 - sz0);
  for (const x of [sx0 + 0.15, sx1 - 0.15]) {
    B.box(x, LOFT.y / 2 + 0.93, (sz0 + sz1) / 2, 0.06, 0.06, length, steel, { rx: slope });
    for (const t of [0.04, 0.27, 0.5, 0.73, 0.96]) {
      const z = sz1 - t * (sz1 - sz0), y = (sz1 - z) * LOFT.y / (sz1 - sz0);
      B.box(x, y, z, 0.06, 0.95, 0.06, steel);
    }
  }
  return { batch: B, stairX, stairWidth, sz0, sz1 };
}

// 屋外上观景台的玻璃观光电梯：贴东外墙，两层停靠（草地 y0 / 观景台 y9）。
// 井道是三面玻璃的盒子、轿厢在里面直上直下；底层门朝东（草地），顶层门朝西
// （正对屋顶围栏缺口，跨一步就是观景台）。
// 对外沿用引擎的梯子协议（ladderAt / route / levels / collides / pick），所以
// 寻路、点击登顶、自动乘坐都不用改；只是把「一格一格爬」换成「轿厢直上直下」。
export function buildRoofAccess(layer, materials) {
  const L = ROOF_LIFT;
  const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  const W = L.x1 - L.x0, D = L.z1 - L.z0;
  const H = L.top + L.rise;                                  // 井道结构高：观景台再上一层
  const steel = { tex: 'steel' }, glass = { glass: true, tex: 'glass' };
  const stone = { tex: 'travertine' }, dark = { tex: 'black_metal' };
  const warm = { tex: 'paint', tint: 0xffe2b8, emissive: 0.9 };

  const group = new THREE.Group(); group.name = 'roof-lift';

  // ---------- 井道 ----------
  const shell = new BoxBatch(layer);
  shell.box(cx, 0, cz, W + 0.3, 0.08, D + 0.3, stone);                          // 门槛石
  for (const x of [L.x0, L.x1]) for (const z of [L.z0, L.z1]) shell.box(x, 0, z, 0.14, H, 0.14, steel);
  // 南北两面整片玻璃，中间一道竖框、三道横框。
  for (const z of [L.z0, L.z1]) {
    shell.box(cx, 0, z, W - 0.16, H, 0.05, glass, { shadow: false });
    shell.box(cx, 0, z, 0.07, H, 0.07, steel);
    for (const y of [0.04, H * 0.42, H * 0.76, H - 0.06]) shell.box(cx, y, z, W - 0.16, 0.05, 0.06, steel);
  }
  // 东面：底层门洞两侧的侧玻璃 + 门楣（门洞 y 0..2.45）。
  const segN = L.door0 - L.z0 - 0.07, segS = L.z1 - L.door1 - 0.07;
  shell.box(L.x1, 0, (L.z0 + L.door0) / 2, 0.05, H, segN, glass, { shadow: false });
  shell.box(L.x1, 0, (L.door1 + L.z1) / 2, 0.05, H, segS, glass, { shadow: false });
  shell.box(L.x1, 2.45, cz, 0.05, H - 2.45, L.door1 - L.door0, glass, { shadow: false });
  for (const y of [0.04, 2.45, H * 0.62, H - 0.06]) shell.box(L.x1, y, cz, 0.06, 0.05, W - 0.02, steel);
  for (const z of [L.z0 + 0.03, L.z1 - 0.03]) shell.box(L.x1, 0, z, 0.06, H, 0.06, steel);
  // 西面：只砌到观景台面（y=9），上面整个是顶层门洞，人从屋顶直接走进轿厢。
  shell.box(L.x0, 0, cz, 0.05, L.top, D - 0.16, glass, { shadow: false });
  for (const y of [0.04, 3.2, 6.2, L.top - 0.05]) shell.box(L.x0, y, cz, 0.06, 0.05, D - 0.16, steel);
  // 顶盖：一圈钢梁 + 一块玻璃。
  for (const z of [L.z0, L.z1]) shell.box(cx, H, z, W + 0.22, 0.12, 0.14, steel);
  for (const x of [L.x0, L.x1]) shell.box(x, H, cz, 0.14, 0.12, D + 0.22, steel);
  shell.box(cx, H + 0.12, cz, W - 0.3, 0.04, D - 0.3, glass, { shadow: false });
  // 四角的内侧灯带：夜里井道自己发光，像一根灯柱。
  for (const x of [L.x0 + 0.1, L.x1 - 0.1]) for (const z of [L.z0 + 0.1, L.z1 - 0.1])
    shell.box(x, 0.35, z, 0.05, H - 1.1, 0.05, warm);
  for (const m of shell.build(materials)) group.add(m);

  // ---------- 轿厢 ----------
  const cab = new THREE.Group(); cab.name = 'lift-cab';
  const C = new BoxBatch(layer), cw = 1.42, ch = 2.34;
  C.box(cx, -0.1, cz, cw, 0.1, cw, stone);                                       // 地板（顶面正好是脚底 y=0）
  C.box(cx, ch, cz, cw, 0.1, cw, dark);                                          // 顶棚
  const side = cw / 2 - 0.025;
  for (const [dx, dz, w, d] of [[0, -side, cw - 0.1, 0.05], [0, side, cw - 0.1, 0.05], [-side, 0, 0.05, cw - 0.1], [side, 0, 0.05, cw - 0.1]])
    C.box(cx + dx, 0, cz + dz, w, ch, d, glass, { shadow: false });
  for (const [dx, dz] of [[-side, -side], [side, -side], [-side, side], [side, side]])
    C.box(cx + dx, 0, cz + dz, 0.05, ch, 0.05, steel);                           // 立柱
  C.box(cx, ch - 0.05, cz, cw - 0.5, 0.04, cw - 0.5, warm);                     // 顶灯
  for (const z of [cz - cw / 2 + 0.12, cz + cw / 2 - 0.12]) C.box(cx, 0.92, z, cw - 0.34, 0.045, 0.045, steel);
  for (const m of C.build(materials)) cab.add(m);
  group.add(cab);

  // ---------- 层门（单扇，到站时向上收进门楣）----------
  // 井道两侧只有 0.35 m 空腔，双开滑门收不进去；改成上滑门，升起来贴在门楣
  // 玻璃内侧，既不会伸出井道，也看得见门在动。
  const span = L.door1 - L.door0 - 0.02, dh = 2.34;
  function panel(x, z, h) {
    const g = new THREE.Group(), db = new BoxBatch(layer);
    db.box(0, 0, 0, 0.045, h, span, glass, { shadow: false });
    for (const s of [-1, 1]) db.box(0, 0, s * (span / 2 - 0.03), 0.06, h, 0.05, steel);
    for (const y of [0.03, h * 0.5, h - 0.05]) db.box(0, y, 0, 0.06, 0.05, span, steel);
    for (const m of db.build(materials)) g.add(m);
    g.position.set(x, 0, z);
    return g;
  }
  const doorE = panel(L.x1 - 0.055, cz, dh), doorW = panel(L.x0 + 0.055, cz, L.rise - 0.08);
  doorW.position.y = L.top;
  group.add(doorE, doorW);

  // ---------- 引擎协议 ----------
  // foot：轿厢里的落脚点（爬到底/到顶时角色被放到这里）；approach：井外草地，
  // 走过来的集合点；exit：观景台上的落点。
  const pit = { x: cx, y: L.bottom, z: cz };
  const approach = { x: L.x1 + 0.95, y: 0, z: cz };
  const exit = { x: L.x0 - 0.15, y: L.top, z: cz, site: 'roof' };
  const ladder = { x: cx, z: cz, bottom: L.bottom, top: L.top, foot: pit, exit, site: 'roof-lift', speed: 2.4 };

  const bounds = new THREE.Box3(new THREE.Vector3(L.x0, 0, L.z0), new THREE.Vector3(L.x1, H, L.z1));
  const point = new THREE.Vector3();

  function ladderAt(x, y, z) {
    if (x < L.x0 + 0.04 || x > L.x1 - 0.04 || z < L.z0 + 0.04 || z > L.z1 - 0.04) return null;
    return y >= L.bottom - 0.2 && y <= L.top + L.rise ? ladder : null;
  }
  function route(ax, ay, az, bx, by, bz) {
    // 同一层只是换个位置：不必进电梯，否则站在观景台上点另一头会先下楼再上来。
    if (Math.abs(by - ay) < 0.6) return [{ x: bx, y: by, z: bz }];
    const up = by > ay + 0.5, atTop = ay > L.top - 0.6, atFloor = ay < L.top - 0.6;
    const far = (p) => Math.hypot(bx - p.x, bz - p.z) > 1.2;
    if (up && atFloor) {
      const out = [{ ...approach }, { ...pit }, { ...pit, y: L.top, ladder: true }, { ...exit }];
      if (far(exit)) out.push({ x: bx, y: by, z: bz });
      return out;
    }
    if (!up && atTop) {
      const out = [{ ...exit }, { ...pit, y: L.top }, { ...pit, y: L.bottom, ladder: true }, { ...approach }];
      if (far(approach)) out.push({ x: bx, y: by, z: bz });
      return out;
    }
    return [{ x: bx, y: by, z: bz }];
  }

  let cabY = L.bottom, open = 0;
  // 每帧：轿厢跟着乘客走；空载时回到离玩家最近的一层；到站且有人在门口才开门。
  function update(dt, player) {
    const riding = !!player && player.island === 'roof-lift';
    const py = player ? player.y : L.top;
    if (riding) cabY = py;
    else {
      const stop = Math.abs(py - L.top) < Math.abs(py - L.bottom) ? L.top : L.bottom;
      cabY += (stop - cabY) * Math.min(1, dt * 2.4);
    }
    cab.position.y = cabY;
    const atStop = Math.min(Math.abs(cabY - L.bottom), Math.abs(cabY - L.top)) < 0.25;
    let want = 0;
    if (player && atStop && !riding) {
      const d = Math.hypot(player.pos.x - cx, player.pos.z - cz);
      if (d < 2.6 && Math.min(Math.abs(py - L.bottom), Math.abs(py - L.top)) < 2.2) want = 1;
    }
    open += (want - open) * Math.min(1, dt * 4.5);
    doorE.position.y = open * dh;
    doorW.position.y = L.top + open * (L.rise - 0.08);
  }
  update(0, null);

  return {
    group, foot: pit, approach, exit, ladder, ladderAt, route, update,
    // 井道里给一块 y=9 的站立面，人才能从屋顶一步跨进轿厢（低处会被高度差过滤掉）。
    levels(x, z, out) {
      if (x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1) out.push({ y: L.top, site: 'roof', tread: true });
    },
    // 三面玻璃是实心的，只放行底层东门与顶层西门。
    collides(x, feet, z) {
      const r = 0.28;
      if (x + r < L.x0 || x - r > L.x1 || z + r < L.z0 || z - r > L.z1) return false;
      if (feet > H || feet < -1.2) return false;
      if (x > L.x0 + 0.16 && x < L.x1 - 0.16 && z > L.z0 + 0.16 && z < L.z1 - 0.16) return false;
      const door = z > L.door0 + 0.06 && z < L.door1 - 0.06;
      if (door && feet < 2.45 && x > L.x1 - 0.32) return false;                 // 底层东门
      if (door && feet > L.top - 0.6 && x < L.x0 + 0.32) return false;          // 顶层西门
      return true;
    },
    pick(ray) {
      if (!ray.intersectBox(bounds, point)) return null;
      return { t: point.distanceTo(ray.origin), point: point.clone(), site: 'roof-lift' };
    },
  };
}

// 二层通屋顶观景台的室内玻璃观光电梯：占 x[3,4) 一格宽（原来的窄楼梯同一井道），
// 从二层楼面（y=4）直上屋顶（y=9）。井道是四面玻璃的窄管、轿厢在里面上下；南面
// （过厅侧）开二层门，北面上段整个敞开，人从轿厢一步跨上观景台。
// 沿用引擎的梯子协议（ladderAt / route / levels / collides / pick / update），所以
// 寻路、点击乘坐、自动升降都不用改；只是把「一级级走」换成「轿厢直上直下」。
export function buildLoftLift(layer, materials) {
  const L = LOFT_LIFT;
  const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  const W = L.x1 - L.x0, D = L.z1 - L.z0;
  const H = L.top + L.rise;                                  // 井道结构高：屋顶再上一层
  const steel = { tex: 'steel' }, glass = { glass: true, tex: 'glass' };
  const stone = { tex: 'travertine' }, dark = { tex: 'black_metal' };
  const warm = { tex: 'paint', tint: 0xffe2b8, emissive: 0.9 };

  const group = new THREE.Group(); group.name = 'loft-lift';

  // ---------- 井道（玻璃管：南面开二层门，北面上段整个敞开）----------
  const shell = new BoxBatch(layer);
  shell.box(cx, 0, cz, W + 0.3, 0.08, D + 0.3, stone);                          // 门槛石
  for (const x of [L.x0, L.x1]) for (const z of [L.z0, L.z1]) shell.box(x, 0, z, 0.14, H, 0.14, steel);
  // 东西两面整片玻璃 + 竖框。
  for (const x of [L.x0, L.x1]) {
    shell.box(x, 0, cz, 0.05, H, D - 0.16, glass, { shadow: false });
    shell.box(x, 0, cz, 0.07, H, 0.07, steel);
    for (const y of [0.04, L.bottom, L.top, H - 0.06]) shell.box(x, y, cz, 0.06, 0.05, D - 0.16, steel);
  }
  // 南面（过厅侧，z=z1）：二层门洞（x∈[doorLoftX0,doorLoftX1]）两侧玻璃，门楣以上到顶整片玻璃。
  shell.box((L.x0 + L.doorLoftX0) / 2, 0, L.z1, L.doorLoftX0 - L.x0, H, 0.05, glass, { shadow: false });
  shell.box((L.doorLoftX1 + L.x1) / 2, 0, L.z1, L.x1 - L.doorLoftX1, H, 0.05, glass, { shadow: false });
  shell.box(cx, L.bottom + 2.45, L.z1, L.doorLoftX1 - L.doorLoftX0, 0.16, 0.07, steel);        // 门楣钢梁
  shell.box(cx, L.bottom + 2.61, L.z1, L.doorLoftX1 - L.doorLoftX0, H - (L.bottom + 2.61), 0.05, glass, { shadow: false });
  for (const y of [0.04, L.bottom, L.top, H - 0.06]) shell.box(cx, y, L.z1, W - 0.02, 0.05, 0.06, steel);
  for (const x of [L.x0 + 0.03, L.x1 - 0.03]) shell.box(x, 0, L.z1, 0.06, H, 0.06, steel);
  // 北面（屋顶侧，z=z0）：门洞两侧玻璃通高；门洞过了屋顶面（y≥9）就完全敞开，
  // 人从轿厢一步跨上观景台——不用再开门，省一道闸也不会挡视线。
  shell.box((L.x0 + L.doorRoofX0) / 2, 0, L.z0, L.doorRoofX0 - L.x0, H, 0.05, glass, { shadow: false });
  shell.box((L.doorRoofX1 + L.x1) / 2, 0, L.z0, L.x1 - L.doorRoofX1, H, 0.05, glass, { shadow: false });
  for (const y of [0.04, L.bottom, L.top - 0.05]) shell.box(cx, y, L.z0, W - 0.02, 0.05, 0.06, steel);
  for (const x of [L.doorRoofX0, L.doorRoofX1]) shell.box(x, L.top, L.z0, 0.06, H - L.top, 0.06, steel);
  // 顶盖：一圈钢梁 + 一块玻璃。
  for (const z of [L.z0, L.z1]) shell.box(cx, H, z, W + 0.22, 0.12, 0.14, steel);
  for (const x of [L.x0, L.x1]) shell.box(x, H, cz, 0.14, 0.12, D + 0.22, steel);
  shell.box(cx, H + 0.12, cz, W - 0.3, 0.04, D - 0.3, glass, { shadow: false });
  // 四角内侧灯带：夜里井道自己发光。
  for (const x of [L.x0 + 0.1, L.x1 - 0.1]) for (const z of [L.z0 + 0.1, L.z1 - 0.1])
    shell.box(x, 0.35, z, 0.05, H - 1.1, 0.05, warm);
  for (const m of shell.build(materials)) group.add(m);

  // ---------- 轿厢（几何用相对坐标，cab.position.y 由 update 设为 cabY）----------
  const cab = new THREE.Group(); cab.name = 'loft-lift-cab';
  const C = new BoxBatch(layer), cw = W - 0.22, ch = 2.34;
  C.box(cx, -0.12, cz, cw, 0.08, cw, stone);                                     // 地板：顶面比停靠面低 4 cm，压不出一层闪面
  C.box(cx, ch, cz, cw, 0.1, cw, dark);                                          // 顶棚
  const side = cw / 2 - 0.025;
  // 只做东西两面玻璃：南北两面空着当门——南进二层过厅、北出观景台。
  for (const dx of [-side, side]) C.box(cx + dx, 0, cz, 0.05, ch, cw - 0.1, glass, { shadow: false });
  for (const [dx, dz] of [[-side, -side], [side, -side], [-side, side], [side, side]])
    C.box(cx + dx, 0, cz + dz, 0.05, ch, 0.05, steel);                           // 立柱
  C.box(cx, ch - 0.05, cz, cw - 0.5, 0.04, cw - 0.5, warm);                     // 顶灯
  for (const dx of [-cw / 2 + 0.12, cw / 2 - 0.12]) C.box(cx + dx, 0.92, cz, 0.045, 0.045, cw - 0.34, steel);
  for (const m of C.build(materials)) cab.add(m);
  group.add(cab);

  // ---------- 层门（面朝南北，所以门板沿 x 展开）----------
  const span = (L.doorLoftX1 - L.doorLoftX0) - 0.02, dh = 2.34;
  function panel(x, z, h) {
    const g = new THREE.Group(), db = new BoxBatch(layer);
    db.box(0, 0, 0, span, h, 0.045, glass, { shadow: false });
    for (const s of [-1, 1]) db.box(s * (span / 2 - 0.03), 0, 0, 0.05, h, 0.06, steel);
    for (const y of [0.03, h * 0.5, h - 0.05]) db.box(0, y, 0, span, 0.05, 0.06, steel);
    for (const m of db.build(materials)) g.add(m);
    g.position.set(x, 0, z);
    return g;
  }
  const doorS = panel(cx, L.z1 - 0.06, dh), doorN = panel(cx, L.z0 + 0.06, L.rise - 0.08);
  doorS.position.y = L.bottom; doorN.position.y = L.top;
  group.add(doorS, doorN);

  // ---------- 引擎协议 ----------
  const pit = { x: cx, y: L.bottom, z: cz };
  // 二层下轿点：门外的过厅地板（不是井道里——井道那格 nav 是障碍，落进去就动不了）。
  const approach = { x: cx, y: L.bottom, z: L.z1 + 0.6 };
  // 屋顶上轿点：就是井道中心（在洞口里，站立面由下面的 levels 补），从轿厢直接走出去
  // 就跨到观景台上——引擎爬升末段只会沿 x 把人送到 exit，所以 exit 的 x 必须等于井心。
  const exit = { x: cx, y: L.top, z: cz };
  const ladder = { x: cx, z: cz, bottom: L.bottom, top: L.top, foot: approach, exit, site: 'loft-lift', speed: 2.4 };

  const bounds = new THREE.Box3(new THREE.Vector3(L.x0, 0, L.z0), new THREE.Vector3(L.x1, H, L.z1));
  const point = new THREE.Vector3();

  function ladderAt(x, y, z) {
    if (x < L.x0 + 0.04 || x > L.x1 - 0.04 || z < L.z0 + 0.04 || z > L.z1 - 0.04) return null;
    return y >= L.bottom - 0.2 && y <= L.top + L.rise ? ladder : null;
  }
  function route(ax, ay, az, bx, by, bz) {
    if (Math.abs(by - ay) < 0.6) return [{ x: bx, y: by, z: bz }];   // 同层：直走
    const up = by > ay + 0.5;
    const far = (px, pz) => Math.hypot(bx - px, bz - pz) > 1.2;
    if (up && ay < L.top - 0.6) {
      // 走到门口 → 走进轿厢 → 跟着「升到顶层」那个点一路向上 → 出轿厢上观景台。
      const out = [{ ...approach }, { ...pit }, { ...pit, y: L.top, ladder: true }];
      if (far(pit.x, pit.z)) out.push({ x: bx, y: by, z: bz });   // 上到顶还要继续走去别处
      return out;
    }
    if (!up && ay > L.top - 0.6) {
      const out = [{ ...pit, y: L.top }, { ...pit, y: L.bottom, ladder: true }, { ...approach }];
      if (far(approach.x, approach.z)) out.push({ x: bx, y: by, z: bz });
      return out;
    }
    return [{ x: bx, y: by, z: bz }];
  }

  let cabY = L.bottom, open = 0;
  // 每帧：乘客在轿厢里就贴着人走（进门时落差大就缓缓接人）；空载时回到离玩家最近
  // 的一层；到站且有人在门口才开门。
  function update(dt, player) {
    const riding = !!player && player.island === 'loft-lift';
    const py = player ? player.y : L.top;
    if (riding) {
      const gap = py - cabY;
      cabY += Math.abs(gap) > 1.2 ? gap * Math.min(1, dt * 3.6) : gap;
    } else {
      const stop = Math.abs(py - L.top) < Math.abs(py - L.bottom) ? L.top : L.bottom;
      cabY += (stop - cabY) * Math.min(1, dt * 2.4);
    }
    cab.position.y = cabY;
    const atStop = Math.min(Math.abs(cabY - L.bottom), Math.abs(cabY - L.top)) < 0.25;
    let want = 0;
    if (player && atStop && !riding) {
      const d = Math.hypot(player.pos.x - cx, player.pos.z - cz);
      if (d < 2.6 && Math.min(Math.abs(py - L.bottom), Math.abs(py - L.top)) < 2.2) want = 1;
    }
    open += (want - open) * Math.min(1, dt * 4.5);
    doorS.position.y = L.bottom + open * dh;                 // 二层门往上收进门楣
    doorN.scale.y = Math.max(0.06, 1 - open * 0.94);         // 顶层闸门往下折起来
  }
  update(0, null);

  return {
    group, foot: approach, approach, exit, ladder, ladderAt, route, update,
    // 井道那格楼板是实心的，但 nav 把它标成障碍（stairBlock），所以要在这里补两层
    // 站立面：y=4 站轿厢地板，y=9 站观景台面。
    levels(x, z, out) {
      if (x < L.x0 || x > L.x1 || z < L.z0 || z > L.z1) return;
      out.push({ y: L.bottom, site: 'loft-lift' });
      out.push({ y: L.top, site: 'roof', tread: true });
    },
    // 井道玻璃是实心的，只放行南面二层门与北面顶层门。
    collides(x, feet, z) {
      const r = 0.28;
      if (x + r < L.x0 || x - r > L.x1 || z + r < L.z0 || z - r > L.z1) return false;
      if (feet > H || feet < L.bottom - 1.2) return false;
      if (x > L.x0 + 0.16 && x < L.x1 - 0.16 && z > L.z0 + 0.16 && z < L.z1 - 0.16) return false;
      const door = x > L.doorLoftX0 && x < L.doorLoftX1;
      if (door && feet < L.bottom + 2.45 && z > L.z1 - 0.32) return false;   // 南面二层门
      if (door && feet > L.top - 0.6 && z < L.z0 + 0.32) return false;       // 北面顶层门
      return true;
    },
    pick(ray) {
      if (!ray.intersectBox(bounds, point)) return null;
      return { t: point.distanceTo(ray.origin), point: point.clone(), site: 'loft-lift' };
    },
  };
}
