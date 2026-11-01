// 家具与陈设：一层客厅/书房/厨房/卫生间/衣帽间，二层两卧室+卫生间，屋顶观景台。
// 全部静态合批；电视/电脑屏用 canvas 贴图 + 自发光平面（glow），未接渲染管线也能直接显示画面。
import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { canvasTexture } from '@engine/world/textures.js';
import { HOUSE, LOFT, STAIRS, ROOF_LIFT, MAILBOX, POOL, POOL_LADDER, POOL_LAMPS } from './layout.js';
import { buildFloorPlants } from './plants.js';
import { shelfBooks, shelfFrames } from './books.js';
import { PLAYLIST } from './playlist.js';

const L = {
  wood: { tex: 'wood_panel' }, floor: { tex: 'greige_floor' },
  panel: { tex: 'wood_panel' }, marble: { tex: 'prada_marble' },
  steel: { tex: 'steel' }, plaster: { tex: 'plaster' }, linen: { tex: 'linen' },
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
  // 障碍只圈床垫本体（3.4×4.15）——原来按「床 + 两个柜」的 5.2 m 宽整块圈，
  // 次卧那张正好把门口的落脚格子吃掉了，人走到门口就被挡回去。
  const bed = (x, y, z, stands = [-2.1, 2.1]) => {
    B.box(x, y, z, 3.2, 0.3, 4, L.linen);                    // 床垫
    B.box(x, y + 0.3, z - 1.4, 3.0, 0.5, 1.2, L.paint(0xf2efe9)); // 被褥
    B.box(x, y + 0.8, z - 1.6, 2.6, 0.25, 0.8, L.paint(0xe7e2d8)); // 枕头
    B.box(x, y, z - 1.9, 3.4, 1.4, 0.25, L.panel);           // 床背（床头一侧）
    foot(x, z, 3.4, 4.15, 1);
    hot('bed', x, y + 0.1, z, 3.2, 0.9, 3.9);                // 点床就能躺下睡
    for (const sx of stands) {
      B.box(x + sx, y, z - 1.4, 0.8, 0.6, 0.8, L.panel);     // 床头柜
      B.box(x + sx, y + 0.6, z - 1.4, 0.86, 0.05, 0.86, L.marble);
      B.box(x + sx, y + 0.65, z - 1.4, 0.2, 0.3, 0.2, L.light(0xffdfa8));
      foot(x + sx, z - 1.4, 0.95, 0.95, 1);
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

  // 屏幕画面：客厅西墙的大电视 + 墙边点歌机的触屏。两块屏都画在 canvas 上，
  // 平时列歌单，播放时换成「正在播放」——由 world/jukebox.js 播歌时回写。
  const TV_W = 680, TV_H = 390, KIOSK_W = 240, KIOSK_H = 340;
  const clock = s => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  const fit = (text, base, max) => {
    const cjk = /[\u4e00-\u9fff]/.test(text);
    return Math.max(18, Math.min(base, Math.floor(max / Math.max(1, text.length * (cjk ? 1 : 0.58)))));
  };
  function drawTv(ctx, w, h, state) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#14212f'); bg.addColorStop(1, '#080d13');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // 顶栏：名字 + 位置
    ctx.fillStyle = '#1c2b3b'; ctx.fillRect(0, 0, w, 66);
    ctx.fillStyle = '#ffcf8a'; ctx.font = '600 30px sans-serif'; ctx.fillText('点歌台', 28, 36);
    ctx.fillStyle = '#6f7f91'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('JUKEBOX · 客厅西墙', w - 28, 37); ctx.textAlign = 'left';

    if (state && state.title) {
      // 正在播放：歌名 + 歌手 + 跳动的频谱 + 进度条
      ctx.fillStyle = '#7d8ea1'; ctx.font = '600 17px sans-serif'; ctx.fillText('正在播放', 28, 96);
      const size = fit(state.title, 56, w - 120);
      ctx.fillStyle = '#f4f7fb'; ctx.font = `600 ${size}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(state.title, w / 2, 176);
      ctx.fillStyle = '#9fb0c3'; ctx.font = '22px sans-serif';
      ctx.fillText(state.artist || '—', w / 2, 226);
      const bars = 46, bw = (w - 96) / bars;
      for (let i = 0; i < bars; i++) {
        const p = state.playing ? state.progress * 34 + i * 0.71 : i * 0.13;
        const v = 0.18 + 0.82 * Math.abs(Math.sin(p) * Math.cos(p * 0.37 + i));
        const bh = Math.max(4, v * 62);
        ctx.fillStyle = i % 2 ? '#3f7fbf' : '#ffcf8a';
        ctx.fillRect(48 + i * bw, 316 - bh, bw * 0.6, bh);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5f6f80'; ctx.font = '15px sans-serif';
      ctx.fillText(state.playing ? '正在播放 · 点歌机上可以换歌' : '暂停中 · 点 ▶ 继续', w / 2, 372);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#7d8ea1'; ctx.font = '18px sans-serif';
      ctx.fillText(`共 ${PLAYLIST.length} 首 · 点一首，客厅就响了`, 28, 100);
      const rows = PLAYLIST.slice(0, 4);
      rows.forEach((song, i) => {
        const y = 142 + i * 52;
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.055)';
        ctx.fillRect(20, y - 22, w - 40, 44);
        ctx.fillStyle = '#55677a'; ctx.font = '600 17px sans-serif'; ctx.fillText(String(i + 1).padStart(2, '0'), 34, y);
        ctx.fillStyle = '#e8eef6'; ctx.font = '600 24px sans-serif';
        ctx.fillText(song.title, 78, y);
        ctx.fillStyle = '#8296a9'; ctx.font = '16px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(song.artist || '', w - 34, y); ctx.textAlign = 'left';
      });
      if (PLAYLIST.length > 4) {
        ctx.fillStyle = '#55677a'; ctx.font = '15px sans-serif';
        ctx.fillText(`还有 ${PLAYLIST.length - 4} 首，在点歌机上看`, 78, 350);
      }
      ctx.fillStyle = 'rgba(255,207,138,0.9)'; ctx.font = '600 16px sans-serif';
      ctx.fillText('走到墙边的点歌机，点一首 →', 28, 372);
    }
  }
  function drawKiosk(ctx, w, h, state) {
    ctx.fillStyle = '#0b1119'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b2a3a'; ctx.fillRect(0, 0, w, 54);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffcf8a'; ctx.font = '600 20px sans-serif'; ctx.fillText('点歌台', w / 2, 28);
    if (state && state.title) {
      ctx.fillStyle = '#7d8ea1'; ctx.font = '12px sans-serif'; ctx.fillText('正在播放', w / 2, 82);
      ctx.fillStyle = '#f0f5fb'; ctx.font = `600 ${fit(state.title, 22, w - 30)}px sans-serif`;
      ctx.fillText(state.title.length > 8 ? state.title.slice(0, 8) + '…' : state.title, w / 2, 112);
      ctx.fillStyle = '#9fb0c3'; ctx.font = '12px sans-serif';
      ctx.fillText(state.artist || '', w / 2, 140);
      ctx.strokeStyle = '#33414f'; ctx.lineWidth = 2; ctx.strokeRect(24, 168, w - 48, 8);
      ctx.fillStyle = '#ffcf8a'; ctx.fillRect(26, 170, (w - 52) * state.progress, 4);
      ctx.fillStyle = '#6f7f91'; ctx.font = '11px sans-serif'; ctx.fillText(state.time, w / 2, 196);
      ctx.fillStyle = '#4b5a69'; ctx.font = '11px sans-serif';
      ctx.fillText(state.playing ? '触摸列表换歌' : '按 ▶ 继续', w / 2, h - 24);
    } else {
      ctx.fillStyle = '#7d8ea1'; ctx.font = '12px sans-serif'; ctx.fillText('点一首', w / 2, 82);
      PLAYLIST.slice(0, 6).forEach((song, i) => {
        const y = 116 + i * 34;
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(14, y - 14, w - 28, 28);
        ctx.fillStyle = '#54657a'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(String(i + 1).padStart(2, '0'), 22, y);
        ctx.fillStyle = '#dfe7f0'; ctx.font = '13px sans-serif';
        const t = song.title.length > 9 ? song.title.slice(0, 9) + '…' : song.title;
        ctx.fillText(t, 44, y);
        ctx.textAlign = 'center';
      });
      ctx.fillStyle = '#4b5a69'; ctx.font = '11px sans-serif';
      ctx.fillText('按 F 或点它，打开歌单', w / 2, h - 24);
    }
  }
  const monitorPaint = (ctx, w, h) => {
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, w, h);
    const colors = ['#79c0ff', '#7ee787', '#ffa657', '#d2a8ff', '#ff7b72'];
    ctx.font = `${Math.round(h * 0.07)}px monospace`;
    for (let i = 0; i < 11; i++) { ctx.fillStyle = colors[i % colors.length]; ctx.fillText('const ' + 'home'.repeat(1 + (i % 3)) + ' = craft();', w * 0.04, h * (0.12 + i * 0.075)); }
  };
  // 书房的 3×2 多屏：每块各开一扇「窗」，拼成一张工作台。原来六块共用同一张
  // 代码雨纹理，加上屏面与显示器边框共面被黑框吃掉，远看就是一排关机黑屏。
  const MONO = 'monospace', SANS = 'sans-serif';
  const screens = {
    // 代码编辑器：行号 + 彩色 token
    code(ctx, w, h) {
      const f = Math.round(h * 0.072), lh = f * 1.62;
      const rows = [
        ['const', ' sofa ', '=', ' lounge', '();'],
        ['lift', '.to(', '9', ');'], ['', 'for (const', ' room ', 'of', ' house)', ''],
        ['', '  ', 'render', '(room);'], ['', '},', '', '', ''],
        ['// 一层：', '休息区'], ['', 'sandbox', '.', 'add', '(sofa);'],
        ['', 'await', ' ', 'warm', '(', 'lamp', ');'], ['', '', '', '', ''],
        ['export', ' default', ' home', ';'],
      ];
      const palette = ['#c792ea', '#e6edf3', '#79c0ff', '#ffa657', '#7ee787'];
      let y = 26 + lh;
      rows.forEach((tokens, i) => {
        ctx.fillStyle = '#4b5a69'; ctx.font = `${Math.round(f * 0.82)}px ${MONO}`;
        ctx.fillText(String(i + 1).padStart(2, ' '), 6, y);
        let x = 26;
        tokens.forEach((t, k) => {
          if (!t) { x += 4; return; }
          ctx.fillStyle = t.startsWith('//') ? '#5f7f6a' : palette[k % palette.length];
          ctx.font = `${f}px ${MONO}`; ctx.fillText(t, x, y);
          x += ctx.measureText(t).width;
        });
        y += lh;
      });
    },
    // 3D 视图：等距线框小屋 + 轴
    view(ctx, w, h) {
      const cx = w * 0.5, cy = h * 0.56, s = Math.min(w, h) * 0.3;
      const P = (x, y, z) => [cx + (x - z) * 0.72 * s, cy + ((x + z) * 0.36 - y) * s];
      const edge = (a, b, col = '#4f7fa8') => { const p = P(...a), q = P(...b); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
      const V = [[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1.4,-1],[1,1.4,-1],[1,1.4,1],[-1,1.4,1]];
      // 地面格网
      ctx.strokeStyle = '#22303d'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) { const a = P(i, 0, -2), b = P(i, 0, 2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); const c = P(-2, 0, i), d = P(2, 0, i); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
      for (let i = 0; i < 4; i++) { edge(V[i], V[(i + 1) % 4]); edge(V[i + 4], V[4 + (i + 1) % 4]); edge(V[i], V[i + 4]); }
      // 双坡屋顶
      const ridge = [[0, 2.1, -1.1], [0, 2.1, 1.1]];
      edge(V[4], ridge[0], '#7ee787'); edge(V[5], ridge[0], '#7ee787');
      edge(V[7], ridge[1], '#7ee787'); edge(V[6], ridge[1], '#7ee787');
      edge(ridge[0], ridge[1], '#7ee787');
      // 高亮一块格子
      const g = [P(0, 0.01, 0), P(1, 0.01, 0), P(1, 0.01, 1), P(0, 0.01, 1)];
      ctx.fillStyle = 'rgba(126,231,135,0.22)'; ctx.beginPath();
      ctx.moveTo(...g[0]); g.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9fb0c3'; ctx.font = `11px ${MONO}`;
      ctx.fillText('x  y  z', 8, h - 8);
      ctx.fillStyle = '#7ee787'; ctx.fillText('1 m', 8, 22);
    },
    // 终端
    term(ctx, w, h) {
      const f = Math.round(h * 0.078), lh = f * 1.6;
      const lines = [
        ['#7ee787', '$ npm run build'],
        ['#8b9bb0', '> homecraft@1.0.0 build'],
        ['#8b9bb0', 'esbuild world/ index.js'],
        ['#7ee787', 'built dist (1.9M)'],
        ['#7ee787', '$ ./tools/serve.sh'],
        ['#8b9bb0', 'listening on :8080'],
        ['#ffa657', 'warn  1 chunk > 500kb'],
        ['#e6edf3', '$ '],
      ];
      let y = 28 + lh * 0.8;
      lines.forEach(([col, t]) => { ctx.fillStyle = col; ctx.font = `${f}px ${MONO}`; ctx.fillText(t, 10, y); y += lh; });
      ctx.fillStyle = '#7ee787'; ctx.fillRect(10 + ctx.measureText('$ ').width, y - lh + 4, f * 0.45, f * 0.95); // 光标
    },
    // 数据面板：网格 + 折线 + 柱
    chart(ctx, w, h) {
      const x0 = 30, x1 = w - 12, y0 = 34, y1 = h - 22;
      ctx.strokeStyle = '#1e2a35'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = y0 + (y1 - y0) * i / 4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      const bars = [0.35, 0.55, 0.42, 0.72, 0.6, 0.86, 0.5, 0.66, 0.9, 0.58];
      const bw = (x1 - x0) / bars.length;
      bars.forEach((v, i) => { ctx.fillStyle = 'rgba(121,192,255,0.35)'; ctx.fillRect(x0 + i * bw + 2, y1 - (y1 - y0) * v, bw - 4, (y1 - y0) * v); });
      ctx.strokeStyle = '#ffa657'; ctx.lineWidth = 2; ctx.beginPath();
      bars.forEach((v, i) => { const x = x0 + i * bw + bw / 2, y = y1 - (y1 - y0) * (0.25 + v * 0.62); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.fillStyle = '#9fb0c3'; ctx.font = `11px ${SANS}`; ctx.fillText('visitors', 8, 22);
      ctx.fillStyle = '#7ee787'; ctx.font = `600 13px ${SANS}`; ctx.fillText('+18%', w - 52, 22);
    },
    // 户型俯视：房间分格 + 位置点
    map(ctx, w, h) {
      const pad = 22, mw = w - pad * 2, mh = h - pad * 2 - 8;
      ctx.strokeStyle = '#3b4d5e'; ctx.lineWidth = 1.4;
      ctx.strokeRect(pad, pad + 6, mw, mh);
      const rooms = [[0, 0, 0.34, 0.55], [0.34, 0, 0.36, 0.55], [0.7, 0, 0.3, 0.55], [0, 0.55, 0.5, 0.45], [0.5, 0.55, 0.5, 0.45]];
      rooms.forEach(([rx, ry, rw, rh]) => { ctx.strokeStyle = '#2b3a48'; ctx.strokeRect(pad + mw * rx, pad + 6 + mh * ry, mw * rw, mh * rh); });
      ctx.fillStyle = 'rgba(126,231,135,0.14)'; ctx.fillRect(pad + mw * 0.5, pad + 6 + mh * 0.55, mw * 0.5, mh * 0.45);
      ctx.fillStyle = '#ff7b72'; ctx.beginPath(); ctx.arc(pad + mw * 0.72, pad + 6 + mh * 0.76, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,123,114,0.5)'; ctx.beginPath(); ctx.arc(pad + mw * 0.72, pad + 6 + mh * 0.76, 9, 0, 7); ctx.stroke();
      ctx.fillStyle = '#9fb0c3'; ctx.font = `11px ${SANS}`; ctx.fillText('ground floor', pad, 18);
    },
    // 音频：频谱 + 波形
    audio(ctx, w, h) {
      const mid = h * 0.42, n = 26, bw = (w - 24) / n;
      for (let i = 0; i < n; i++) {
        const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6 + 1));
        const bh = (h * 0.34) * v;
        ctx.fillStyle = i % 3 === 0 ? '#ffa657' : '#79c0ff';
        ctx.fillRect(12 + i * bw + 1, mid - bh, bw - 3, bh);
      }
      ctx.strokeStyle = '#7ee787'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let x = 12; x < w - 12; x += 3) {
        const y = h * 0.82 + Math.sin(x * 0.35) * 9 * Math.sin(x * 0.07);
        x === 12 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#9fb0c3'; ctx.font = `11px ${SANS}`; ctx.fillText('now playing', 12, 18);
    },
  };
  // 一扇「窗」：深底 + 顶栏（窗口点 + 标题）+ 内容。
  const monitorPane = (kind, title) => (ctx, w, h) => {
    ctx.fillStyle = '#0f1319'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#171f28'; ctx.fillRect(0, 0, w, 26);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(11 + i * 11, 13, 3.1, 0, 7); ctx.fill();
    });
    ctx.fillStyle = '#8fa3b8'; ctx.font = `600 11px ${SANS}`; ctx.fillText(title, 48, 17);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 26, w, h - 26); ctx.clip();
    screens[kind](ctx, w, h); ctx.restore();
  };
  // 角落电脑桌：桌面 + 钢腿 + 显示器（画面朝 +z/南，观者站在南侧）。
  // 显示器屏面在 B.at 之外摆：plane() 不吃 BoxBatch 的变换栈，得自己按 ry 换算
  // 世界坐标（局部 z=-0.2 绕 y 转 ry 后 = (-0.2·sin ry, 1.95, -0.2·cos ry)）。
  const deskComp = (x, z, ry) => {
    B.at(x, 0, z, ry, () => {
      B.box(0, 1.05, 0, 2.4, 0.08, 0.9, L.panel);
      for (const lx of [-1.05, 1.05]) B.box(lx, 0, 0, 0.1, 1.05, 0.1, L.steel);
      B.box(0, 1.1, 0.25, 1.7, 0.06, 0.1, L.steel);
    });
    const px = x - 0.2 * Math.sin(ry), pz = z - 0.2 * Math.cos(ry);
    plane(1.7, 1.0, paint(420, 250, monitorPane('code', 'homecraft — world')), px, 1.95, pz, ry, true);
  };

  // ===== 一层：客厅（门厅中庭，沙发东移避开门轴与西侧楼梯）=====
  B.box(-9.25, 0, 3, 3.5, 0.025, 5.6, L.linen);            // 地毯（收到楼梯西侧）
  const sofaX = -1.0, sofaZ = 3;
  B.box(sofaX, 0.08, sofaZ, 1, 0.48, 4, L.paint(0x1c1e20));
  B.box(sofaX + 0.45, 0.48, sofaZ, 0.2, 0.62, 4, L.paint(0x1c1e20));
  for (const z of [sofaZ - 1.7, sofaZ + 1.7]) B.box(sofaX, 0.08, z, 1, 0.65, 0.2, L.paint(0x1c1e20));
  foot(sofaX, sofaZ, 1.2, 4.2); hot('about', sofaX, 0, sofaZ, 1.4, 1.2, 4.2);
  B.box(sofaX - 0.6, 0, sofaZ, 1.4, 0.45, 2.2, L.marble); foot(sofaX - 0.6, sofaZ, 1.5, 2.3); // 茶几
  // ===== 一层：电视角（楼梯西侧、卫生间北侧）→ 点歌台 =====
  // 这里是楼梯和卫生间夹出来的一块口袋空间：进门要绕到楼梯南端那个口子才进得来，
  // 原来只挂了台电视、铺了块地毯，走进去像个死角。现在整块做成点歌台——电视当
  // 大屏列歌单，墙下矮柜摆两座音箱，中间立一台点歌机，靠楼梯墙一条长凳。
  const tvZ = sofaZ;
  const tvTex = paint(TV_W, TV_H, (c, w, h) => drawTv(c, w, h, null));
  // 电视背后的整片深色墙板：西墙是玻璃的，不衬一层，电视就像浮在院子前面。
  B.box(-11.96, 0.5, tvZ, 0.07, 3.05, 4.4, L.paint(0x1c2024));
  B.box(-11.06, 1.1, tvZ, 0.1, 2.3, 3.6, L.steel);          // 墙托
  B.box(-11.0, 0.9, tvZ, 0.06, 2.7, 4, L.paint(0x0a0a0a));  // 屏体
  plane(3.4, 1.95, tvTex, -10.9, 2.1, tvZ, Math.PI / 2, true);
  bake('tv', -10.7, 2.1, tvZ, 1.4, 6, [1, -0.4, 0]);
  // 屏下矮柜：功放、唱片、随手放的线，都在这一层。
  B.box(-11.5, 0, tvZ, 0.58, 0.44, 3.3, L.wood);
  B.box(-11.5, 0.44, tvZ, 0.62, 0.05, 3.4, L.marble);
  for (const dz of [-0.9, 0.9]) B.box(-11.2, 0.08, tvZ + dz, 0.012, 0.28, 0.86, L.paint(0x453a2e));
  B.box(-11.32, 0.49, tvZ + 0.35, 0.28, 0.14, 0.9, L.paint(0x14171a));   // 功放
  B.box(-11.32, 0.63, tvZ + 0.35, 0.24, 0.015, 0.7, L.paint(0x3b4349));
  foot(-11.5, tvZ, 0.7, 3.45);
  // 两座落地音箱，紧贴墙站在矮柜两侧。
  for (const dz of [-2.45, 2.45]) {
    const sz = tvZ + dz;
    B.box(-11.32, 0, sz, 0.34, 1.1, 0.3, L.paint(0x14171a));
    B.box(-11.14, 0.08, sz, 0.02, 0.32, 0.22, L.paint(0x333a40));
    B.box(-11.13, 0.6, sz, 0.02, 0.3, 0.2, L.paint(0x22282d));
    B.box(-11.13, 0.98, sz, 0.02, 0.1, 0.1, L.paint(0x9a7649));
    foot(-11.32, sz, 0.42, 0.4);
  }
  // 点歌机：钢立柱 + 一块触屏，背靠南墙、面朝屋里，站在房间中间就能点。
  const kx = -9.0, kz = 5.32;
  const kioskTex = paint(KIOSK_W, KIOSK_H, (c, w, h) => drawKiosk(c, w, h, null));
  B.box(kx, 0, kz, 0.44, 0.05, 0.32, L.steel);              // 底座
  B.box(kx, 0.05, kz, 0.08, 1.04, 0.08, L.steel);           // 立柱
  B.box(kx, 1.09, kz, 0.5, 0.05, 0.16, L.steel);            // 屏托
  B.box(kx, 0.96, kz - 0.02, 0.66, 0.94, 0.09, L.paint(0x14171a)); // 屏体
  B.box(kx, 1.0, kz - 0.06, 0.58, 0.86, 0.02, L.paint(0x0b0f14));
  plane(0.56, 0.78, kioskTex, kx, 1.43, kz - 0.075, Math.PI, true);
  foot(kx, kz, 0.72, 0.5);
  hot('jukebox', kx, 0.75, kz - 0.2, 1.1, 1.35, 1.0);
  // 南墙的木格栅（吸音板）：深色底板 + 一条条浅木条，缝里是暗的，读得出是一排木条。
  B.box(-9.0, 0, 5.98, 1.9, 2.62, 0.03, L.paint(0x2b231b));
  for (let i = 0; i < 9; i++) B.box(-9.82 + i * 0.2, 0.04, 5.965, 0.15, 2.55, 0.035, L.panel);
  B.box(-9.0, 2.58, 5.96, 1.9, 0.05, 0.05, L.steel);
  B.box(-9.0, 0, 5.96, 1.9, 0.05, 0.05, L.steel);
  // 靠楼梯墙的一条木长凳，面朝大屏。
  B.box(-7.64, 0, 2.5, 0.72, 0.36, 2.4, L.panel);
  B.box(-7.33, 0.36, 2.5, 0.11, 0.52, 2.4, L.panel);
  for (const dz of [-0.6, 0.6]) B.box(-7.66, 0.36, 2.5 + dz, 0.66, 0.12, 0.62, L.linen);
  foot(-7.6, 2.5, 0.95, 2.5);
  pendant(-9.4, 2.9, 3.4);
  // 门楣上的一块灯牌，夜里也认得出这是哪。
  const signTex = paint(420, 96, (c, w, h) => {
    c.fillStyle = '#12181f'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f0b46a'; c.lineWidth = 4; c.strokeRect(7, 7, w - 14, h - 14);
    c.fillStyle = '#ffcf8a'; c.font = '600 50px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('点 歌 台', w / 2, h / 2 + 2);
  });
  B.box(-11.33, 3.72, tvZ, 0.06, 0.5, 1.9, L.paint(0x0f1318));
  plane(1.8, 0.42, signTex, -11.29, 3.97, tvZ, Math.PI / 2, true);
  bake('jukebox', -9.6, 2.6, 3.0, 1.7, 6.5, [0, -1, 0]);
  // 两块屏由 main.js 在播歌时回写：{ title, artist, playing, progress, time }
  surfaces.jukebox = {
    draw(state) {
      drawTv(tvTex.image.getContext('2d'), TV_W, TV_H, state);
      drawKiosk(kioskTex.image.getContext('2d'), KIOSK_W, KIOSK_H, state);
      tvTex.needsUpdate = true; kioskTex.needsUpdate = true;
    },
  };
  // 落地灯与吊灯（挪到沙发东侧，避开西侧楼梯）。
  B.box(1.5, 0, 5.4, 0.5, 0.055, 0.5, L.steel); B.box(1.5, 0.055, 5.4, 0.065, 1.72, 0.065, L.steel);
  B.box(1.5, 1.75, 5.4, 0.7, 0.25, 0.7, L.linen); B.box(1.5, 1.728, 5.4, 0.56, 0.025, 0.56, L.light(0xffe4ba));
  foot(1.5, 5.4, 0.55, 0.55); bake('living-lamp', 1.5, 1.72, 5.4, 1.05, 5.8, [0, -1, 0]);
  pendant(0, 3, 5.6);
  // 客厅电脑（北墙基座前的书桌 + 显示器，观者从南侧看屏幕）。
  deskComp(-10, 0.9, 0); foot(-10, 0.9, 2.5, 1);

  // ===== 一层：书房（东南，x[2,12] z[0,4]）=====
  // 东墙通顶书架：木框架 + 一层层真书（书脊、书名条、斜靠和横放的都是独立方块）。
  const shelf = shelfFrames({ face: 11.54, back: 11.96, cz: 2, width: 3.6, height: 3.4 });
  for (const f of shelf.frames) B.box(f.x, f.y, f.z, f.w, f.h, f.d, L.panel);
  foot(11.66, 2, 0.55, 3.7);
  for (const b of shelfBooks({ face: 11.54, z0: shelf.z0, z1: shelf.z1, shelves: shelf.shelves, seed: 2024 }))
    B.box(b.x, b.y, b.z, b.w, b.h, b.d, L.paint(b.tint), { rx: b.rx || 0, shadow: false });
  // 书架中段三本「精装书」：比普通书略高、略向前突，醒目且可点击。
  // 点击弹出简介 / 链接到文章（内容见 index.html 的 data-station="book-1/2/3"）。
  const SHOW_BOOKS = [
    { z: 1.0, tint: 0x8b1a1a, title: 'book-1' },   // 红
    { z: 2.0, tint: 0x2c4a6e, title: 'book-2' },   // 蓝
    { z: 3.0, tint: 0x3c5a4a, title: 'book-3' },   // 绿
  ];
  const bookY = 1.28, bookX = 11.54 + 0.015 + 0.10 + 0.04;   // 站立面 + 略前突
  for (const bk of SHOW_BOOKS) {
    B.box(bookX, bookY, bk.z, 0.20, 0.32, 0.05, L.paint(bk.tint), { shadow: false });
    B.box(bookX, bookY + 0.30, bk.z, 0.008, 0.014, 0.042, L.paint(0xc9a86a)); // 烫金书名条
    hot(bk.title, bookX, bookY, bk.z, 0.26, 0.36, 0.12);     // 可点击热区
  }
  // 书房：长桌 + 多屏拼接（3×2 显示器墙，画面朝南）+ 多台主机 + 椅。
  const deskX = 7, deskZ = 1.5;
  const cols = 3, rows = 2, mw = 1.45, mh = 0.82, gp = 0.1;   // 多屏拼接
  const span = cols * mw + (cols - 1) * gp, mX0 = -span / 2 + mw / 2, baseY = 1.5;
  const panes = [['code', 'house.js'], ['view', 'view — home'], ['term', 'zsh — build'],
    ['chart', 'analytics'], ['map', 'floor plan'], ['audio', 'player']];
  B.at(deskX, 0, deskZ, 0, () => {
    B.box(0, 1.05, 0, 5.4, 0.08, 1.3, L.panel);              // 桌面
    for (const lx of [-2.5, 2.5]) B.box(lx, 0, 0, 0.12, 1.05, 0.12, L.steel);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const mx = mX0 + c * (mw + gp), my = baseY + r * (mh + gp);
      B.box(mx, my, -0.42, mw + 0.07, mh + 0.07, 0.06, L.paint(0x0d0f12));   // 显示器边框
    }
    B.box(0, 1.18, -0.5, span + 0.3, 0.06, 0.12, L.steel);                   // 支架横梁
  });
  // 六块屏面各开一扇窗：代码 / 3D 视图 / 终端 / 图表 / 户型 / 波形。
  // 注意 plane() 不参与 B.at 的矩阵（那是 BoxBatch 的私有栈），只能按世界坐标摆
  // ——原来写在 at 回调里，六块画面全落在世界原点附近，书房只剩一圈黑边框。
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const mx = deskX + mX0 + c * (mw + gp), my = baseY + r * (mh + gp);
    const [kind, title] = panes[r * cols + c];
    plane(mw, mh, paint(420, 250, monitorPane(kind, title)), mx, my, deskZ - 0.375, 0, true);
  }
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

  // ===== 一层：休息区（西南角，x[-12,-9] z[7,10]，北面全开）=====
  // 这一间原来是卫生间：3×3 的方盒子，进门左手第一间。北墙拆掉之后它成了一块
  // 半凹的小客厅——沙发贴南墙朝北，矮几在中间，落地灯守在门口右手边。
  // 地毯：深一档的灰米色——原来用亚麻色，跟浅地板糊成一片，看不出边。
  B.box(-10.5, 0.004, 8.5, 2.68, 0.018, 2.78, L.paint(0x8b8474));
  B.box(-10.5, 0.022, 8.5, 2.46, 0.006, 2.56, L.paint(0x9c9585));
  // 三人沙发：贴南墙、朝北。进门迎面是座面而不是靠背，坐下正对点歌台与客厅。
  // 木底框 + 木脚把柜体托离地面；布面用灰绿、坐垫用米白，两档拉开才不会读成床。
  for (const dx of [-0.7, 0.7]) for (const dz of [-0.38, 0.34])
    B.box(-10.5 + dx, 0, 9.3 + dz, 0.07, 0.1, 0.07, L.paint(0x5b4a37));   // 木脚
  B.box(-10.5, 0.1, 9.3, 1.82, 0.14, 1.0, L.wood);                       // 底框
  B.box(-10.5, 0.24, 9.28, 1.76, 0.2, 0.94, L.paint(0x8f968c));          // 座箱
  B.box(-10.5, 0.44, 9.55, 1.76, 0.72, 0.28, L.paint(0x9aa196));         // 靠背
  B.box(-10.5, 0.5, 9.4, 1.66, 0.6, 0.08, L.linen);                      // 靠背软包
  B.box(-10.5, 1.16, 9.55, 1.76, 0.035, 0.3, L.wood);                    // 背沿
  for (const ax of [-11.33, -9.67]) B.box(ax, 0.44, 9.3, 0.2, 0.42, 0.94, L.paint(0x9aa196)); // 扶手
  for (const ax of [-10.98, -10.02]) B.box(ax, 0.44, 8.86, 0.8, 0.16, 0.84, L.paint(0xe4ddd0)); // 坐垫
  B.box(-10.9, 0.6, 9.34, 0.3, 0.3, 0.13, L.paint(0xb08a68), { rx: 0.16 });  // 抱枕
  B.box(-10.1, 0.6, 9.34, 0.3, 0.3, 0.13, L.paint(0xd6cfbe), { rx: -0.12 });
  foot(-10.5, 9.3, 1.86, 1.05);
  // 矮几：整块原木台面 + 木腿，下层搁杂志。不用大理石——深绿纹在这间里像台球桌。
  B.box(-10.5, 0.4, 8.15, 0.96, 0.05, 0.64, L.wood);
  B.box(-10.5, 0.13, 8.15, 0.84, 0.035, 0.52, L.wood);
  for (const dx of [-0.42, 0.42]) for (const dz of [-0.24, 0.24])
    B.box(-10.5 + dx, 0.02, 8.15 + dz, 0.05, 0.38, 0.05, L.paint(0x5b4a37));
  B.box(-10.7, 0.165, 8.12, 0.22, 0.04, 0.3, L.paint(0xb8a488));         // 下层杂志
  B.box(-10.7, 0.205, 8.14, 0.2, 0.03, 0.28, L.paint(0x8c5f4a));
  B.box(-10.62, 0.45, 8.1, 0.24, 0.04, 0.32, L.paint(0x2f4a52));         // 台面上的书
  B.box(-10.62, 0.49, 8.1, 0.22, 0.028, 0.3, L.paint(0xe6e0d4));
  B.box(-10.22, 0.45, 8.22, 0.26, 0.016, 0.2, L.paint(0x6b5443));        // 木托盘
  B.box(-10.24, 0.466, 8.22, 0.09, 0.09, 0.09, L.paint(0xece7de));       // 杯子
  B.box(-10.24, 0.556, 8.22, 0.08, 0.012, 0.08, L.paint(0x6b5443));
  foot(-10.5, 8.15, 1.0, 0.68);
  // 落地灯：放在进门右手边的东墙下——西南角那面是窗，灯罩正卡在窗洞高度上，
  // 远看像站在院子里。
  B.box(-9.42, 0, 7.28, 0.32, 0.045, 0.32, L.paint(0x26282a));
  B.box(-9.42, 0.045, 7.28, 0.045, 1.56, 0.045, L.paint(0x26282a));
  B.box(-9.42, 1.6, 7.28, 0.38, 0.3, 0.38, L.paint(0xf0e6d2));           // 灯罩
  B.box(-9.42, 1.585, 7.28, 0.3, 0.02, 0.3, L.light(0xffdfae));          // 罩底发光面
  foot(-9.42, 7.28, 0.36, 0.36);
  bake('lounge', -9.38, 1.55, 7.3, 1.15, 4.8, [0, -1, 0]);
  bake('lounge', -10.4, 2.85, 8.6, 0.85, 4.4, [0, -1, 0]);
  // 东墙两幅小画（沙发上方），抽象色块，衬亚麻。
  const artA = paint(300, 400, (c, w, h) => {
    c.fillStyle = '#efe7d9'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b98a5e'; c.fillRect(0, h * 0.62, w, h * 0.38);
    c.fillStyle = '#d9c3a3'; c.fillRect(0, h * 0.53, w, h * 0.09);
    c.fillStyle = '#8a9a8c'; c.beginPath(); c.arc(w * 0.66, h * 0.29, w * 0.15, 0, 7); c.fill();
    c.strokeStyle = '#2f3330'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, h * 0.79); c.lineTo(w, h * 0.75); c.stroke();
  });
  const artB = paint(300, 400, (c, w, h) => {
    c.fillStyle = '#e8e9e4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6f8078'; c.fillRect(0, 0, w, h * 0.44);
    c.fillStyle = '#c6a882'; c.fillRect(w * 0.16, h * 0.44, w * 0.68, h * 0.22);
    c.fillStyle = '#3a3f3b'; c.fillRect(w * 0.1, h * 0.85, w * 0.8, 4);
  });
  const picture = (az, tex) => {
    B.box(-9.03, 1.38, az, 0.05, 0.94, 0.68, L.paint(0x2b2620));
    B.box(-9.062, 1.42, az, 0.035, 0.86, 0.6, L.paint(0xf3efe6));
    plane(0.5, 0.72, tex, -9.085, 1.85, az, -Math.PI / 2, false);
  };
  picture(8.05, artA); picture(8.85, artB);

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
  // 次卧那张往东挪 0.4 m：门口 x[6,8) 要让出 1.8 m 的落脚带，进来才不用侧身。
  bed(9.4, ly, -6.3, [2.1]);
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
  B.box(1.1, ly, -8.9, 1.5, 0.12, 1.5, L.paint(0x9cc4d6));   // 淋浴房（东北角，贴东墙不穿模）
  B.box(1.78, ly, -9.45, 0.06, 1.9, 0.06, L.steel); B.box(1.78, ly + 2.0, -9.1, 0.22, 0.05, 0.22, L.steel);
  foot(1.1, -8.9, 1.6, 1.6, 1);
  B.box(1.35, ly, -5.45, 1.1, 0.9, 0.6, L.marble);           // 洗脸台（南墙内侧）
  B.box(1.35, ly + 0.9, -5.45, 1.2, 0.1, 0.7, L.marble); foot(1.35, -5.45, 1.3, 0.8, 1);
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
  doorFrame(7, -3.5, 2);    // 次卧门（随楼梯井东移）
  doorFrame(0, -4.5, 2);    // 二层卫生间门（南墙 z=-5 格）
  // 二层吊灯：传的是「离地高度」，必须用楼面 + 2.9 m；直接传 ly 会让灯体落在地面上。
  pendant(-9.4, -6.3, ly + 2.9); pendant(9.4, -6.3, ly + 2.9); pendant(0, -3, ly + 2.9);

  // ===== 二层楼梯口：照片墙（主卧门两侧 + 门楣，正对楼梯上来的视线）=====
  // 三幅程序绘制的旅行照，深木框 + 白卡纸 + 小射灯；挂在楼梯正对的墙上，
  // 一上二楼就看见。走廊东端那面墙太侧，撤掉了。
  const photoSea = (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#2c3a5c'); sky.addColorStop(0.55, '#a95f45'); sky.addColorStop(1, '#f2a660');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.62);
    ctx.fillStyle = '#ffdcaa'; ctx.beginPath(); ctx.arc(w * 0.63, h * 0.5, h * 0.072, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(58,48,66,0.4)';
    for (const [yy, wd] of [[0.22, 0.46], [0.31, 0.68], [0.4, 0.32]]) ctx.fillRect(w * 0.06, h * yy, w * wd, h * 0.018);
    const sea = ctx.createLinearGradient(0, h * 0.62, 0, h);
    sea.addColorStop(0, '#4c3f54'); sea.addColorStop(1, '#121826');
    ctx.fillStyle = sea; ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = 'rgba(255,206,152,0.5)';
    for (let i = 0; i < 18; i++) {
      const t = i / 18, yy = h * (0.635 + t * 0.35);
      const ww = w * (0.015 + t * 0.12) * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.3)));
      ctx.fillRect(w * 0.63 - ww / 2, yy, ww, Math.max(1, h * 0.005));
    }
  };
  const photoHill = (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#e3eae6'); sky.addColorStop(1, '#a8bbb5');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const ridge = (base, amp, col, n) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const yy = h * base - Math.sin(t * Math.PI * 2.1 + 0.4) * h * amp - Math.sin(t * Math.PI * 5.3) * h * amp * 0.26;
        ctx.lineTo(t * w, yy);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    };
    ridge(0.64, 0.15, '#93a5a1', 42);
    ridge(0.75, 0.11, '#728785', 36);
    ridge(0.87, 0.07, '#4f6262', 30);
    ctx.fillStyle = 'rgba(242,246,244,0.32)'; ctx.fillRect(0, h * 0.66, w, h * 0.09);
  };
  const photoCat = (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f4e5cf'); bg.addColorStop(1, '#dcc3a2');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,247,229,0.8)';
    ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.08); ctx.lineTo(w * 0.48, h * 0.04);
    ctx.lineTo(w * 0.32, h * 0.94); ctx.lineTo(0, h * 0.99); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3b332c';
    ctx.beginPath(); ctx.ellipse(w * 0.57, h * 0.76, w * 0.2, h * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.57, h * 0.44, w * 0.135, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.465, h * 0.36); ctx.lineTo(w * 0.45, h * 0.25); ctx.lineTo(w * 0.55, h * 0.32); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.675, h * 0.36); ctx.lineTo(w * 0.69, h * 0.25); ctx.lineTo(w * 0.59, h * 0.32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0c96a';
    ctx.beginPath(); ctx.arc(w * 0.515, h * 0.44, w * 0.024, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.625, h * 0.44, w * 0.024, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3b332c'; ctx.lineWidth = w * 0.042; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w * 0.74, h * 0.88); ctx.quadraticCurveTo(w * 0.94, h * 0.84, w * 0.89, h * 0.6); ctx.stroke();
  };
  const photoWall = (cx, cy, w, h, fn) => {
    B.box(cx, cy - h / 2 - 0.07, -2.975, w + 0.14, h + 0.13, 0.05, L.panel);            // 深木框
    B.box(cx, cy - h / 2 - 0.03, -2.944, w + 0.07, h + 0.07, 0.026, L.paint(0xf6f1e6)); // 白卡纸
    plane(w, h, paint(Math.round(w * 320), Math.round(h * 320), fn), cx, cy, -2.928, 0);
    return cy + h / 2;                                                                 // 画框顶，给射灯定位
  };
  // 小射灯：一根从墙里伸出的钢杆 + 铜灯罩，暖光打在画心上（夜里也亮）。
  const pictureLight = (cx, top) => {
    B.box(cx, top + 0.14, -2.90, 0.03, 0.03, 0.24, L.steel);
    B.box(cx, top + 0.10, -2.70, 0.14, 0.08, 0.14, L.paint(0x9a7649));
    B.box(cx, top + 0.08, -2.70, 0.10, 0.02, 0.10, L.light(0xffe0b0));
    bake('photo', cx, top - 0.12, -2.60, 0.7, 2.0, [0, -0.6, -1]);
  };
  // 楼梯口正对主卧门：门两侧各一幅竖画、门楣一幅横幅——上到二楼第一眼就是这面墙。
  pictureLight(-6.54, photoWall(-6.54, 5.5, 0.78, 1.42, photoCat));
  pictureLight(-3.46, photoWall(-3.46, 5.5, 0.78, 1.42, photoHill));
  photoWall(-5, 7.42, 1.7, 0.56, photoSea);

  // ===== 屋顶观景台（y = ROOF_LIFT.top = 9）：围栏已有，加凳子 + 遮阳伞 =====
  const dy = ROOF_LIFT.top;
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

  // ===== 室外：门口门牌（访客计数，数字由 main.js 取到后重绘）=====
  const plateW = 512, plateH = 166;
  const plateCv = document.createElement('canvas');
  plateCv.width = plateW; plateCv.height = plateH;
  const plateCtx = plateCv.getContext('2d');
  const plateTex = new THREE.CanvasTexture(plateCv);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 8;
  const drawPlate = (total, today) => {
    plateCtx.fillStyle = '#3b2a1d'; plateCtx.fillRect(0, 0, plateW, plateH);
    plateCtx.strokeStyle = '#9a7649'; plateCtx.lineWidth = 7; plateCtx.strokeRect(11, 11, plateW - 22, plateH - 22);
    plateCtx.textAlign = 'center';
    plateCtx.fillStyle = '#f4ead6'; plateCtx.font = '600 64px sans-serif';
    plateCtx.fillText('姜小小的家', plateW / 2, 82);
    plateCtx.fillStyle = '#c8b499'; plateCtx.font = '30px sans-serif';
    plateCtx.fillText(total == null ? '欢迎回家' : `第 ${total} 位访客 · 今天 ${today} 人`, plateW / 2, 132);
    plateTex.needsUpdate = true;
  };
  drawPlate(null);
  surfaces.nameplate = { mesh: plane(1.9, 0.62, plateTex, 0, 3.35, HOUSE.z1 + 1.03, 0, true), draw: drawPlate };

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
