// 「我的家」：两层小楼 + 顶部露天观景台（按你的户型要求）。
// 1 block = 1 m。x 朝东、z 朝南（看海）、y 朝上。地面 y = 0。
//
// 楼层：  一层（y 0~4，南半部挑高到屋顶）客厅 / 书房 / 厨房 / 卫生间 / 衣帽间
//         二层（y 4~8，北半部楼板）两间卧室 + 一个卫生间（loft）
//         屋顶（y 8 起）观景台：围栏 + 凳子 + 遮阳伞，靠外墙梯子上下
//
// 行走规则（引擎约定，与 terry-home 相同）：
//   - 寻路网格每个 (x,z) 只有一个可走高度，来自 floorAt：
//     南半部一层 0 → 中央楼梯斜坡 → 北半部二层 4；
//   - 屋顶由引擎 heights.levels 自动识别为可站立面，靠东侧外墙梯子登顶。

// 浮空小岛边界（草地在边缘内，外面是海）。
export const ISLAND = { x0: -36, x1: 38, z0: -26, z1: 31 };

// 房屋外轮廓（墙占最外一圈格子）。屋高 8 m。
export const HOUSE = { x0: -12, x1: 12, z0: -10, z1: 10, height: 8 };

// 二层楼板：只盖北半部（z[-10,0)），南半部是挑高的客厅/门厅。
export const LOFT = { x0: HOUSE.x0, x1: HOUSE.x1, z0: HOUSE.z0, z1: 0, y: 4 };

// 中央直跑楼梯井：从一层（z=6）向北上升到二层（z=-2），floorAt 在 z 方向做斜坡。
export const STAIRS = { x0: -2, x1: 2, z0: -2, z1: 6 };

// 屋顶观景台用的外墙直梯（东侧外墙外，离墙≥1.5m 以免梯脚落入墙体阻挡格），登顶后步入屋顶。
export const ROOF_LADDER = { x: 13.5, z: 7.5, top: 9, gate0: 6.5, gate1: 8.5 };

// 屋顶几块玻璃天窗，给室内采光（其余为实心屋顶可行走）。
export const ROOF_GLASS = [
  { x0: -9, x1: -3, z0: -6, z1: 0 },
  { x0: 3, x1: 9, z0: -6, z1: 0 },
  { x0: -9, x1: -3, z0: 3, z1: 8 },
  { x0: 3, x1: 9, z0: 3, z1: 8 },
];

// 入户门洞（南墙正中，宽 4 m，高 3 m）。
export const ENTRANCE = { x0: -2, x1: 2 };

// 室外：岛南草地的信箱与传送门（保留，留言/串门用）。
export const MAILBOX = { x: 7, z: 22, yaw: 0 };
export const PORTAL = { x: -8, z: 22, yaw: Math.PI };

// 出生点：岛南草地，面朝北（heading π）走向家门。
export const SPAWN = { x: 0.5, z: 18, heading: Math.PI };
export const EXIT = { x: 0.5, z: 13 };
export const DOORWAY = [{ x: 0.5, y: 1, z: 11 }, { x: 0.5, y: 1.2, z: 14 }];

// 几棵树点缀岛的四周，避开房屋（x∈[-12,12], z∈[-10,10]）。
export const TREES = [[28, 22], [-28, 20], [30, -6], [-30, -8], [24, 27],
  [-24, 25], [4, 28], [-13, 27], [15, 25], [-20, 18], [30, 14], [-30, 12]];

