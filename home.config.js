export default {
  name: '姜小小的家',
  // 64×64 PNG, 4px arms, ≤ 18000 bytes. docs/avatar.md
  skin: 'assets/skin-template.png',
  languages: ['zh', 'en'],
  // 天气：接入上海实时天气（Open-Meteo），菜单里可手动切夜晚/下雨/雷雨等。
  weather: { city: '上海', cityEn: 'Shanghai', latitude: 31.23, longitude: 121.47, timezone: 'Asia/Shanghai' },
  // 加载即跟随上海实时时间（含清晨/上午/白天/黄昏/夜晚），而非固定白天。
  start: { time: 'auto' },
  // 底部 Dock 的入口顺序。博客（blog）与关于（about）不再单列：
  // 走进书房/客厅会弹出提示卡直达，按 F 也仍可打开对应页面。
  dock: ['works', 'kitchen', 'bedroom', 'deck', 'mailbox', 'phone'],
  mailbox: { endpoint: '', email: 'xxjss@hotmail.com', turnstileSitekey: '' },
  badge: true,
};
