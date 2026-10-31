// 点歌台的歌单。换歌只改这个文件，一行一首：
//
//   title   歌名
//   artist  歌手（不想显示就留空字符串）
//   src     音频直链——浏览器 <audio> 能直接放的那种，mp3 / m4a / ogg 都行
//
// 没有 src 的条目在点歌机上显示「待接入」，点了不报错、也不会卡住。
//
// 下面这些是免版权（royalty-free）公共试听曲，用来先把点歌台填满、确认能正常
// 上一首 / 下一首 / 随机播放。换成你自己的歌单时，把每一行的 title / artist / src
// 改成你的歌名和「浏览器能直接访问的 mp3 直链」即可（163、QQ、Spotify 等需要
// 登录或走后端代理，给不了直链，放这里放不了）。
export const PLAYLIST = [
  { title: '试听曲 1 · Sunburst', artist: '免版权 · SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: '试听曲 2 · Midnight', artist: '免版权 · SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: '试听曲 3 · Daydream', artist: '免版权 · SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: '试听曲 4 · Pulse', artist: '免版权 · SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { title: '试听曲 5 · Horizon', artist: '免版权 · SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { title: '试听曲 6 · Echoes', artist: '免版权 · SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
];
