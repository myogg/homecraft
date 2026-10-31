// 点歌台的歌单。换歌只改这个文件，一行一首：
//
//   title   歌名
//   artist  歌手（不想显示就留空字符串）
//   src     音频直链——浏览器 <audio> 能直接放的那种，mp3 / m4a / ogg 都行
//
// 没有 src 的条目在点歌机上显示「待接入」，点了不报错、也不会卡住。
// 下面三首是占位用的试听曲（SoundHelix 的公共示例曲），换成你自己的歌单即可。
export const PLAYLIST = [
  { title: 'SoundHelix 1', artist: '试听 · 占位', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'SoundHelix 2', artist: '试听 · 占位', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'SoundHelix 3', artist: '试听 · 占位', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: '把歌名写在这里', artist: '', src: '' },
  { title: '再写一首', artist: '', src: '' },
];
