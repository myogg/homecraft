// 点歌台的播放器：把 world/playlist.js 的歌单铺进页面，点一首就放，
// 顺便把「正在放哪首」告诉世界里的两块屏（电视墙那台 + 点歌机自己）。
//
// 页面是每次打开时从 <article> 克隆进面板的，所以：
//   - 歌单在建好一面之后写进 <article> 本身，克隆自然带上；
//   - 点击用事件委托挂在 #panel（面板本体不重建），克隆里的按钮一样管用。
import { t } from '@engine/lang.js';
import { PLAYLIST } from './playlist.js';

const mmss = s => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export function mountJukebox(panel, onChange = () => {}) {
  const article = document.querySelector('#pages .page[data-station="jukebox"]');
  const list = article?.querySelector('[data-juke-list]');
  if (!list) return null;

  // ---------- 歌单 ----------
  list.textContent = '';
  PLAYLIST.forEach((song, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.song = String(i);
    if (!song.src) b.className = 'soon';
    b.innerHTML = `<i>${String(i + 1).padStart(2, '0')}</i><b></b><span></span>`;
    b.querySelector('b').textContent = song.title;
    b.querySelector('span').textContent = song.src ? song.artist : t('待接入音频', 'no audio yet');
    li.append(b);
    list.append(li);
  });

  // ---------- 播放 ----------
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = 0.72;
  let index = -1, note = '', playing = false, lastScreen = 0;

  const each = (attr, fn) => { for (const el of document.querySelectorAll(`[${attr}]`)) fn(el); };
  // force：换歌/暂停这类状态变化立刻重画；进度只按 0.6 s 节流回写一次，
  // 免得每 1/4 秒重传两张 canvas 贴图。
  function paint(force = false) {
    const song = PLAYLIST[index];
    const dur = audio.duration;
    const progress = dur > 0 ? Math.min(1, audio.currentTime / dur) : 0;
    const state = {
      index, playing, progress,
      title: song ? song.title : '',
      artist: song ? song.artist : '',
      time: `${mmss(audio.currentTime)} / ${dur > 0 ? mmss(dur) : '--:--'}`,
      note,
    };
    each('data-juke-title', el => { el.textContent = song ? song.title : t('还没有放歌', 'Nothing playing'); });
    each('data-juke-artist', el => {
      el.textContent = note || (song ? (song.artist || t('点歌台', 'Jukebox')) : t('点一首，客厅就响了', 'Pick a song and the room starts'));
    });
    each('data-juke-time', el => { el.textContent = state.time; });
    each('data-juke-state', el => { el.textContent = playing ? t('暂停', 'Pause') : t('播放', 'Play'); });
    for (const el of document.querySelectorAll('[data-song]')) el.classList.toggle('on', Number(el.dataset.song) === index);
    const now = performance.now();
    if (force || now - lastScreen > 600) { lastScreen = now; onChange(state); }
  }

  function play(i) {
    const song = PLAYLIST[i];
    if (!song) return;
    index = i; note = '';
    if (!song.src) { playing = false; audio.pause(); note = t('这首还没接音频链接', 'This one has no audio link yet'); paint(true); return; }
    audio.src = song.src;
    audio.play().then(() => { playing = true; paint(true); }).catch(err => {
      playing = false;
      note = t('放不出来：', 'Cannot play: ') + (err?.message || t('链接可能失效了', 'the link may be dead'));
      paint(true);
    });
  }
  const toggle = () => {
    if (index < 0) return play(0);
    if (audio.paused) audio.play().then(() => { playing = true; paint(true); }).catch(() => {});
    else { audio.pause(); playing = false; paint(true); }
  };
  const step = dir => {
    const n = PLAYLIST.length;
    if (!n) return;
    let i = index < 0 ? (dir > 0 ? -1 : 0) : index;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (PLAYLIST[i].src) return play(i);
    }
  };

  audio.addEventListener('timeupdate', () => paint());
  audio.addEventListener('loadedmetadata', () => paint(true));
  audio.addEventListener('durationchange', () => paint(true));
  audio.addEventListener('play', () => { playing = true; paint(true); });
  audio.addEventListener('pause', () => { playing = false; paint(true); });
  audio.addEventListener('ended', () => { playing = false; step(1); });
  audio.addEventListener('error', () => {
    playing = false;
    note = t('音频链接打不开', 'The audio link will not open');
    paint(true);
  });
  addEventListener('pagehide', () => audio.pause());

  panel.addEventListener('click', e => {
    const row = e.target.closest('[data-song]');
    if (row) { play(Number(row.dataset.song)); return; }
    const act = e.target.closest('[data-juke]');
    if (!act) return;
    const what = act.dataset.juke;
    if (what === 'toggle') toggle();
    else if (what === 'next') step(1);
    else if (what === 'prev') step(-1);
  });

  paint(true);
  return { play, toggle, state: () => ({ index, playing, title: PLAYLIST[index]?.title || '' }) };
}
