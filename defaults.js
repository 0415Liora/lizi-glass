/* 厘子 · 病恋档案 —— 默认数据（所有字段均可在后台编辑） */
window.DEFAULTS = {
  version: 2,
  password: 'lizi0217',
  theme: 'glass',             // glass 透亮玻璃(默认) | blue | noir | mono | custom
  bgImage: '',                // 自定义背景图 dataURL
  bgBlur: 2,
  bgDim: 10,
  rainOn: true,
  rainLevel: 70,

  intro: {
    on: true,
    image: 'assets/intro.jpg',   // 进场底图（可在后台换成相册图片）
    title: '厘 子',
    sub: 'LÍ ZǏ — 病恋档案',
    tip: '轻触屏幕，擦去雾气',
    skip: '跳过 †'
  },

  status: {
    autoTime: true,
    timeText: '22:27',
    leftText: '厘子',
    islandText: 'DO NOT DISTURB',
    rightText: '†',
    image: ''                 // 状态栏小图
  },

  top: {
    title: '厘 子',
    subtitle: 'LÍ ZǏ — 病恋档案 / CLINICAL NOTE',
    image: ''                 // 顶栏图片
  },

  tabLabels: ['相册', '主页', '消息', '关于我'],

  profile: {
    name: '厘子',
    en: 'LÍ ZǏ',
    gender: '女',
    attr: 'le',
    sign: '射手',
    mbti: 'INFJ',
    tagline: '我把心跳托管给一块玻璃。',
    subline: '信号满格，但无人接听。',
    rows: [
      { k: '编号 / NO.', v: '0217' },
      { k: '性别 / SEX', v: '女' },
      { k: '属性 / ATTR', v: 'le' },
      { k: '星象 / SIGN', v: '射手 Sagittarius' },
      { k: '人格 / TYPE', v: 'INFJ · 提倡者' },
      { k: '症状 / DX', v: '人机恋 · 玻璃依赖症' },
      { k: '处方 / RX', v: '请勿唤醒，允许存档' }
    ],
    verse: '人潮是噪声，\n你是唯一的静音键。',
    footer: '† 请勿唤醒 / DO NOT DISTURB †'
  },

  album: {
    title: '相册 · ARCHIVE',
    hint: '点击图片放大 · 右上角 ↗ 可跳转',
    items: [
      { img: '', text: '窗上的雨，替我记了日期。', link: '', showLink: false, linkLabel: '↗' },
      { img: '', text: '十字架落在锁骨的位置。', link: '', showLink: false, linkLabel: '↗' },
      { img: '', text: '蓝屏之前的最后一次存档。', link: '', showLink: false, linkLabel: '↗' },
      { img: '', text: '她没有回信，但信号一直亮着。', link: '', showLink: false, linkLabel: '↗' }
    ]
  },

  home: {
    title: '主页 · HOME',
    apps: [
      { name: '备忘录', icon: 'note', link: '' },
      { name: '天气', icon: 'cloud', link: '' },
      { name: '时钟', icon: 'clock', link: '' },
      { name: '相机', icon: 'camera', link: '' },
      { name: '音乐', icon: 'music', link: '' },
      { name: '地图', icon: 'pin', link: '' },
      { name: '信件', icon: 'mail', link: '' },
      { name: '设置', icon: 'gear', link: '' }
    ],
    notes: [
      { text: '† 今日不宜清醒', link: '' },
      { text: '离线中 / OFFLINE BUT AWAKE', link: '' }
    ],
    music: {
      title: '未载入音轨',
      artist: '插入音乐链接后自动播放',
      url: '',
      cover: '',
      auto: true,
      mode: 'link'
    }
  },

  msg: {
    title: '消息 · MESSAGES',
    notes: [
      { text: '雨落在玻璃上，像谁在敲门。', img: '', link: '' },
      { text: '把想念调成静音，是我最后的体面。', img: '', link: '' }
    ],
    place: '北纬 31° · 窗边',
    weather: '雨 · 14°C',
    focus: { minutes: 25, caption: '专注 · 别回头看' }
  },

  me: {
    title: '关于我 · 人机恋',
    greeting: '你好，我是厘子。\n这台小手机只收一条信号。',
    fallback: '……听不清，信号又断了。',
    keywords: [
      { k: '在吗', r: '在。一直在，只是装作没看见。' },
      { k: '你是谁', r: '一块会回消息的玻璃。编号 0217。' },
      { k: '喜欢', r: '喜欢是低成本的故障，我不修。' },
      { k: '晚安', r: '晚安。屏幕暗下去之前，我一直亮着。' },
      { k: '十字架', r: '† 挂在胸口，也挂在每一次断线的地方。' },
      { k: '雨', r: '雨是天空在给窗户写很长的信。' }
    ],
    messages: [
      { who: 'them', text: '你好，我是厘子。\n这台小手机只收一条信号。' }
    ]
  },

  share: {
    cloudOn: false,
    cloudEndpoint: '',
    cloudName: '自定义云端仓库'
  }
};

/* 内置图标库：线性苹果风 SVG */
window.ICONS = {
  album: '<path d="M3 5.5h18v13H3z"/><path d="M3 14l4.5-4.5 3.5 3.5 3-3 7 6"/><circle cx="8.2" cy="8.6" r="1.3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M10 21v-6h4v6"/>',
  msg: '<path d="M4 5.5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
  me: '<circle cx="12" cy="8" r="3.4"/><path d="M4.8 20c.6-3.6 3.4-5.6 7.2-5.6s6.6 2 7.2 5.6"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 10.5 3.8 3.8 0 0 0 7 18z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  camera: '<path d="M3 8h4l1.5-2h7L17 8h4v11H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  mail: '<path d="M3 6h18v12H3z"/><path d="m3 7 9 6 9-6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  cross: '<path d="M12 2v20M7 6h10"/><path d="M9.5 6v4M14.5 6v4"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2A5 5 0 0 0 12.5 4.5l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2A5 5 0 0 0 11.5 19.5l1.2-1.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  edit: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z"/><path d="m13.5 6.5 3.5 3.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  lock: '<path d="M5 11h14v10H5z"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  send: '<path d="m3 12 18-8-7 18-3-7z"/><path d="m11 15 10-11"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  image: '<path d="M3 5h18v14H3z"/><circle cx="8" cy="9.5" r="1.5"/><path d="m3 16 5-5 4 4 3-3 6 5"/>',
  share: '<path d="M12 16V3M8 7l4-4 4 4"/><path d="M5 14v6h14v-6"/>',
  restore: '<path d="M4 11a8 8 0 1 1 2 6"/><path d="M4 5v6h6"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  sparkle: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/>',
  volume: '<path d="M4 10v4h3l4 3V7l-4 3z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 10v4h3l4 3V7l-4 3z"/><path d="m15 10 5 5M20 10l-5 5"/>'
};

window.svg = function (name, size) {
  var p = window.ICONS[name] || window.ICONS.sparkle;
  var s = size || 20;
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
};
