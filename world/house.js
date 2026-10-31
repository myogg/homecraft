// 房屋外壳：墙体、楼板、屋顶、楼梯、登顶梯，全部用方块搭建。
// 岛屿本体由引擎 terrain.js 的 buildIsland 负责（用本文件的 surfaceAt 决定顶面贴图）。
import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { HOUSE, LOFT, STAIRS, ENTRANCE, ROOF_LADDER, ROOF_SOLID, ROOF_BEAM_STEP, POOL, POOL_DECK, POOL_LADDER, POOL_LAMPS,
  LOFT_STAIR, ROOF_HATCH, STAIR_TOWER } from './layout.js';
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
  // 二层楼梯上来的那两格挖空（ROOF_HATCH），让楼梯穿出屋顶。
  for (let x = x0 - 1; x <= x1; x++) for (let z = z0 - 1; z <= z1; z++) {
    if (inRect(ROOF_HATCH, x, z)) continue;
    const solid = ROOF_SOLID.some(s => inRect(s, x, z));
    const beam = !solid && ((x - (x0 - 1)) % ROOF_BEAM_STEP === 0 || (z - (z0 - 1)) % ROOF_BEAM_STEP === 0);
    grid.set(x, height, z, solid ? 'roof' : beam ? 'beam' : 'glass', 'roof');
    const rim = x === x0 - 1 || x === x1 || z === z0 - 1 || z === z1;
    const gate = x === x1 && z >= ROOF_LADDER.gate0 && z < ROOF_LADDER.gate1;
    if (rim && !gate) grid.set(x, height + 1, z, 'parapet', 'roof');
  }
  // 二层楼板（loft）：只铺北半部，中央楼梯井留空（斜坡从中穿过、光与视线贯通）。
  grid.fill(LOFT.x0, LOFT.y - 1, LOFT.z0, LOFT.x1, LOFT.y, LOFT.z1, 'loft');
  for (let x = STAIRS.x0; x < STAIRS.x1; x++) for (let z = STAIRS.z0; z < STAIRS.z1; z++) grid.set(x, LOFT.y - 1, z, null);
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
  partition(2, -10, 3, -3, [], LY, WALL_H);   // 卫生间东墙，同时是二层楼梯的西墙
  partition(4, -10, 5, -3, [], LY, WALL_H);   // 二层楼梯东墙（次卧西墙）

  // ===== 二层→三层的楼梯塔 =====
  // 楼梯从屋顶穿出，洞口上方砌一座 3×3 的小塔：四面墙 + 实顶，南面敞开当门。
  // 雨落在塔顶上，不会顺洞口灌进楼梯井。
  const T = STAIR_TOWER, capY = T.cap;
  for (let y = height + 1; y < capY; y++) {
    for (let z = T.z0; z < T.z1; z++) {
      grid.set(T.x0, y, z, 'partition', 'tower');                                        // 西墙
      grid.set(T.x1 - 1, y, z, 'partition', 'tower');                                    // 东墙
    }
  }
  for (let x = T.x0; x < T.x1; x++) for (let z = T.z0; z < T.z1; z++) grid.set(x, capY, z, 'roof', 'tower');
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

// 外墙直梯：从地面爬到屋顶观景台（top = ROOF_LADDER.top）。
// 复用 terry-home 的 ladder 范式：ladderAt / route / exit，引擎据此让角色登顶。
export function buildRoofAccess(layer, materials) {
  const group = new THREE.Group(); group.name = 'roof-access';
  const batch = new BoxBatch(layer), steel = { tex: 'steel' }, travertine = { tex: 'travertine' };
  const S = ROOF_LADDER;
  for (const z of [S.z - 0.65, S.z + 0.65]) batch.box(S.x - 0.13, 0, z, 0.09, S.top + 0.2, 0.09, steel, { shadow: false });
  for (let y = 0.3; y < S.top + 0.3; y += 0.34) batch.box(S.x - 0.23, y, S.z, 0.13, 0.085, 1.3, steel, { shadow: false });
  for (const y of [0.6, 4, 8.4]) for (const z of [S.z - 0.65, S.z + 0.65]) batch.box(S.x - 0.07, y, z, 0.24, 0.08, 0.08, steel, { shadow: false });
  batch.box(S.x - 0.3, S.top - 0.14, S.z, 0.6, 0.14, 1.5, travertine, { shadow: false });
  for (const mesh of batch.build(materials)) group.add(mesh);
  const foot = { x: S.x, y: 0, z: S.z }, exit = { x: HOUSE.x1 - 0.65, y: S.top, z: S.z, site: 'roof' };
  const ladder = { x: S.x, z: S.z, bottom: 0, top: S.top, foot, exit, site: 'roof-ladder' };
  const bounds = new THREE.Box3(new THREE.Vector3(S.x - 0.6, 0, S.z - 0.75), new THREE.Vector3(S.x + 0.6, S.top + 0.7, S.z + 0.75));
  const point = new THREE.Vector3();
  function ladderAt(x, y, z) {
    return x >= (y >= S.top - 0.7 ? HOUSE.x1 - 0.7 : S.x - 0.7) && x <= S.x + 0.6 && Math.abs(z - S.z) < 0.85 && y >= -0.1 && y <= S.top + 0.2 ? ladder : null;
  }
  function route(ax, ay, az, bx, by, bz) {
    const up = by > ay;
    if (ay < 0.7 && by < 0.7) return [{ x: bx, y: by, z: bz }];
    if (ay >= S.top - 0.1 && by >= S.top - 0.1) return [{ x: bx, y: by, z: bz }];
    const out = up
      ? [{ ...foot }, { ...foot, y: S.top, ladder: true }, { ...exit }]
      : [{ ...exit }, { ...foot, y: 0, ladder: true }, { ...foot }];
    if (ay > 0.7 && ay < S.top - 0.1) out.shift();
    if (by >= 0.7) out.push({ x: bx, y: by, z: bz });
    return out;
  }
  return {
    group, foot, exit, ladder, ladderAt, route,
    levels(x, z, out) {
      if (x >= HOUSE.x1 - 0.7 && x <= S.x + 0.6 && Math.abs(z - S.z) <= 0.75) out.push({ y: S.top, site: 'roof', tread: true });
    },
    collides(x, feet, z) { return x + 0.3 > HOUSE.x1 - 0.7 && x - 0.3 < S.x + 0.6 && Math.abs(z - S.z) < 1.05 && feet < S.top - 0.02 && feet + 1.8 > S.top - 0.14; },
    pick(ray) {
      if (!ray.intersectBox(bounds, point)) return null;
      return { t: point.distanceTo(ray.origin), point: point.clone(), site: 'roof-ladder' };
    },
  };
}
