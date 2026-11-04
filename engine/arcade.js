// engine/arcade.js — the playable 连连看 inside the QQ arcade cabinet's card.
// Everything (board, rules, sound, timers) is self-contained: no assets, no
// global listeners left behind when the panel closes.

const LEVELS = [
  { cols: 8, rows: 4, kinds: 6, seconds: 100 },
  { cols: 8, rows: 5, kinds: 8, seconds: 130 },
  { cols: 8, rows: 6, kinds: 8, seconds: 165 },
];
// Shapes are drawn with CSS clip-path, not font glyphs: emoji fonts are
// missing on plenty of devices (and in headless browsers), which would leave
// half the tiles blank. Colour + silhouette is enough to tell them apart.
const SYMBOLS = [
  ['circle(46%)', '#e0603a'],
  ['polygon(50% 3%, 100% 100%, 0 100%)', '#3d7fd6'],
  ['polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', '#4ba36a'],
  ['polygon(50% 0, 62% 35%, 100% 35%, 70% 57%, 80% 92%, 50% 72%, 20% 92%, 30% 57%, 0 35%, 38% 35%)', '#e8a83a'],
  ['polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)', '#8d5ac4'],
  ['polygon(0 0, 100% 0, 100% 100%, 0 100%)', '#d15f8e'],
  ['polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%)', '#2fa8b8'],
  ['polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)', '#c96a2e'],
  ['circle(46%)', '#6a8ad6'],
  ['polygon(50% 3%, 100% 100%, 0 100%)', '#7a9c3a'],
  ['polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', '#d98a2b'],
  ['polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)', '#4e8f8f'],
];
const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let current = null;
export function mountArcade(body) {
  unmountArcade();
  const host = body.querySelector('.arcade-game');
  if (host) current = createGame(host);
}
export function unmountArcade() {
  if (current) { current(); current = null; }
}

