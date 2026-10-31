// 把世界拼起来：岛屿 + 房屋外壳 + 楼梯 + 登顶梯 + 家具 + 树。
// 引擎在启动时调用一次 build()，返回 batches/planes/obstacles/lights/bakes/hotspots/animated/surfaces/forest/sitesAfter。
import { buildIsland } from '@engine/world/terrain.js';
import { buildForest } from '@engine/world/landscape.js';
import { defineHouseBlocks, surfaceAt, buildShell, buildStairs, buildRoofAccess, buildOpenings, buildPool } from './house.js';
import { furnish } from './furnish.js';
import { buildLoftStair } from './loft-stair.js';
import { ISLAND, TREES, LOFT_STAIR } from './layout.js';

// 二层窄楼梯在导航网格里记成障碍（只封二层那格）：那一格是楼梯实体，不该被
// 当成过厅地板横着穿过去；上下楼一律走楼梯自己的踏面（sitesAfter 里的 loftStair）。
// 南端收进 0.2 m，只封真正的踏步，别把楼梯口的起步平台也堵上。
const stairBlock = { x0: LOFT_STAIR.x0, x1: LOFT_STAIR.x1, z0: LOFT_STAIR.z0, z1: LOFT_STAIR.z1 - 0.2, level: 1, noShadow: true };

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
  const loftStair = buildLoftStair(layer, materials);
  stage.scene.add(loftStair.group);
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
    sitesAfter: [roofAccess, loftStair],
    named: { roofAccess, loftStair },
  };
}
