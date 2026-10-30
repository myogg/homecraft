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
// 位置偏到西侧（x[-7,-3]），进门不再正对楼梯——楼梯在左手边，中庭敞开。
export const STAIRS = { x0: -7, x1: -3, z0: -2, z1: 6 };

// 宠物：两只猫 + 一条狗，屋里屋外（地面层 + 院子，不出岛、不下水）自由走动。
// 引擎按 PETS.list 逐只生成；anchors 是游荡点（第一个为出发点 hub），home 为初始睡觉点。
// within 不限制，靠引擎 nav 自动避开泳池与岛外——宠物只在可站立的地面层活动。
export const PETS = {
  list: [
    { kind: 'cat', key: 'cat', seed: 1989,
      anchors: [[0.5, 8], [9, 2], [9, 9], [-13, 16], [14, 18]],
      home: [0.5, 8] },
    { kind: 'cat', key: 'cat2', seed: 7143,
      anchors: [[-1.2, 5.5], [0.5, 13], [-12, 22], [14, 16], [0.5, 12]],
      home: [-1.2, 5.5] },
    { kind: 'dog', key: 'dog', seed: 2525,
      anchors: [[0.5, 13], [14, 18], [-13, 16], [0.5, 8], [9, 9], [-1, 22]],
      home: [0.5, 13] },
  ],
};

// 屋顶观景台用的外墙直梯（东侧外墙外，离墙≥1.5m 以免梯脚落入墙体阻挡格），登顶后步入屋顶。
export const ROOF_LADDER = { x: 13.5, z: 7.5, top: 9, gate0: 6.5, gate1: 8.5 };

// 屋顶观景台：把屋顶面本身改成玻璃（横梁分隔）。放桌椅 / 遮阳伞的正下方
// 留实心（ROOF_SOLID，从 furnish.js 的凳子/遮阳伞坐标取），其余铺玻璃；
// 横梁（dark metal）按 ROOF_BEAM_STEP 间距、沿 x 与 z 两向成网格，把玻璃
// 分隔成采光格。从屋里抬头看天、站在玻璃处低头看楼下。
export const ROOF_SOLID = [
  { x0: -10, x1: -6, z0: -8, z1: -4 },   // (-8,-6) 凳 + 遮阳伞
  { x0: 6, x1: 10, z0: -8, z1: -4 },     // (8,-6) 凳
  { x0: -10, x1: -6, z0: 4, z1: 8 },     // (-8,6) 凳
  { x0: 6, x1: 10, z0: 4, z1: 8 },       // (8,6) 凳 + 遮阳伞
  { x0: -2, x1: 2, z0: -2, z1: 2 },      // (0,0) 凳
];
export const ROOF_BEAM_STEP = 4;

// 入户门洞（南墙正中，宽 4 m，高 3 m）。
export const ENTRANCE = { x0: -2, x1: 2 };

// 泳池：岛南草坪、紧邻房屋西侧。池底 bed、水面 water 略低于地坪 0（露台/甲板在 0）。
// 引擎 pool.js 据此自动生成水面、支持游泳；blocks.js 着色器把池壁/池底染成带焦散的蓝光。
export const POOL = { x0: -10, x1: -1, z0: 14, z1: 21, water: -0.22, bed: -3 };
// 池边石材平台（比泳池各大 1 m），作为露台/甲板，绕过泳池即草地。
export const POOL_DECK = { x0: POOL.x0 - 1, x1: POOL.x1 + 1, z0: POOL.z0 - 1, z1: POOL.z1 + 1 };
// 泳池出入梯（房屋侧北缘，沿 x 的一段），游到此处可爬出水面。
export const POOL_LADDER = { x0: -4, x1: -2, z: POOL.z0 + 0.3 };
// 池壁低处的夜灯（沿北缘），夜间映亮水面（光照由方块/水面着色器计算）。
export const POOL_LAMPS = { xs: [-8, -5, -2], y: -1.21 };
export const inPool = (x, z) => x >= POOL.x0 && x < POOL.x1 && z >= POOL.z0 && z < POOL.z1;

// 外墙窗洞：墙只在下列矩形内开玻璃窗，其余一律实墙——这样四面是墙、不是
// 玻璃盒子。x0..x1 / z0..z1 是墙格范围（墙厚 1 格），y0..y1 是高度范围：
// 一层窗 y1..3（窗台离地 1 m），二层窗 y5..7（离二层地面 1 m）。南墙中央的
// 入户门在 ENTRANCE，所有窗都避开它；北半部一层是实心基座，故不在此开窗。
export const WINDOWS = [
  // 南墙（z = z1 = 10，朝海）
  { x0: -11, x1: -9, z0: 10, z1: 11, y0: 1, y1: 3 },   // 一层 门西
  { x0: 9, x1: 11, z0: 10, z1: 11, y0: 1, y1: 3 },     // 一层 门东
  { x0: -7, x1: -4, z0: 10, z1: 11, y0: 5, y1: 7 },    // 挑高客厅 高窗（西）
  { x0: 4, x1: 7, z0: 10, z1: 11, y0: 5, y1: 7 },      // 挑高客厅 高窗（东）
  // 西墙（x = x0 - 1 = -13）
  { x0: -13, x1: -12, z0: 1, z1: 3, y0: 1, y1: 3 },    // 一层 客厅
  { x0: -13, x1: -12, z0: 6, z1: 8, y0: 1, y1: 3 },    // 一层 卫生间
  { x0: -13, x1: -12, z0: 2, z1: 5, y0: 5, y1: 7 },    // 挑高客厅 高窗
  { x0: -13, x1: -12, z0: -9, z1: -7, y0: 5, y1: 7 },  // 二层 主卧
  { x0: -13, x1: -12, z0: -4, z1: -2, y0: 5, y1: 7 },  // 二层 主卧
  // 东墙（x = x1 = 12）
  { x0: 12, x1: 13, z0: 1, z1: 3, y0: 1, y1: 3 },      // 一层 厨房
  { x0: 12, x1: 13, z0: 6, z1: 8, y0: 1, y1: 3 },      // 一层 厨房
  { x0: 12, x1: 13, z0: 2, z1: 5, y0: 5, y1: 7 },      // 挑高客厅 高窗
  { x0: 12, x1: 13, z0: -9, z1: -7, y0: 5, y1: 7 },    // 二层 次卧
  { x0: 12, x1: 13, z0: -4, z1: -2, y0: 5, y1: 7 },    // 二层 次卧
  // 北墙（z = z0 - 1 = -11）
  { x0: -10, x1: -8, z0: -11, z1: -10, y0: 5, y1: 7 }, // 二层 主卧
  { x0: -1, x1: 1, z0: -11, z1: -10, y0: 5, y1: 7 },   // 二层 卫生间
  { x0: 6, x1: 8, z0: -11, z1: -10, y0: 5, y1: 7 },    // 二层 次卧
];

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
  { id: 'about', name: '客厅', en: 'Living room', at: [-1, 3], look: [-11, 3] },
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
