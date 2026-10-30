// 房屋外壳：墙体、楼板、屋顶、楼梯、登顶梯，全部用方块搭建。
// 岛屿本体由引擎 terrain.js 的 buildIsland 负责（用本文件的 surfaceAt 决定顶面贴图）。
import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { HOUSE, LOFT, STAIRS, ENTRANCE, ROOF_LADDER, ROOF_GLASS } from './layout.js';
import { inRect } from '@engine/world/terrain.js';

const SHELL = { x0: HOUSE.x0 - 1, x1: HOUSE.x1 + 1, z0: HOUSE.z0 - 1, z1: HOUSE.z1 + 1 };

// 上下两层窗带（地面层 y=1,2；二层 y=5,6）+ 入户门（南墙正中，高 3 m）。
const GLASS_BAND = new Set([1, 2, 5, 6]);

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
}

// 屋内铺木地板、屋外草地。
export function surfaceAt(x, z) {
  return inRect(SHELL, x, z) ? 'wood_floor' : 'grass';
}

// 搭建外壳：四壁（窗带+门）、屋顶+围栏、北半部二层楼板（避开楼梯井）、
// 楼板下的实体基座、一层与二层隔墙。
export function buildShell(grid) {
  const { x0, x1, z0, z1, height } = HOUSE;
  const cell = (x, y, z, door) => door ? null : (GLASS_BAND.has(y) ? 'glass' : 'wall');
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
  // 屋顶：实心屋顶（可行走的观景台）+ 几块玻璃天窗；四周 1 m 高围栏，东侧留梯口。
  for (let x = x0 - 1; x <= x1; x++) for (let z = z0 - 1; z <= z1; z++) {
    const sky = ROOF_GLASS.some(s => inRect(s, x, z));
    grid.set(x, height, z, sky ? 'glass' : 'roof', 'roof');
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
  const partition = (x0p, z0p, x1p, z1p, doors, yBase = 0, h = 3) => {
    for (let y = yBase; y < yBase + h; y++) for (let x = x0p; x < x1p; x++) for (let z = z0p; z < z1p; z++) {
      const door = doors.some(d => x + 0.5 >= d.x0 && x + 0.5 < d.x1 && z + 0.5 >= d.z0 && z + 0.5 < d.z1);
      grid.set(x, y, z, door ? null : 'partition', 'partition');
    }
  };
  // 一层西南角：卫生间与衣帽间（北墙各留 2 m 门洞，中间实体隔墙）。
  partition(-12, 6, -6, 7, [{ x0: -11.5, z0: 6, x1: -9.5, z1: 7 }, { x0: -8.6, z0: 6, x1: -6.4, z1: 7 }]);
  partition(-9, 6, -8, 10, []);
  // 二层：两卧室之间的卫生间（x[-3,3) z[-10,-5)），南墙留门朝楼梯平台。
  partition(-3, -5, 3, -4, [{ x0: -1, z0: -5, x1: 1, z1: -4 }], LOFT.y, 3);
  partition(-3, -10, -2, -5, [], LOFT.y, 3);
  partition(2, -10, 3, -5, [], LOFT.y, 3);
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
