export default {
  name: '姜小小的家',
  // 64×64 PNG, 4px arms, ≤ 18000 bytes. docs/avatar.md
  skin: 'assets/skin-template.png',
  languages: ['zh', 'en'],
  // 天气：接入上海实时天气（Open-Meteo），菜单里可手动切夜晚/下雨/雷雨等。
  weather: { city: '上海', cityEn: 'Shanghai', latitude: 31.23, longitude: 121.47, timezone: 'Asia/Shanghai' },
  // 加载即跟随上海实时时间（含清晨/上午/白天/黄昏/夜晚），而非固定白天。
  start: { time: 'auto' },
  dock: ['about', 'works', 'kitchen', 'bedroom', 'deck', 'blog', 'mailbox', 'phone'],
  mailbox: { endpoint: '', email: 'xxjss@hotmail.com', turnstileSitekey: '' },
  badge: true,
};
