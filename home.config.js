export default {
  name: 'myogg 的家',
  // 64×64 PNG, 4px arms, ≤ 18000 bytes. docs/avatar.md
  skin: 'assets/skin-template.png',
  languages: ['zh', 'en'],
  // weather: { city: '上海', cityEn: 'Shanghai', latitude: 31.23, longitude: 121.47, timezone: 'Asia/Shanghai' },
  weather: null,
  dock: ['about', 'works', 'kitchen', 'bedroom', 'deck', 'blog', 'mailbox', 'phone'],
  mailbox: { endpoint: '', email: 'xxjss@hotmail.com', turnstileSitekey: '' },
  badge: true,
};
