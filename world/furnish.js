// 家具与陈设：一层客厅/书房/厨房/卫生间/衣帽间，二层两卧室+卫生间，屋顶观景台。
// 全部静态合批；电视/电脑屏用 canvas 贴图 + 自发光平面（glow），未接渲染管线也能直接显示画面。
import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { canvasTexture } from '@engine/world/textures.js';
import { HOUSE, LOFT, STAIRS, ROOF_LADDER, MAILBOX, POOL, POOL_LADDER, POOL_LAMPS } from './layout.js';
import { buildFloorPlants } from './plants.js';

const L = {
  wood: { tex: 'wood_panel' }, floor: { tex: 'greige_floor' },
  panel: { tex: 'wood_panel' }, marble: { tex: 'prada_marble' },
  steel: { tex: 'steel' }, plaster: { tex: 'plaster' }, linen: { tex: 'linen' },
  books: { tex: 'bookshelf', top: 'wood_panel' },
  paint: tint => ({ tex: 'paint', tint }),
  light: (tint, emissive = 1) => ({ tex: 'paint', tint, emissive }),
};

export function furnish({ layer }) {
  const B = new BoxBatch(layer);
  const batches = { static: B, wallN: new BoxBatch(layer), wallS: new BoxBatch(layer), wallE: new BoxBatch(layer), wallW: new BoxBatch(layer) };
  const obstacles = [], lights = [], lighting = [], hotspots = [], planes = [], animated = {}, surfaces = {};
  const bake = (id, x, y, z, power, radius, direction = null) => lighting.push({ id, position: [x, y, z], power, radius, direction });
  // 障碍 level：0 挡一层（nav 高度 < 2 的格子），1 挡二层（nav 高度 ≥ 2 的格子）。
  const foot = (x, z, w, d, level = 0) => obstacles.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, level });
  const hot = (id, x, y, z, w, h, d) => hotspots.push({ id, box: new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)) });
  const plane = (w, h, tex, x, y, z, ry = 0, glow = false, rx = 0) => {
    const mat = glow ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, 0, 'YXZ');
    mesh.receiveShadow = !glow; planes.push(mesh); return mesh;
  };
  const paint = (w, h, fn) => canvasTexture(w, h, fn);
  // 吊灯：杆从 y+0.62 直上屋顶（HOUSE.height），灯体挂在 y 处。
  const pendant = (x, z, y) => {
    B.box(x, y + 0.62, z, 0.04, HOUSE.height - y - 0.62, 0.04, L.steel);
    for (const dx of [-0.19, 0.19]) for (const dz of [-0.19, 0.19]) B.box(x + dx, y, z + dz, 0.035, 0.62, 0.035, L.steel);
    for (const dy of [0, 0.58]) B.box(x, y + dy, z, 0.42, 0.04, 0.42, L.steel);
    B.box(x, y + 0.06, z, 0.3, 0.48, 0.3, L.light(0xffdfa8));
    bake('pendant', x, y + 0.2, z, 3.2, 13, [0, -1, 0]);
  };
  const ly = LOFT.y;
  // 床（二层用）：床头朝北（-z），两侧床头柜 + 暖光灯；障碍 level 1。
  // stands 可只给一侧，窄房间靠墙放床时不穿墙。
  const bed = (x, y, z, stands = [-2.1, 2.1]) => {
    B.box(x, y, z, 3.2, 0.3, 4, L.linen);                    // 床垫
    B.box(x, y + 0.3, z - 1.4, 3.0, 0.5, 1.2, L.paint(0xf2efe9)); // 被褥
    B.box(x, y + 0.8, z - 1.6, 2.6, 0.25, 0.8, L.paint(0xe7e2d8)); // 枕头
    B.box(x, y, z - 1.9, 3.4, 1.4, 0.25, L.panel);           // 床背（床头一侧）
    foot(x, z, 5.2, 4.4, 1);
    for (const sx of stands) {
      B.box(x + sx, y, z - 1.4, 0.8, 0.6, 0.8, L.panel);     // 床头柜
      B.box(x + sx, y + 0.6, z - 1.4, 0.86, 0.05, 0.86, L.marble);
      B.box(x + sx, y + 0.65, z - 1.4, 0.2, 0.3, 0.2, L.light(0xffdfa8));
    }
    bake('bed-lamp', x, y + 1, z - 1.4, 1.2, 4, [0, -1, 0]);
  };
  // 人体工学椅：ry=0 时椅背在 +z（南），人面朝北（-z）看桌与显示器。
  const ergonomicChair = (x, z, ry) => {
    const black = L.paint(0x1c1f21), mesh = { tex: 'chair_mesh' };
    B.at(x, 0, z, ry, () => {
      for (let i = 0; i < 5; i++) B.at(0, 0, 0, i * Math.PI * 2 / 5, () => {
        B.box(0, 0.12, 0.18, 0.07, 0.065, 0.4, L.paint(0x747b7c)); B.box(0, 0.025, 0.36, 0.13, 0.1, 0.1, L.steel);
      });
      B.box(0, 0.15, 0, 0.09, 0.33, 0.09, L.paint(0x8d9799));
      B.box(0, 0.47, 0, 0.58, 0.1, 0.55, black); B.box(0, 0.53, 0.27, 0.52, 0.67, 0.065, mesh, { rx: -0.1 });
      for (const cx of [-0.28, 0.28]) B.box(cx, 0.52, 0.28, 0.04, 0.72, 0.07, L.steel, { rx: -0.1 });
      B.box(0, 0.75, 0.3, 0.42, 0.12, 0.11, black);
      for (const cx of [-0.36, 0.36]) { B.box(cx, 0.5, 0.08, 0.045, 0.23, 0.05, L.paint(0x747b7c)); B.box(cx, 0.72, 0, 0.09, 0.04, 0.36, black); }
    });
  };
  // 二层栏杆段（轴对齐）：上下两道横杆 + 立柱，障碍 level 1。
  const rail = (x0, z0, x1, z1) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const alongX = w >= d;
    for (const y of [ly + 0.45, ly + 0.88]) B.box(cx, y, cz, alongX ? w : 0.06, 0.06, alongX ? 0.06 : d, L.steel);
    const posts = Math.max(2, Math.round((alongX ? w : d) / 2.2) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      B.box(alongX ? x0 + (x1 - x0) * t : cx, ly, alongX ? cz : z0 + (z1 - z0) * t, 0.06, 0.9, 0.06, L.steel);
    }
    foot(cx, cz, w + 0.25, d + 0.25, 1);
  };

  // 屏幕画面：电视（山海夜景）与显示器（代码雨）。
  const tvPaint = (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2a4a'); g.addColorStop(1, '#0a1020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(w * 0.72, h * 0.32, h * 0.12, 0, 7); ctx.fill();
    ctx.fillStyle = '#16324a'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.32, h * 0.55); ctx.lineTo(w * 0.52, h); ctx.fill();
    ctx.fillStyle = '#1d4a3a'; ctx.beginPath(); ctx.moveTo(w * 0.4, h); ctx.lineTo(w * 0.66, h * 0.5); ctx.lineTo(w * 0.92, h); ctx.fill();
    ctx.fillStyle = '#e8eef2'; ctx.font = `${Math.round(h * 0.12)}px sans-serif`; ctx.fillText('▶ 正在播放', w * 0.06, h * 0.2);
  };
  const monitorPaint = (ctx, w, h) => {
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, w, h);
    const colors = ['#79c0ff', '#7ee787', '#ffa657', '#d2a8ff', '#ff7b72'];
    ctx.font = `${Math.round(h * 0.07)}px monospace`;
    for (let i = 0; i < 11; i++) { ctx.fillStyle = colors[i % colors.length]; ctx.fillText('const ' + 'home'.repeat(1 + (i % 3)) + ' = craft();', w * 0.04, h * (0.12 + i * 0.075)); }
  };
  // 角落电脑桌：桌面 + 钢腿 + 显示器（画面朝 +z/南，观者站在南侧）。
  const deskComp = (x, z, ry) => B.at(x, 0, z, ry, () => {
    B.box(0, 1.05, 0, 2.4, 0.08, 0.9, L.panel);
    for (const lx of [-1.05, 1.05]) B.box(lx, 0, 0, 0.1, 1.05, 0.1, L.steel);
    plane(1.7, 1.0, paint(420, 250, monitorPaint), 0, 1.95, -0.2, ry, true);
    B.box(0, 1.1, 0.25, 1.7, 0.06, 0.1, L.steel);
  });

  // ===== 一层：客厅（门厅中庭，沙发东移避开门轴与西侧楼梯）=====
  B.box(-9.25, 0, 3, 3.5, 0.025, 5.6, L.linen);            // 地毯（收到楼梯西侧）
  const sofaX = -1.0, sofaZ = 3;
  B.box(sofaX, 0.08, sofaZ, 1, 0.48, 4, L.paint(0x1c1e20));
  B.box(sofaX + 0.45, 0.48, sofaZ, 0.2, 0.62, 4, L.paint(0x1c1e20));
  for (const z of [sofaZ - 1.7, sofaZ + 1.7]) B.box(sofaX, 0.08, z, 1, 0.65, 0.2, L.paint(0x1c1e20));
  foot(sofaX, sofaZ, 1.2, 4.2); hot('about', sofaX, 0, sofaZ, 1.4, 1.2, 4.2);
  B.box(sofaX - 0.6, 0, sofaZ, 1.4, 0.45, 2.2, L.marble); foot(sofaX - 0.6, sofaZ, 1.5, 2.3); // 茶几
  // 电视（西墙，画面朝东）。
  B.box(-11.06, 1.1, sofaZ, 0.1, 2.3, 3.6, L.steel);       // 墙托
  B.box(-11.0, 0.9, sofaZ, 0.06, 2.7, 4, L.paint(0x0a0a0a));
  plane(3.4, 1.95, paint(680, 390, tvPaint), -10.9, 2.1, sofaZ, Math.PI / 2, true);
  bake('tv', -10.7, 2.1, sofaZ, 1.4, 6, [1, -0.4, 0]);
  // 落地灯与吊灯（挪到沙发东侧，避开西侧楼梯）。
  B.box(1.5, 0, 5.4, 0.5, 0.055, 0.5, L.steel); B.box(1.5, 0.055, 5.4, 0.065, 1.72, 0.065, L.steel);
  B.box(1.5, 1.75, 5.4, 0.7, 0.25, 0.7, L.linen); B.box(1.5, 1.728, 5.4, 0.56, 0.025, 0.56, L.light(0xffe4ba));
  foot(1.5, 5.4, 0.55, 0.55); bake('living-lamp', 1.5, 1.72, 5.4, 1.05, 5.8, [0, -1, 0]);
  pendant(0, 3, 5.6);
  // 客厅电脑（北墙基座前的书桌 + 显示器，观者从南侧看屏幕）。
  deskComp(-10, 0.9, 0); foot(-10, 0.9, 2.5, 1);

  // ===== 一层：书房（东南，x[2,12] z[0,4]）=====
  B.box(11.66, 0, 2, 0.45, 3.4, 3.6, L.books);             // 东墙通顶书架
  foot(11.66, 2, 0.55, 3.7);
  for (let i = 0; i < 7; i++) B.box(11.58, 0.4 + i * 0.42, 2, 0.22, 0.04, 3.4, L.wood); // 隔板
  // 书房：长桌 + 多屏拼接（3×2 显示器墙，画面朝南）+ 多台主机 + 椅。
  B.at(7, 0, 1.5, 0, () => {
    B.box(0, 1.05, 0, 5.4, 0.08, 1.3, L.panel);              // 桌面
    for (const lx of [-2.5, 2.5]) B.box(lx, 0, 0, 0.12, 1.05, 0.12, L.steel);
    const cols = 3, rows = 2, mw = 1.45, mh = 0.82, gp = 0.1;   // 多屏拼接
    const span = cols * mw + (cols - 1) * gp, x0 = -span / 2 + mw / 2, baseY = 1.5;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const mx = x0 + c * (mw + gp), my = baseY + r * (mh + gp);
      B.box(mx, my, -0.42, mw + 0.07, mh + 0.07, 0.06, L.paint(0x0d0f12));   // 显示器边框
      plane(mw, mh, paint(360, 210, monitorPaint), mx, my, -0.39, 0, true);    // 屏幕（代码雨）
    }
    B.box(0, 1.18, -0.5, span + 0.3, 0.06, 0.12, L.steel);                   // 支架横梁
  });
  foot(7, 1.5, 5.5, 1.4);
  for (const tx of [-2.4, 0, 2.4]) { B.box(tx, 0.5, 1.2, 0.5, 1.0, 0.9, L.paint(0x2a2f33)); B.box(tx, 0.04, 1.2, 0.54, 0.04, 0.94, L.steel); }
  foot(7, 1.2, 5.4, 1.5);
  ergonomicChair(7, 3.0, 0); foot(7, 3.0, 0.85, 0.85);      // 椅面朝北，对着桌子与多屏
  bake('study', 7, 2.4, 1.5, 1.8, 7, [0, -1, 0]);

  // ===== 一层：厨房（东南，x[2,12] z[4,10]）=====
  B.box(11.35, 0, 7, 1.1, 0.9, 5, L.steel);                 // 东墙操作台
  B.box(11.35, 0.9, 7, 1.2, 0.1, 5.2, L.marble); foot(11.35, 7, 1.3, 5.3);
  B.box(11.35, 0.95, 5.6, 0.6, 0.02, 1.0, L.paint(0x556b70)); // 水槽
  B.box(11.35, 0.97, 5.6, 0.42, 0.01, 0.85, L.steel); B.box(11.1, 1.4, 5.6, 0.4, 0.05, 0.07, L.steel);
  for (const dx of [-0.18, 0.18]) for (const dz of [-0.32, 0.32]) B.box(11.35 + dx, 0.95, 8.4 + dz, 0.26, 0.02, 0.24, L.steel); // 灶
  B.box(11.55, 2.2, 8.4, 0.7, 0.5, 2.1, L.steel);           // 抽油烟机
  B.box(3.1, 0, 9.3, 1.2, 2.4, 1.1, L.steel); foot(3.1, 9.3, 1.3, 1.2); // 冰箱
  B.box(3.1, 1.1, 8.72, 0.5, 0.05, 0.06, L.steel);
  B.box(7, 0, 7.2, 3.6, 0.9, 1.4, L.steel);                 // 中岛
  B.box(7, 0.9, 7.2, 3.8, 0.12, 1.5, L.marble); foot(7, 7.2, 3.9, 1.6);
  B.box(7, 2.75, 7.2, 0.025, HOUSE.height - 2.75, 0.025, L.steel, { shadow: false });
  B.box(7, 2.66, 7.2, 1.65, 0.09, 0.22, L.steel);
  B.box(7, 2.637, 7.2, 1.48, 0.025, 0.15, L.light(0xffe4ba)); bake('island-pendant', 7, 2.62, 7.2, 1.45, 5, [0, -1, 0]);

  // ===== 一层：餐厅（厨房北侧空地，x[3,6] z[4,7]）=====
  const diningChair = (x, z, ry) => B.at(x, 0, z, ry, () => {
    for (const dx of [-0.22, 0.22]) for (const dz of [-0.22, 0.22]) B.box(dx, 0, dz, 0.05, 0.45, 0.05, L.steel);
    B.box(0, 0.45, 0, 0.5, 0.06, 0.5, L.wood); B.box(0, 0.86, 0.22, 0.5, 0.5, 0.06, L.wood);
  });
  B.box(4.6, 0, 5.4, 1.9, 0.08, 1.0, L.marble); foot(4.6, 5.4, 2.0, 1.1);
  for (const dx of [-0.9, 0.9]) for (const dz of [-0.55, 0.55]) B.box(4.6 + dx, 0, 5.4 + dz, 0.06, 0.78, 0.06, L.steel);
  diningChair(4.6, 4.6, 0); diningChair(4.6, 6.2, Math.PI); diningChair(3.6, 5.4, -Math.PI / 2); diningChair(5.6, 5.4, Math.PI / 2);
  bake('dining', 4.6, 1.6, 5.4, 1.4, 5, [0, -1, 0]);

  // ===== 一层：卫生间（西南，x[-12,-9] z[7,10]，门朝北）=====
  B.box(-10.5, 0, 8.5, 2.8, 0.1, 2.8, L.paint(0xeef1f2));   // 地砖
  B.box(-11.62, 0, 8.5, 0.55, 0.5, 1.5, L.paint(0xf4f6f7)); // 马桶水箱
  B.box(-11.3, 0.5, 8.5, 0.75, 0.45, 0.85, L.paint(0xf4f6f7)); foot(-11.35, 8.5, 1, 1.6);
  B.box(-9.75, 0, 7.75, 1.3, 0.12, 1.3, L.paint(0x9cc4d6)); // 淋浴房（东北角）
  B.box(-9.25, 0.12, 7.25, 0.06, 1.9, 0.06, L.steel); B.box(-9.25, 2.0, 7.5, 0.22, 0.05, 0.22, L.steel);
  foot(-9.75, 7.75, 1.4, 1.4);
  B.box(-10.4, 0, 9.55, 1.2, 0.9, 0.6, L.marble);           // 洗脸台（南墙）
  B.box(-10.4, 0.9, 9.55, 1.3, 0.1, 0.7, L.marble); foot(-10.4, 9.55, 1.4, 0.8);
  B.box(-10.4, 1.0, 9.45, 0.5, 0.18, 0.4, L.steel); B.box(-10.4, 1.6, 9.88, 0.6, 0.8, 0.05, L.paint(0xbfe0e8));
  bake('bath', -10.5, 2.6, 8.5, 1.6, 5, [0, -1, 0]);

  // ===== 一层：衣帽间（卫生间东侧，x[-9,-6] z[7,10]，门朝北）=====
  B.box(-8.62, 0, 8.5, 0.55, 2.6, 2.6, L.panel);            // 西墙衣柜
  foot(-8.62, 8.5, 0.65, 2.7);
  B.box(-7.4, 0, 9.6, 2.2, 2.6, 0.55, L.panel);             // 南墙衣柜
  foot(-7.4, 9.6, 2.3, 0.65);
  B.box(-6.32, 1.2, 8.2, 0.06, 1.7, 1.3, L.paint(0xbfe0e8)); // 镜
  B.box(-7.4, 0, 7.9, 0.7, 0.5, 0.7, L.paint(0x2a2f33)); foot(-7.4, 7.9, 0.8, 0.8); // 坐凳
  bake('cloak', -7.5, 2.5, 8.3, 1.4, 4.5, [0, -1, 0]);

  // ===== 楼梯两侧的碰撞挡（免得从侧面穿进踏步，楼梯现偏西侧 x[-7,-3]）=====
  foot(-7.05, 2, 0.35, 8, 0); foot(-3.05, 2, 0.35, 8, 0);

  // ===== 二层（loft，y=4）：主卧（西北）、次卧（东北）、卫生间（正北，墙在 house.js）=====
  // 两间卧室已封闭（南墙 z=-4，门朝楼梯北侧过厅），床都靠北墙、让开南墙门洞。
  // 主卧窄侧只留东侧床头柜（3.2 m 床 + 双柜放不进 9 m 净宽）。
  bed(-9.4, ly, -6.3, [2.1]);
  bed(9, ly, -6.3);
  // 两间卧室各一组衣柜（贴北墙），障碍 level 1。
  for (const wx of [-10.5, 9.5]) {
    B.box(wx, ly, -9.2, 2.5, 2.4, 0.6, L.wood);
    B.box(wx, ly + 0.05, -9.5, 2.3, 0.02, 0.04, L.steel);
    B.box(wx + (wx < 0 ? 0.9 : -0.9), ly + 1.1, -8.9, 0.5, 1.0, 0.04, L.paint(0xbababa));
    foot(wx, -9.2, 2.6, 0.7, 1);
  }
  // 精致花草：琴叶榕 / 龟背竹 / 天堂鸟 / 金钱树（plants.js，叶片带分叉几何）。
  buildFloorPlants(B, foot);
  B.box(-2.62, ly, -6.5, 0.55, 0.5, 1.5, L.paint(0xf4f6f7)); // 二层卫生间：马桶（西墙）
  B.box(-2.3, ly + 0.5, -6.5, 0.75, 0.45, 0.85, L.paint(0xf4f6f7)); foot(-2.4, -6.5, 1, 1.6, 1);
  B.box(1.9, ly, -8.8, 1.7, 0.12, 1.7, L.paint(0x9cc4d6));   // 淋浴房（东北角）
  B.box(2.55, ly, -9.45, 0.06, 1.9, 0.06, L.steel); B.box(2.55, ly + 2.0, -9.1, 0.22, 0.05, 0.22, L.steel);
  foot(1.9, -8.8, 1.8, 1.8, 1);
  B.box(1.7, ly, -5.45, 1.2, 0.9, 0.6, L.marble);            // 洗脸台（南墙内侧）
  B.box(1.7, ly + 0.9, -5.45, 1.3, 0.1, 0.7, L.marble); foot(1.7, -5.45, 1.4, 0.8, 1);
  bake('bath2', 0, ly + 2.6, -7.5, 1.6, 5, [0, -1, 0]);
  // 挑空边缘的护栏（南沿让出楼梯洞口 x[-7,-3]；楼梯井两侧加护杆）。
  rail(-11.8, -0.3, -7, -0.3); rail(-3, -0.3, 11.8, -0.3);
  rail(-7, -1.85, -7, -0.25); rail(-3, -1.85, -3, -0.25);
  // 二层三处门洞加木门框（两侧立柱 + 上横梁），让通高开口看起来是门；
  // 门扇留空以便穿行（门洞由 house.js 的 partition 开好，宽 2 m、净高 3 m）。
  const doorFrame = (cx, cz, w) => {
    for (const sx of [-1, 1]) B.box(cx + sx * (w / 2 - 0.05), ly, cz, 0.1, 3.0, 1.06, L.wood);
    B.box(cx, ly + 2.94, cz, w + 0.1, 0.12, 1.06, L.wood);
  };
  doorFrame(-5, -3.5, 2);   // 主卧门（南墙 z=-4 格，中心 z=-3.5）
  doorFrame(5, -3.5, 2);    // 次卧门
  doorFrame(0, -4.5, 2);    // 二层卫生间门（南墙 z=-5 格）
  // 二层吊灯：传的是「离地高度」，必须用楼面 + 2.9 m；直接传 ly 会让灯体落在地面上。
  pendant(-9.4, -6.3, ly + 2.9); pendant(9, -6.3, ly + 2.9); pendant(0, -3, ly + 2.9);

  // ===== 屋顶观景台（y = ROOF_LADDER.top = 9）：围栏已有，加凳子 + 遮阳伞 =====
  const dy = ROOF_LADDER.top;
  const stool = (x, z) => {
    B.at(x, dy, z, 0, () => { B.box(0, 0.05, 0, 0.5, 0.06, 0.5, L.steel); for (const dx of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) B.box(dx, 0, dz, 0.05, 0.45, 0.05, L.steel); B.box(0, 0.5, 0, 0.46, 0.06, 0.46, L.paint(0x2a2f33)); });
  };
  for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6], [0, 0]]) stool(x, z);
  const umbrella = (x, z) => {
    B.box(x, dy, z, 0.1, 2.2, 0.1, L.steel, { shadow: false });
    B.at(x, dy + 2.2, z, 0, () => { B.box(0, 0, 0, 3.2, 0.06, 3.2, L.paint(0xd14b3a), { rx: 0.18 }); });
    B.box(x, dy + 2.0, z, 0.06, 0.06, 3.2, L.paint(0xd14b3a));
  };
  umbrella(-8, -6); umbrella(8, 6);
  for (const [x, z] of [[-10, 8], [10, -8]]) { B.box(x, dy, z, 0.3, 0.06, 0.3, L.steel); B.box(x, dy + 0.06, z, 0.22, 0.5, 0.22, L.light(0xffe4ba)); }
  bake('deck-lights', 0, dy + 0.5, 0, 4, 18, [0, -1, 0]);

  // ===== 室外：入户门两侧壁灯（夜间随灯光烘焙自动点亮，照亮门廊）=====
  for (const lx of [-2.75, 2.75]) {
    B.box(lx, 2.15, HOUSE.z1 + 0.56, 0.34, 0.24, 0.12, L.steel);                       // 灯座
    B.box(lx, 2.15, HOUSE.z1 + 0.62, 0.24, 0.15, 0.05, L.light(0xffdca8));              // 灯罩（自发光）
    bake('porch-lamp', lx, 2.15, HOUSE.z1 + 0.8, 1.7, 6.5, [0, 1, 0]);
  }

  // ===== 室外：泳池（岛南草坪，紧邻房屋西侧）=====
  // 池壁低处的夜灯：夜间映亮水面（光照由方块/水面着色器计算）。
  for (const x of POOL_LAMPS.xs) B.box(x, POOL_LAMPS.y - 0.11, POOL.z0 + 0.015, 0.36, 0.22, 0.03, L.light(0xdffcff));
  // 南缘（朝海）一道与水面齐平的檐口，做出无边水池的观感。
  B.box((POOL.x0 + POOL.x1) / 2, POOL.bed, POOL.z1 + 0.06, POOL.x1 - POOL.x0, POOL.water - POOL.bed, 0.12,
    L.paint(0x68b8c3), { shadow: false, tag: 'pool-infinity-edge' });
  // 泳池出入梯：抛光栏杆翻过池缘，四根横档没入水中；游到此处可爬出水面。
  const silver = L.paint(0xb3c1c3), ladderZ = POOL_LADDER.z;
  for (const x of [POOL_LADDER.x0, POOL_LADDER.x1]) {
    B.box(x, 0, ladderZ - 0.45, 0.065, 0.9, 0.065, silver);
    B.box(x, 0.87, ladderZ - 0.08, 0.065, 0.065, 0.8, silver);
    B.box(x, -1.65, ladderZ + 0.3, 0.065, 2.52, 0.065, silver);
    B.box(x, -1.7, ladderZ + 0.2, 0.065, 0.08, 0.24, silver);
  }
  for (const y of [-0.15, -0.55, -0.95, -1.35]) B.box((POOL_LADDER.x0 + POOL_LADDER.x1) / 2, y, ladderZ + 0.3, 0.78, 0.07, 0.13, silver);
  foot((POOL_LADDER.x0 + POOL_LADDER.x1) / 2, ladderZ - 0.45, 0.9, 0.12);
  hot('pool', (POOL.x0 + POOL.x1) / 2, -0.3, (POOL.z0 + POOL.z1) / 2, POOL.x1 - POOL.x0, 0.6, POOL.z1 - POOL.z0);

  // 躺椅（靠背在北端 +z，ry=0 时人面朝南；ry=-π/2 时人面朝东/泳池）。
  const lounger = (x, z, ry) => B.at(x, 0, z, ry, () => {
    for (const dx of [-0.32, 0.32]) for (const dz of [-0.95, 0.95]) B.box(dx, 0, dz, 0.06, 0.22, 0.06, L.steel);
    B.box(0, 0.22, 0, 0.7, 0.09, 1.9, L.linen);
    B.at(0, 0.27, 0.85, 0, () => B.box(0, 0, 0, 0.7, 0.5, 0.07, L.linen, { rx: -0.5 }));
  });
  // 沙滩遮阳伞：钢立柱 + 微倾方顶篷。
  const beachUmbrella = (x, z) => {
    B.box(x, 0, z, 0.08, 2.3, 0.08, L.steel, { shadow: false });
    B.at(x, 2.35, z, 0, () => {
      B.box(0, 0, 0, 2.6, 0.05, 2.6, L.paint(0xe9e3d6), { rx: 0.13 });
      B.box(0, -0.04, 0, 0.06, 0.05, 2.6, L.paint(0xd14b3a));
    });
  };
  // 边几：钢柱 + 石面。
  const sideTable = (x, z) => {
    B.box(x, 0, z, 0.06, 0.4, 0.06, L.steel);
    B.box(x, 0.4, z, 0.5, 0.05, 0.5, L.marble);
  };
  // 西草坪一组（紧贴房屋西侧、面朝东/泳池）。
  beachUmbrella(-11.5, 17); lounger(-11.5, 15.3, -Math.PI / 2); lounger(-11.5, 18.7, -Math.PI / 2); sideTable(-12.8, 17);
  // 南草坪一组（朝海、面朝北/泳池）。
  beachUmbrella(-5.5, 23); lounger(-7.2, 23, 0); lounger(-3.8, 23, 0); sideTable(-5.5, 24.8);
  bake('pool-deck', (POOL.x0 + POOL.x1) / 2, 1.5, (POOL.z0 + POOL.z1) / 2, 3, 16, [0, -1, 0]);

  // ===== 室外：信箱；楼梯踏步灯 =====
  B.box(MAILBOX.x, 0, MAILBOX.z, 0.5, 1.1, 0.4, L.paint(0x33405a)); B.box(MAILBOX.x, 1.1, MAILBOX.z, 0.55, 0.18, 0.45, L.paint(0x44546f)); foot(MAILBOX.x, MAILBOX.z, 0.6, 0.5);
  for (let i = 0; i < 8; i++) bake('stair-glow', -5, 0.5 + i * 0.45, STAIRS.z1 - 0.5 - i, 0.3, 2.2, [0, -1, 1]);

  // 两盏实时点光，手机与桌面一致。
  for (const [x, z, power] of [[-7, 3, 45], [7, 7, 40]]) {
    const light = new THREE.PointLight(0xffe6c4, 0, 22, 2);
    light.position.set(x, 3, z); light.userData = { base: power, day: 0.15, priority: 1 }; lights.push(light);
  }

  return { batches, obstacles, lights, lighting, hotspots, planes, animated, surfaces };
}