// 站点：走近会提示、点 Dock 弹出对应页面（id 需与 index.html 的 data-station 对应）。
// at 是角色站位（两元素 [x,z]）、look 是朝向；floor 标记所在楼层（提示用）。
// deck 的 at 在梯脚：传送过去后向前走即可自动攀爬登顶；show 是打开页面时的取景镜头。
export const STATIONS = [
  // 客厅：沙发与西墙电视之间。
  { id: 'about', name: '客厅', en: 'Living room', at: [-7, 3], look: [-11, 3] },
  // 书房：书桌前。
  { id: 'works', name: '书房', en: 'Study', at: [7, 3.8], look: [7, 1.5] },
  // 厨房：中岛旁。
  { id: 'kitchen', name: '厨房', en: 'Kitchen', at: [4.8, 8.8], look: [7, 6.5] },
  // 一层卫生间（西南角，门朝北）。
  { id: 'bath', name: '卫生间', en: 'Bathroom', at: [-10.5, 5.2], look: [-10.5, 8.5] },
  // 衣帽间（卫生间东侧，门朝北）。
  { id: 'cloak', name: '衣帽间', en: 'Cloakroom', at: [-7.5, 5.2], look: [-7.5, 8.5] },
  // 二层主卧（在二层楼板上）。
  { id: 'bedroom', name: '主卧', en: 'Bedroom', at: [-7, -1.2], look: [-7, -5.5], floor: LOFT.y },
  // 二层次卧。
  { id: 'bedroom2', name: '次卧', en: 'Second bedroom', at: [7, -1.2], look: [7, -5.5], floor: LOFT.y },
  // 观景台：先到梯脚，向前走即自动爬梯登顶。
  { id: 'deck', name: '观景台', en: 'Observation deck', at: [13.5, 7.5], look: [11, 7.5],
    show: [[22, 15, 26], [0, 9.5, 0]], showPortrait: [[34, 24, 38], [0, 9.5, 0]] },
  // 信箱（按 F 留言，未配 Worker 时调起访客邮件 App）。
  { id: 'mailbox', name: '留言', en: 'Mailbox', icon: 'mail', at: [MAILBOX.x, MAILBOX.z + 1.2], look: [MAILBOX.x, MAILBOX.z] },
  // 传送门。
  { id: 'portal', name: '传送门', en: 'Portal', icon: 'portal', at: [PORTAL.x + Math.sin(PORTAL.yaw) * 2.4, PORTAL.z + Math.cos(PORTAL.yaw) * 2.4], look: [PORTAL.x, PORTAL.z] },
];

const inside = (r, x, z) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
export const inHouse = (x, z) => inside(HOUSE, x, z);
export const onLoft = (x, z) => inside(LOFT, x, z);
export const onStairs = (x, z) => inside(STAIRS, x, z);

// 脚下高度：楼梯井做 0→LOFT.y 的线性斜坡（先判楼梯，它穿过楼板南缘），
// 二层楼板范围恒为 LOFT.y，其余（含南半部一层）为 0。
export function floorAt(x, z) {
  if (onStairs(x, z)) return Math.max(0, Math.min(LOFT.y, (STAIRS.z1 - z) * (LOFT.y / (STAIRS.z1 - STAIRS.z0))));
  if (onLoft(x, z)) return LOFT.y;
  return 0;
}

// 屋顶观景台：在房屋范围内、最顶实心块之上即作为可站立面（引擎自动处理）。
export function roofAt(x, z) {
  return inHouse(x, z) ? ROOF_LADDER.top : 0;
}

// 屋内铺木地板，屋外草地。
export function surfaceAt(x, z) {
  if (inHouse(x, z)) return 'wood_floor';
  return 'grass';
}

// 烘焙光照体积：覆盖整栋房子（含二层与屋顶）。
export const LIGHT_VOLUME = { min: [HOUSE.x0 - 2, -1, HOUSE.z0 - 2], extent: [(HOUSE.x1 - HOUSE.x0) + 4, 14, (HOUSE.z1 - HOUSE.z0) + 4], size: [(HOUSE.x1 - HOUSE.x0) + 4, 18, (HOUSE.z1 - HOUSE.z0) + 4] };
// 天气遮蔽图：覆盖岛与海。
export const SHELTER = { x0: -40, z0: -30, w: 80, d: 64 };

// 开场镜头：高空俯瞰全岛与两层小楼，看向房屋中心。
export const INTRO = { pos: [42, 34, 54], portrait: [70, 56, 84], look: [0, 2, 0] };
