// 点歌台的歌单。换歌只改这个文件，一行一首：
//
//   title   歌名
//   artist  歌手（不想显示就留空字符串）
//   src     音频直链——浏览器 <audio> 能直接放的那种，mp3 / m4a / ogg 都行
//
// 没有 src 的条目在点歌机上显示「待接入」，点了不报错、也不会卡住。
// 临时说明：第 6 首「害我受了伤」原文件是 wma，浏览器 <audio> 放不了，
// 先拿掉；等转成 mp3 拿到直链后，在下面加回这一行即可：
//   { title: '害我受了伤', artist: '黄蓉', src: 'https://i.134688.xyz/file/...mp3' },
export const PLAYLIST = [
  { title: '胡广生', artist: '任素汐', src: 'https://i.134688.xyz/file/1793492618523_胡广生_-_任素汐.mp3' },
  { title: '祈神怜', artist: '一颗狼星', src: 'https://i.134688.xyz/file/1793492833755_祈神怜_-_一颗狼星.mp3' },
  { title: '离别开出花', artist: '就是南方凯', src: 'https://i.134688.xyz/file/1793492985078_离别开出花_-_就是南方凯.mp3' },
  { title: '若月亮没来（若是月亮还没来）', artist: '王宇宙Leto、乔浚丞', src: 'https://i.134688.xyz/file/1793493057640_若月亮没来__若是月亮还没来__-_王宇宙Leto、乔浚丞.mp3' },
  { title: '我头回过桥', artist: '威猛先生、尹默陌', src: 'https://i.134688.xyz/file/1793493188990_我头回过桥_-_威猛先生、尹默陌.mp3' },
];
