// 把世界拼起来：岛屿 + 房屋外壳 + 楼梯 + 登顶梯 + 家具 + 树。
// 引擎在启动时调用一次 build()，返回 batches/planes/obstacles/lights/bakes/hotspots/animated/surfaces/forest/sitesAfter。
import { buildIsland } from '@engine/world/terrain.js';
import { buildForest } from '@engine/world/landscape.js';
import { defineHouseBlocks, surfaceAt, buildShell, buildStairs, buildRoofAccess, buildLoftLift, buildOpenings, buildPool } from './house.js';
import { furnish } from './furnish.js';
import { ISLAND, TREES, LOFT_LIFT } from './layout.js';

// 室内电梯井道在导航网格里记成障碍（只封二层那格）：那一格是电梯实体，不该被
// 当成过厅地板横着穿过去；上下楼一律走电梯自己的 route（sitesAfter 里的 loftLift）。
// 井道南北端都落在格线上，整格封死刚好；站立面由 loftLift.levels 补。
const stairBlock = { x0: LOFT_LIFT.x0, x1: LOFT_LIFT.x1, z0: LOFT_LIFT.z0, z1: LOFT_LIFT.z1, level: 1, noShadow: true };

export function build({ grid, layer, materials, stage }) {
  defineHouseBlocks(grid);
  buildIsland(grid, ISLAND, { surfaceAt });
  buildPool(grid);
  buildShell(grid);
  const forest = buildForest(grid, layer, TREES);
  const furn = furnish({ layer });
  const stairs = buildStairs(layer);
  const openings = buildOpenings(layer);
  const roofAccess = buildRoofAccess(layer, materials);
  stage.scene.add(roofAccess.group);
  const loftLift = buildLoftLift(layer, materials);
  stage.scene.add(loftLift.group);
  return {
    batches: { ...furn.batches, stairs: stairs.batch, openings },
    planes: furn.planes,
    obstacles: [...furn.obstacles, stairBlock],
    lights: furn.lights,
    bakes: furn.lighting,
    hotspots: furn.hotspots,
    animated: furn.animated,
    surfaces: furn.surfaces,
    forest,
    sitesAfter: [roofAccess, loftLift],
    named: { roofAccess, loftLift },
  };
}
