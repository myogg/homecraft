// 通顶书架里的「真书」：一本本有厚度、有高度、有颜色的书，而不是一张贴图。
// 纯数据（不依赖 three），furnish.js 只负责把返回的盒子画出来；布局可离线校验。
//
// 书架正面朝 -x（书脊朝西，观者从房间里看），沿 z 方向一层层排满。
// 每层：几段实书 + 段间留白 + 偶尔一摞横放的书 + 段尾一本斜靠的书。

// 书脊配色：低饱和的纸本颜色，深浅交错，摆在一起不显花。
const SPINES = [
  0x2f4858, 0x3c5a4a, 0x6d3b3b, 0x8a5a3b, 0xd8cfae, 0x8b1a1a, 0x1f2933,
  0x4b5563, 0x7a6a4f, 0x2c4a6e, 0xa8783f, 0x556b5a, 0xe3d9c6, 0x394b59,
  0x704c3f, 0xb8a98c, 0x2b3f36, 0x9c4a33,
];

const mulberry32 = a => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 书脊上的烫金/印墨书名条：深色书配金，浅色书配墨。
const labelTint = tint => {
  const r = (tint >> 16) & 255, g = (tint >> 8) & 255, b = tint & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 < 110 ? 0xc9a86a : 0x3b3630;
};

// shelves: [{ y, gap }]，y 为这一层书站立的板面高度，gap 为可供书占用的净高。
// 返回的盒子：x 为前后（书脊在 x 小的一侧），z 为沿书架长度方向。
export function shelfBooks({ face, z0, z1, shelves, seed = 2024 }) {
  const rnd = mulberry32(seed);
  const boxes = [];
  const put = (tint, x, y, z, w, h, d, extra) => boxes.push({ x, y, z, w, h, d, tint, ...extra });

  for (const { y, gap } of shelves) {
    const right = z1 - 0.06, left = z0 + 0.06;
    const maxH = gap - 0.025;
    let z = left;
    let guard = 0;
    while (z < right - 0.07 && guard++ < 40) {
      // 一段书 0.4~0.95 米长；段与段之间留缝，偶尔整段留白当空档。
      const segEnd = Math.min(right, z + 0.4 + rnd() * 0.55);
      if (rnd() < 0.09) { z = segEnd + 0.07 + rnd() * 0.09; continue; }

      // 段首偶尔来一摞平放的书：书脊朝外，2~4 本，厚薄与长短不一。
      if (rnd() < 0.16) {
        const n = 2 + Math.floor(rnd() * 3), len = 0.24 + rnd() * 0.08;
        if (z + len > segEnd) { z = segEnd; continue; }
        let yy = y;
        for (let i = 0; i < n; i++) {
          const th = 0.032 + rnd() * 0.028, len2 = len - i * 0.016;
          put(SPINES[Math.floor(rnd() * SPINES.length)], face + 0.125, yy, z + len2 / 2, 0.2, th, len2);
          yy += th;
        }
        z += len + 0.02;
      }

      // 竖排：一本接一本，厚度/高度/进深各有偏差，书脊不齐才像真的。
      while (z + 0.028 < segEnd) {
        const t = rnd() < 0.1 ? 0.066 + rnd() * 0.024 : 0.026 + rnd() * 0.036;
        if (z + t > segEnd - 0.02) break;
        const h = Math.min(maxH, 0.19 + rnd() * 0.15);
        const d = 0.18 + rnd() * 0.07;
        const inset = rnd() * 0.026;
        const tint = SPINES[Math.floor(rnd() * SPINES.length)];
        put(tint, face + 0.015 + inset + d / 2, y, z + t / 2, d, h, t);
        // 一部分书脊上有一条烫金书名，宽度只有几毫米，远看是一道亮线。
        if (rnd() < 0.26) put(labelTint(tint), face + 0.017 + inset, y + h * 0.66, z + t / 2, 0.008, 0.013, t * 0.82);
        z += t;
      }
      // 段尾的零头：斜靠一本收尾，书顶往右倒，占掉后面的空隙。
      if (z < right - 0.06 && rnd() < 0.42) {
        const h = Math.min(maxH, 0.22 + rnd() * 0.11), d = 0.18 + rnd() * 0.05;
        const tilt = 0.13 + rnd() * 0.09, lean = h * Math.sin(tilt);
        if (z + lean + 0.05 < right) {
          put(SPINES[Math.floor(rnd() * SPINES.length)], face + 0.015 + rnd() * 0.025 + d / 2, y + 0.009,
            z + 0.02 + lean / 2, d, h, 0.042, { rx: tilt });
          z += 0.02 + lean + 0.03;
        }
      }
      z += 0.05 + rnd() * 0.1;
    }
  }
  return boxes;
}

// 书架木构：底座 + 侧板 + 顶板 + 隔板 + 背板。返回木盒与各层板面，供摆书复用。
export function shelfFrames({ face, back, cz, width, height }) {
  const z0 = cz - width / 2, z1 = cz + width / 2;
  const cx = (face + back) / 2, depth = back - face;
  const frames = [
    { x: cx, y: 0, z: cz, w: depth, h: 0.06, d: width },                                     // 底座
    { x: cx, y: height - 0.05, z: cz, w: depth, h: 0.05, d: width },                          // 顶板
    { x: back - 0.01, y: 0.06, z: cz, w: 0.02, h: height - 0.11, d: width - 0.1 },            // 背板
  ];
  for (const z of [z0 + 0.025, z1 - 0.025]) frames.push({ x: cx, y: 0, z, w: depth, h: height, d: 0.05 });
  const shelves = [{ y: 0.06, gap: 0.34 }];
  for (let i = 0; i < 7; i++) {
    const y0 = 0.4 + i * 0.42;                       // 隔板底面
    if (y0 + 0.04 > height - 0.06) break;
    frames.push({ x: cx - 0.01, y: y0, z: cz, w: depth - 0.02, h: 0.04, d: width - 0.1 });
    shelves.push({ y: y0 + 0.04, gap: 0.42 - 0.04 });
  }
  return { frames, shelves, z0, z1 };
}