function createGame(host) {
  const timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const every = (fn, ms) => { timers.push(setInterval(fn, ms)); };

  let levelIndex = 0, score = 0, pairsLeft = 0, cells = [], cols = 0, rows = 0;
  let sel = null, busy = false, state = 'ready';
  let timeLeft = 0, combo = 0, lastClear = 0, hints = 5, shuffles = 3;
  let audio = null;

  host.innerHTML = `
    <div class="ag-hud">
      <span class="ag-chip">第 <b data-f="level">1</b> / ${LEVELS.length} 关</span>
      <span class="ag-chip">得分 <b data-f="score">0</b></span>
      <span class="ag-chip">剩 <b data-f="pairs">0</b> 对</span>
      <span class="ag-chip ag-combo" data-f="combo" hidden>连击 ×0</span>
      <div class="ag-time"><i data-f="bar"></i></div>
      <span class="ag-clock" data-f="clock">--:--</span>
    </div>
    <div class="ag-stage" data-f="stage">
      <div class="ag-board" data-f="board"></div>
      <canvas class="ag-canvas" data-f="canvas"></canvas>
      <div class="ag-over" data-f="over"></div>
    </div>
    <div class="ag-tip">点两张相同图案的牌 · 连线最多拐两个弯 · 消完过关</div>
    <div class="ag-actions">
      <button type="button" class="ag-btn" data-act="hint">提示 <em data-f="hints">5</em></button>
      <button type="button" class="ag-btn" data-act="shuffle">洗牌 <em data-f="shuffles">3</em></button>
      <button type="button" class="ag-btn" data-act="pause">暂停</button>
      <button type="button" class="ag-btn" data-act="restart">重开</button>
    </div>
    <div class="ag-status" data-f="status">投币开始 · QQ 连连看</div>
  `;
  const f = name => host.querySelector(`[data-f="${name}"]`);
  const board = f('board'), stage = f('stage'), canvas = f('canvas'), over = f('over');

  // --- sound: short square-wave blips, synthesised (no files to load) -------
  function beep(freq, dur = 0.07, slide = 0, type = 'square', gain = 0.045) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(45, freq + slide), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(t); o.stop(t + dur);
    } catch (_) { /* audio is optional */ }
  }

  // --- board coordinates ---------------------------------------------------
  // The board is padded by a virtual ring of empty cells (r=-1 / r=rows,
  // c=-1 / c=cols), which is what lets a path run around the outside edge.
  const get = (r, c) => {
    if (r < -1 || r > rows || c < -1 || c > cols) return -1;   // wall
    if (r < 0 || r >= rows || c < 0 || c >= cols) return 0;    // outside ring
    return cells[r * cols + c];
  };
  const empty = (r, c) => get(r, c) === 0;

  function straight(p, q) {
    if (p.r === q.r) {
      for (let c = Math.min(p.c, q.c) + 1; c < Math.max(p.c, q.c); c++) if (!empty(p.r, c)) return false;
      return true;
    }
    if (p.c === q.c) {
      for (let r = Math.min(p.r, q.r) + 1; r < Math.max(p.r, q.r); r++) if (!empty(r, p.c)) return false;
      return true;
    }
    return false;
  }
  function oneTurn(a, b) {
    for (const p of [{ r: a.r, c: b.c }, { r: b.r, c: a.c }]) {
      if (!empty(p.r, p.c)) continue;
      if (straight(a, p) && straight(p, b)) return [a, p, b];
    }
    return null;
  }
  function twoTurns(a, b) {
    for (const [dr, dc] of DIRS) {
      let r = a.r + dr, c = a.c + dc;
      while (r >= -1 && r <= rows && c >= -1 && c <= cols && empty(r, c)) {
        const p = { r, c };
        if ((p.r === b.r || p.c === b.c) && straight(p, b)) return [a, p, b];
        const rest = oneTurn(p, b);
        if (rest) return [a, p, rest[1], b];
        r += dr; c += dc;
      }
    }
    return null;
  }
  function findPath(a, b) {
    if (a.r === b.r && a.c === b.c) return null;
    if ((a.r === b.r || a.c === b.c) && straight(a, b)) return [a, b];
    return oneTurn(a, b) || twoTurns(a, b);
  }
  function findPair() {
    const groups = new Map();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = cells[r * cols + c];
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ r, c });
    }
    for (const list of groups.values())
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (findPath(list[i], list[j])) return [list[i], list[j]];
    return null;
  }

  // --- generation ----------------------------------------------------------
  function newLevel() {
    const L = LEVELS[levelIndex];
    cols = L.cols; rows = L.rows;
    const pairs = (cols * rows) / 2;
    let deck = [];
    for (let i = 0; i < pairs; i++) {
      const k = 1 + (i % L.kinds);
      deck.push(k, k);
    }
    let guard = 0;
    do { shuffle(deck); cells = deck.slice(); } while (!findPair() && guard++ < 80);
    pairsLeft = pairs; timeLeft = L.seconds; combo = 0; sel = null; busy = false;
    hints = 5; shuffles = 3;
    board.style.setProperty('--cols', cols);
    board.style.setProperty('--rows', rows);
    renderBoard(); sync(); setState('playing');
    status(`第 ${levelIndex + 1} 关 · ${cols * rows} 张牌，开始！`);
  }

  function renderBoard() {
    board.innerHTML = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = cells[r * cols + c];
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'ag-tile' + (k ? '' : ' is-empty');
      t.dataset.r = r; t.dataset.c = c;
      if (k) {
        const [shape, color] = SYMBOLS[(k - 1) % SYMBOLS.length];
        t.innerHTML = `<i class="ag-sym" style="--sym:${shape};--symc:${color}"></i>`;
        t.setAttribute('aria-label', `第 ${r + 1} 行第 ${c + 1} 列 · 图案 ${k}`);
      } else {
        t.disabled = true;
      }
      board.appendChild(t);
    }
  }

  function tileAt(r, c) { return board.querySelector(`.ag-tile[data-r="${r}"][data-c="${c}"]`); }

  // --- drawing the connecting line ----------------------------------------
  function paintLine(path) {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tile = board.querySelector('.ag-tile');
    const cell = tile ? tile.getBoundingClientRect().width : 40;
    const pad = parseFloat(getComputedStyle(stage).paddingLeft) || cell / 2;
    const pts = path.map(p => [pad + (p.c + 0.5) * cell, pad + (p.r + 0.5) * cell]);
    g.clearRect(0, 0, rect.width, rect.height);
    g.lineWidth = Math.max(3, cell * 0.11);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(255, 214, 92, .96)';
    g.shadowColor = 'rgba(255, 170, 40, .9)'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    g.shadowBlur = 0; g.fillStyle = '#fff';
    for (const p of [pts[0], pts[pts.length - 1]]) {
      g.beginPath(); g.arc(p[0], p[1], cell * 0.13, 0, Math.PI * 2); g.fill();
    }
    later(() => { try { g.clearRect(0, 0, rect.width, rect.height); } catch (_) {} }, 340);
  }

  // --- interaction ---------------------------------------------------------
  function pick(r, c) {
    if (state !== 'playing' || busy) return;
    const k = cells[r * cols + c];
    if (!k) return;
    const t = tileAt(r, c);
    beep(520, 0.035);
    if (!sel) { sel = { r, c, k }; t.classList.add('is-sel'); return; }
    if (sel.r === r && sel.c === c) { t.classList.remove('is-sel'); sel = null; return; }
    const a = sel; sel = null;
    tileAt(a.r, a.c)?.classList.remove('is-sel');
    const path = (a.k === k) ? findPath(a, { r, c }) : null;
    if (!path) {
      beep(180, 0.11, -50, 'sawtooth', 0.035);
      t.classList.add('is-bad'); later(() => t.classList.remove('is-bad'), 260);
      status(a.k === k ? '这两张连不上，换个位置' : '图案不一样，再找找');
      return;
    }
    busy = true;
    paintLine(path);
    combo = (Date.now() - lastClear < 3500) ? combo + 1 : 1;
    lastClear = Date.now();
    const gain = 100 + (combo - 1) * 20;
    score += gain;
    beep(660 + Math.min(combo, 8) * 70, 0.09, 220);
    tileAt(a.r, a.c)?.classList.add('is-gone');
    t.classList.add('is-gone');
    status(combo > 1 ? `连击 ×${combo}　+${gain}` : `+${gain} 分`);
    later(() => {
      cells[a.r * cols + a.c] = 0; cells[r * cols + c] = 0; pairsLeft--;
      for (const p of [a, { r, c }]) {
        const el = tileAt(p.r, p.c);
        if (el) { el.className = 'ag-tile is-empty'; el.innerHTML = ''; el.disabled = true; }
      }
      busy = false; sync();
      if (pairsLeft === 0) { winLevel(); return; }
      if (!findPair()) reshuffle(true);
    }, 200);
  }

  function reshuffle(auto) {
    if (state !== 'playing') return;
    if (!auto) { if (shuffles <= 0) { status('洗牌次数用完啦'); return; } shuffles--; }
    const slots = [], vals = [];
    for (let i = 0; i < cells.length; i++) if (cells[i]) { slots.push(i); vals.push(cells[i]); }
    let guard = 0;
    do {
      shuffle(vals);
      slots.forEach((idx, i) => { cells[idx] = vals[i]; });
    } while (!findPair() && guard++ < 80);
    if (sel) { tileAt(sel.r, sel.c)?.classList.remove('is-sel'); sel = null; }
    renderBoard(); sync(); beep(420, 0.08, 160);
    status(auto ? '没有可消的了，自动洗牌' : '洗牌完成');
  }

  function hint() {
    if (state !== 'playing' || busy) return;
    if (hints <= 0) { status('提示次数用完啦'); return; }
    const pair = findPair();
    if (!pair) return;
    hints--;
    for (const p of pair) tileAt(p.r, p.c)?.classList.add('is-hint');
    later(() => { for (const p of pair) tileAt(p.r, p.c)?.classList.remove('is-hint'); }, 1600);
    beep(880, 0.06, 120);
    sync(); status('高亮了一对可以消的牌');
  }

  function togglePause() {
    if (state === 'playing') { setState('paused'); status('已暂停'); }
    else if (state === 'paused') { setState('playing'); status('继续'); }
  }

  function winLevel() {
    beep(880, 0.12, 220); later(() => beep(1170, 0.16, 260), 130);
    const bonus = Math.floor(timeLeft) * 5;
    score += bonus;
    if (levelIndex + 1 < LEVELS.length) {
      setState('levelup');
      status(`第 ${levelIndex + 1} 关通过！时间奖励 +${bonus}`);
    } else {
      setState('won');
      status(`全部通关！总分 ${score}`);
    }
    sync();
  }

  function setState(s) {
    state = s;
    over.hidden = (s === 'playing');
    if (s === 'playing') { over.innerHTML = ''; return; }
    const titles = {
      ready: ['投币开始', 'QQ 连连看 · 三关', '投 币 开 始'],
      paused: ['已暂停', '歇一会儿再打', '继 续'],
      levelup: [`第 ${levelIndex + 1} 关 通过`, `时间奖励 +${Math.floor(timeLeft) * 5} · 总分 ${score}`, '下 一 关'],
      won: ['全 部 通 关', `总分 ${score} · 一枚硬币换一整个下午`, '再 来 一 局'],
      lost: ['时 间 到', `本局得分 ${score}`, '投 币 再 来'],
    };
    const [title, sub, btn] = titles[s] || titles.ready;
    over.innerHTML = `<b>${title}</b><small>${sub}</small><button type="button" class="ag-btn ag-main" data-act="go">${btn}</button>`;
  }

  function go() {
    if (state === 'ready' || state === 'lost' || state === 'won') {
      levelIndex = 0; score = 0; newLevel();
    } else if (state === 'levelup') { levelIndex++; newLevel(); }
    else if (state === 'paused') setState('playing');
    beep(740, 0.1, 260);
  }

  function status(text) { f('status').textContent = text; }

  function sync() {
    f('level').textContent = levelIndex + 1;
    f('score').textContent = score;
    f('pairs').textContent = pairsLeft;
    f('hints').textContent = hints;
    f('shuffles').textContent = shuffles;
    const cb = f('combo');
    cb.hidden = combo < 2;
    cb.textContent = `连击 ×${combo}`;
    const total = LEVELS[Math.min(levelIndex, LEVELS.length - 1)].seconds;
    f('bar').style.width = Math.max(0, Math.min(100, (timeLeft / total) * 100)) + '%';
    const secs = Math.max(0, Math.ceil(timeLeft));
    const m = Math.floor(secs / 60), s = secs % 60;
    f('clock').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // A wall-clock tick: accurate even when the tab throttles timers.
  let lastTickAt = 0;
  every(() => {
    if (state !== 'playing') { lastTickAt = Date.now(); return; }
    const now = Date.now();
    if (!lastTickAt) lastTickAt = now;
    const dt = (now - lastTickAt) / 1000;
    lastTickAt = now;
    if (dt <= 0 || dt > 5) return;
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0; setState('lost'); beep(220, 0.35, -130, 'sawtooth', 0.05);
      status(`时间到 · 本局得分 ${score}`);
    }
    sync();
  }, 250);

  function onClick(e) {
    const tile = e.target.closest('.ag-tile');
    if (tile && !tile.disabled) { pick(+tile.dataset.r, +tile.dataset.c); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    switch (btn.dataset.act) {
      case 'go': go(); break;
      case 'hint': hint(); break;
      case 'shuffle': reshuffle(false); break;
      case 'pause': togglePause(); break;
      case 'restart': levelIndex = 0; score = 0; newLevel(); beep(520, 0.08, 120); break;
    }
  }
  function onKey(e) { e.stopPropagation(); }   // keep game keys out of the 3D world
  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);
  const onResize = () => { canvas.width = canvas.width; };
  window.addEventListener('resize', onResize);

  // Exposed only for browser smoke tests, not part of the game's UI.
  host.__arcade = {
    findPair,
    pick,
    state: () => ({ state, level: levelIndex + 1, score, pairsLeft, timeLeft, hints, shuffles }),
    cells: () => cells.slice(),
    dims: () => ({ cols, rows }),
  };

  board.style.setProperty('--cols', LEVELS[0].cols);
  board.style.setProperty('--rows', LEVELS[0].rows);
  cols = LEVELS[0].cols; rows = LEVELS[0].rows;
  cells = new Array(cols * rows).fill(0);
  renderBoard();
  setState('ready'); sync();

  return () => {
    timers.forEach(id => { clearTimeout(id); clearInterval(id); });
    host.removeEventListener('click', onClick);
    host.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    delete host.__arcade;
    try { if (audio) audio.close(); } catch (_) {}
  };
}
