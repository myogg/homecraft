// 把世界拼起来：岛屿 + 房屋外壳 + 楼梯 + 登顶梯 + 家具 + 树。
// 引擎在启动时调用一次 build()，返回 batches/planes/obstacles/lights/bakes/hotspots/animated/surfaces/forest/sitesAfter。
import { buildIsland } from '@engine/world/terrain.js';
import { buildForest } from '@engine/world/landscape.js';
import { defineHouseBlocks, surfaceAt, buildShell, buildStairs, buildRoofAccess, buildOpenings, buildPool } from './house.js';
import { furnish } from './furnish.js';
import { buildLoftStair } from './loft-stair.js';
import { ISLAND, TREES } from './layout.js';

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
    obstacles: furn.obstacles,
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
