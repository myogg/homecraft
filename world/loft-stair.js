// 二层通三层露台的窄楼梯：占 x[3,4) 一格宽，8 级从二层楼面（y=4）升到屋顶（y=9）。
// 楼梯顶端正好落在屋顶开口（ROOF_HATCH）的北缘，最后一级与屋顶楼面齐平，人一步
// 就踏上观景台；开口上方由 house.js 的楼梯塔罩着，雨水落在塔顶上。
// 引擎的行走面不走 ngrid（那一格在导航里仍是二层地面），改由本模块的 levels 提供；
// route 供点击寻路用，和外墙梯同一个范式。
import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { LOFT_STAIR } from './layout.js';

export function buildLoftStair(layer, materials) {
  const S = LOFT_STAIR;
  const group = new THREE.Group(); group.name = 'loft-stair';
  const B = new BoxBatch(layer);
  const steel = { tex: 'steel' }, floor = { tex: 'greige_floor' };
  const light = { tex: 'paint', tint: 0xffd9a4, emissive: 0.6 };
  const cx = (S.x0 + S.x1) / 2, w = S.x1 - S.x0;
  const rise = (S.top - S.bottom) / S.steps, run = (S.z1 - S.z0) / S.steps;

  for (let i = 0; i < S.steps; i++) {
    const z = S.z1 - (i + 0.5) * run;
    const top = S.bottom + (i + 1) * rise;
    // 实心踏步（钢芯 + 木面板），楼梯下方看不到空腔。
    B.box(cx, S.bottom, z, w - 0.16, top - S.bottom - 0.05, run, steel);
    B.box(cx, top - 0.05, z, w - 0.08, 0.05, run, floor);
    // 踏面前缘一条暖光灯带，夜里也能看清台阶。
    B.box(cx, top - 0.1, z + run / 2 + 0.012, w - 0.42, 0.026, 0.02, light);
  }
  // 东侧一道细钢扶手（楼梯只有 1 m 宽，西侧是卫生间东墙）；最上面 1 m 伸出屋顶当护栏。
  const railTop = S.top + 0.95, len = Math.hypot(S.z1 - S.z0, S.top - S.bottom);
  B.box(S.x1 - 0.09, (S.bottom + S.top) / 2 + 0.95, (S.z0 + S.z1) / 2, 0.045, 0.045, len, steel, { rx: Math.atan2(S.top - S.bottom, S.z1 - S.z0) });
  for (const t of [0.06, 0.31, 0.56, 0.81, 1]) {
    const z = S.z1 - t * (S.z1 - S.z0), y = S.bottom + t * (S.top - S.bottom);
    B.box(S.x1 - 0.09, y, z, 0.04, 0.95, 0.04, steel);
  }
  B.box(S.x1 - 0.09, railTop, S.z0 - 0.35, 0.04, 0.04, 0.75, steel);
  B.box(S.x1 - 0.09, S.top, S.z0 - 0.35, 0.04, 0.95, 0.04, steel);

  for (const mesh of B.build(materials)) group.add(mesh);

  // 行走面：按踏面分档；踏面之间的缝按下一级算，走起来是连续的。
  function heightAt(x, z) {
    if (x < S.x0 || x > S.x1) return null;
    if (z < S.z0 || z > S.z1) return null;
    const i = Math.floor((S.z1 - z) / run);
    if (i < 0) return S.bottom;
    return S.bottom + Math.min(S.steps, i + 1) * rise;
  }

  const foot = { x: cx, y: S.bottom, z: S.z1 + 0.45 };
  const top = { x: cx, y: S.top, z: S.z0 - 0.35 };

  return {
    group, foot, top, heightAt,
    levels(x, z, out) {
      const y = heightAt(x, z);
      if (y !== null) out.push({ y, site: null, tread: true });
    },
    // 二层 ↔ 屋顶的路线：到楼梯口、一路走上去、跨过洞口边缘踏上屋顶，再去目标点。
    route(ax, ay, az, bx, by, bz) {
      const up = by > ay + 0.5;
      return up
        ? [{ ...foot }, { x: cx, y: S.top, z: S.z0 + 0.3 }, { ...top }, { x: bx, y: by, z: bz }]
        : [{ ...top }, { x: cx, y: S.top, z: S.z0 + 0.3 }, { ...foot }, { x: bx, y: by, z: bz }];
    },
  };
}
