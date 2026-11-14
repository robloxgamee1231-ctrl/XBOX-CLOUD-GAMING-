import type { CatalogProduct, FriendPresence, HomeConsole, LibraryData, UserProfile } from '../types';

function makePosterDataUri(
  title: string,
  subtitle: string,
  c1: string,
  c2: string,
  accent: string,
  tag: string,
): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeSub = subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const words = safeTitle.split(' ');
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.72" cy="0.28" r="0.68">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.58"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.09"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <rect width="600" height="600" fill="url(#glow)"/>
    <rect width="600" height="600" fill="url(#sheen)"/>
    <g fill="none" stroke="${accent}" stroke-opacity="0.28">
      <circle cx="465" cy="145" r="145" stroke-width="2.5"/>
      <circle cx="465" cy="145" r="95" stroke-width="1.5"/>
      <circle cx="465" cy="145" r="46" stroke-width="1"/>
    </g>
    <path d="M-40 475 L640 220" stroke="#ffffff" stroke-opacity="0.06" stroke-width="46"/>
    <path d="M-40 535 L640 280" stroke="${accent}" stroke-opacity="0.12" stroke-width="14"/>
    <rect x="40" y="38" width="130" height="30" rx="15" fill="#000000" fill-opacity="0.48" stroke="${accent}" stroke-opacity="0.55"/>
    <text x="105" y="58" text-anchor="middle" fill="#ffffff" font-family="Inter,system-ui,sans-serif" font-weight="700" font-size="13" letter-spacing="1.2">${tag}</text>
    <text x="42" y="${line2 ? 404 : 448}" fill="#ffffff" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="44">${line1}</text>
    ${line2 ? `<text x="42" y="454" fill="#ffffff" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="44">${line2}</text>` : ''}
    <text x="42" y="498" fill="#cbd5e1" font-family="Inter,system-ui,sans-serif" font-weight="600" font-size="21">${safeSub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeHeroDataUri(title: string, c1: string, c2: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0.8">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <radialGradient id="orb" cx="0.76" cy="0.38" r="0.55">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.62"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#bg)"/>
    <rect width="1600" height="900" fill="url(#orb)"/>
    <g stroke="#ffffff" stroke-opacity="0.07" fill="none">
      <circle cx="1210" cy="360" r="240" stroke-width="3"/>
      <circle cx="1210" cy="360" r="350" stroke-width="1.5"/>
      <circle cx="1210" cy="360" r="130" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
      <path d="M200 900 L1500 120" stroke-width="84"/>
      <path d="M550 900 L1650 260" stroke-width="24"/>
    </g>
    <title>${title.replace(/</g, '')}</title>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEMO_PROFILE: UserProfile = {
  gamertag: 'PSBoxExplorer',
  xuid: '2535432109876543',
  gamerpicUrl: './assets/icon0.png',
  gamerscore: '42850',
  subscription: 'Ultimate',
  playtimeRemainingSec: 12 * 3600 + 35 * 60,
  playtimeMaxSec: 15 * 3600,
  playtimeUnlimited: false,
};

export const DEMO_FRIENDS: FriendPresence[] = [
  {
    xuid: '1001',
    gamertag: 'NovaSpartan',
    gamerpicUrl: './assets/icon0.png',
    presenceState: 'Online',
    presenceText: 'Halo Infinite — Big Team Battle',
    titleId: 'halo-infinite',
    device: 'XboxSeries',
    isGame: true,
  },
  {
    xuid: '1002',
    gamertag: 'DriftKingBR',
    gamerpicUrl: './assets/icon0.png',
    presenceState: 'Online',
    presenceText: 'Forza Horizon 5 — Horizon Mexico',
    titleId: 'fh5',
    device: 'Cloud',
    isGame: true,
  },
  {
    xuid: '1003',
    gamertag: 'CaptainVega',
    gamerpicUrl: './assets/icon0.png',
    presenceState: 'Online',
    presenceText: 'Sea of Thieves — High Seas',
    titleId: 'sea-of-thieves',
    device: 'Cloud',
    isGame: true,
  },
];

export const DEMO_CONSOLES: HomeConsole[] = [
  {
    serverId: 'F400000000000001',
    deviceName: 'Living Room Series X',
    consoleType: 'XboxSeriesX',
    powerState: 'ConnectedStandby',
    playPath: '/v5/sessions/home/play',
    outOfHomeWarning: false,
    wirelessWarning: false,
  },
  {
    serverId: 'F400000000000002',
    deviceName: 'Bedroom Series S',
    consoleType: 'XboxSeriesS',
    powerState: 'On',
    playPath: '/v5/sessions/home/play',
    outOfHomeWarning: true,
    wirelessWarning: true,
  },
];

export function getDemoLibrary(): LibraryData {
  const raw = [
    {
      productId: '9PP5G1F0C2B6',
      xcloudTitleId: 'halo-infinite',
      xboxTitleId: '2043073184',
      title: 'Halo Infinite',
      publisher: 'Xbox Game Studios',
      description:
        'When all hope is lost and humanity’s fate hangs in the balance, the Master Chief is ready to confront the most ruthless foe he’s ever faced.',
      c1: '#0a1f1c',
      c2: '#0c1118',
      accent: '#22c55e',
      tag: 'SHOOTER',
      categories: ['Shooter', 'Action & Adventure'],
      plan: 1 as const,
      ratingAge: 'T',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: false,
      playable: true,
      isFreeToPlay: false,
      friends: [DEMO_FRIENDS[0]],
    },
    {
      productId: '9NNX1VVR3KNQ',
      xcloudTitleId: 'fh5',
      xboxTitleId: '1650317994',
      title: 'Forza Horizon 5',
      publisher: 'Xbox Game Studios',
      description:
        'Explore the vibrant open world landscapes of Mexico with limitless, fun driving action in hundreds of the world’s greatest cars.',
      c1: '#2d132c',
      c2: '#110d1b',
      accent: '#f43f5e',
      tag: 'RACING',
      categories: ['Racing & Flying'],
      plan: 1 as const,
      ratingAge: 'E',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: false,
      touch: false,
      playable: true,
      isFreeToPlay: false,
      friends: [DEMO_FRIENDS[1]],
    },
    {
      productId: '9BT5P23D5499',
      xcloudTitleId: 'fortnite',
      xboxTitleId: '267695549',
      title: 'Fortnite',
      publisher: 'Epic Games',
      description:
        'Create, play, and battle with friends for free in Fortnite. Explore islands, Zero Build, Battle Royale, and Festival.',
      c1: '#0f2247',
      c2: '#090e1c',
      accent: '#38bdf8',
      tag: 'FREE TO PLAY',
      categories: ['Shooter', 'Battle Royale'],
      plan: 0 as const,
      ratingAge: 'T',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: true,
      playable: true,
      isFreeToPlay: true,
      friends: [],
    },
    {
      productId: '9P4NJFH1706Z',
      xcloudTitleId: 'indiana-jones',
      xboxTitleId: '1828394811',
      title: 'Indiana Jones & the Great Circle',
      publisher: 'Bethesda Softworks',
      description:
        'Uncover one of history’s greatest mysteries in a first-person, single-player adventure set between Raiders of the Lost Ark and The Last Crusade.',
      c1: '#2a1c0d',
      c2: '#0d0c0b',
      accent: '#f59e0b',
      tag: 'ADVENTURE',
      categories: ['Action & Adventure'],
      plan: 3 as const,
      ratingAge: 'T',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: false,
      touch: false,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9NCBL7637H5P',
      xcloudTitleId: 'starfield',
      xboxTitleId: '1509278493',
      title: 'Starfield',
      publisher: 'Bethesda Game Studios',
      description:
        'In this next generation role-playing game set amongst the stars, create any character you want and explore with unparalleled freedom.',
      c1: '#111936',
      c2: '#090c14',
      accent: '#818cf8',
      tag: 'RPG',
      categories: ['Role Playing'],
      plan: 3 as const,
      ratingAge: 'M',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: false,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9P6G9G2M1X9K',
      xcloudTitleId: 'sea-of-thieves',
      xboxTitleId: '1729304111',
      title: 'Sea of Thieves',
      publisher: 'Xbox Game Studios',
      description:
        'Set sail in a shared-world adventure where every sail on the horizon is another crew of real players.',
      c1: '#072a2e',
      c2: '#091217',
      accent: '#14b8a6',
      tag: 'CO-OP',
      categories: ['Action & Adventure', 'Multiplayer'],
      plan: 2 as const,
      ratingAge: 'T',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: true,
      playable: true,
      isFreeToPlay: false,
      friends: [DEMO_FRIENDS[2]],
    },
    {
      productId: '9MT5NJ5W7B8Z',
      xcloudTitleId: 'flight-sim-2024',
      xboxTitleId: '1922837100',
      title: 'Flight Simulator 2024',
      publisher: 'Xbox Game Studios',
      description:
        'Pursue your aviation career with dynamically generated missions around the globe in stunning true-to-life detail.',
      c1: '#0b2239',
      c2: '#08101b',
      accent: '#60a5fa',
      tag: 'SIMULATION',
      categories: ['Simulation', 'Racing & Flying'],
      plan: 3 as const,
      ratingAge: 'E',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: false,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9N1G9K7C5B3T',
      xcloudTitleId: 'cyberpunk-2077',
      xboxTitleId: '2093847123',
      title: 'Cyberpunk 2077',
      publisher: 'CD PROJEKT RED',
      description:
        'An open-world, action-adventure RPG set in the megalopolis of Night City, where you play as a cyberpunk mercenary wrapped up in a do-or-die fight for survival.',
      c1: '#2f2708',
      c2: '#120d16',
      accent: '#eab308',
      tag: 'OWNED RPG',
      categories: ['Role Playing', 'Action & Adventure'],
      plan: 0 as const,
      ratingAge: 'M',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: false,
      playable: true,
      purchasable: true,
      price: { list: 29.99, msrp: 59.99, currency: 'USD', formatted: '$29.99' },
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9P2Z8X4K1M9Q',
      xcloudTitleId: 'hi-fi-rush',
      xboxTitleId: '1488112233',
      title: 'Hi-Fi RUSH',
      publisher: 'Tango Gameworks',
      description:
        'Feel the beat as wannabe rockstar Chai and his ragtag team fight against an evil robotics megacorp with raucous rhythm combat.',
      c1: '#2c130d',
      c2: '#120a14',
      accent: '#fb923c',
      tag: 'RHYTHM',
      categories: ['Action & Adventure', 'Music'],
      plan: 2 as const,
      ratingAge: 'T',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: false,
      touch: true,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9N3K2P7H4V8L',
      xcloudTitleId: 'bo6',
      xboxTitleId: '1988771122',
      title: 'Call of Duty: Black Ops 6',
      publisher: 'Activision',
      description:
        'Forced to go rogue. Hunted from within. Experience a signature Black Ops spy action thriller campaign, best-in-class Multiplayer, and round-based Zombies.',
      c1: '#29120b',
      c2: '#0b0b0e',
      accent: '#ef4444',
      tag: 'FPS',
      categories: ['Shooter', 'Multiplayer'],
      plan: 3 as const,
      ratingAge: 'M',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: false,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9N7X5B1D2Q9W',
      xcloudTitleId: 'persona-3-reload',
      xboxTitleId: '1766554433',
      title: 'Persona 3 Reload',
      publisher: 'ATLUS',
      description:
        'Step into the shoes of a transfer student thrust into an unexpected fate when entering the hour hidden between one day and the next.',
      c1: '#0a1f3d',
      c2: '#0a0d1c',
      accent: '#3b82f6',
      tag: 'JRPG',
      categories: ['Role Playing'],
      plan: 2 as const,
      ratingAge: 'M',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: false,
      touch: true,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9P9C4M2V6R8J',
      xcloudTitleId: 'stalker-2',
      xboxTitleId: '1655443322',
      title: 'S.T.A.L.K.E.R. 2',
      publisher: 'GSC Game World',
      description:
        'Discover the vast Chornobyl Exclusion Zone full of dangerous enemies, deadly anomalies, and powerful artifacts.',
      c1: '#1a2315',
      c2: '#090c0a',
      accent: '#84cc16',
      tag: 'SURVIVAL',
      categories: ['Shooter', 'Action & Adventure'],
      plan: 3 as const,
      ratingAge: 'M',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: true,
      touch: false,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9N5B8T1K3W4Y',
      xcloudTitleId: 'minecraft-legends',
      xboxTitleId: '1455667788',
      title: 'Minecraft Legends',
      publisher: 'Mojang Studios',
      description:
        'Discover the mysteries of Minecraft Legends, a new action strategy game. Explore a gentle land of rich resources and lush biomes.',
      c1: '#0e281a',
      c2: '#0a1210',
      accent: '#10b981',
      tag: 'STRATEGY',
      categories: ['Action & Adventure', 'Strategy'],
      plan: 1 as const,
      ratingAge: 'E10+',
      ratingSystem: 'ESRB',
      platform: 'XB1',
      mouseKeyboard: false,
      touch: true,
      playable: true,
      isFreeToPlay: false,
      friends: [],
    },
    {
      productId: '9N8W4M2Q7P1R',
      xcloudTitleId: 'elden-ring',
      xboxTitleId: '1887766554',
      title: 'ELDEN RING',
      publisher: 'Bandai Namco Entertainment',
      description:
        'Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.',
      c1: '#231e0f',
      c2: '#0c0c0d',
      accent: '#d97706',
      tag: 'STORE',
      categories: ['Role Playing'],
      plan: 0 as const,
      ratingAge: 'M',
      ratingSystem: 'ESRB',
      platform: 'XSX',
      mouseKeyboard: false,
      touch: false,
      playable: false,
      purchasable: true,
      price: { list: 59.99, msrp: 59.99, currency: 'USD', formatted: '$59.99' },
      isFreeToPlay: false,
      friends: [],
    },
  ];

  const products: CatalogProduct[] = raw.map((g) => ({
    productId: g.productId,
    xcloudTitleId: g.xcloudTitleId,
    xboxTitleId: g.xboxTitleId,
    title: g.title,
    publisher: g.publisher,
    description: g.description,
    tileUrl: makePosterDataUri(g.title, g.publisher, g.c1, g.c2, g.accent, g.tag),
    posterUrl: makePosterDataUri(g.title, g.publisher, g.c1, g.c2, g.accent, g.tag),
    heroUrl: makeHeroDataUri(g.title, g.c1, g.c2, g.accent),
    categories: g.categories,
    plan: g.plan,
    ratingAge: g.ratingAge,
    ratingSystem: g.ratingSystem,
    isFreeToPlay: g.isFreeToPlay,
    platform: g.platform,
    mouseKeyboard: g.mouseKeyboard,
    touch: g.touch,
    playable: g.playable,
    purchasable: g.purchasable,
    price: g.price,
    friends: g.friends,
  }));

  return {
    demoMode: true,
    recentIds: ['9PP5G1F0C2B6', '9NNX1VVR3KNQ', '9BT5P23D5499', '9N3K2P7H4V8L', '9P4NJFH1706Z'],
    popularIds: [
      '9PP5G1F0C2B6',
      '9N3K2P7H4V8L',
      '9NNX1VVR3KNQ',
      '9P4NJFH1706Z',
      '9NCBL7637H5P',
      '9P6G9G2M1X9K',
      '9P9C4M2V6R8J',
    ],
    recentlyAddedIds: ['9P4NJFH1706Z', '9N3K2P7H4V8L', '9P9C4M2V6R8J', '9MT5NJ5W7B8Z', '9N7X5B1D2Q9W', '9P2Z8X4K1M9Q'],
    freeToPlayIds: ['9BT5P23D5499'],
    ownedIds: ['9N1G9K7C5B3T', '9N8W4M2Q7P1R'],
    products,
    regions: [
      { name: 'EASTUS', baseUri: 'https://eus.gssv-play-prod.xboxlive.com', isDefault: true },
      { name: 'EASTUS2', baseUri: 'https://eus2.gssv-play-prod.xboxlive.com', isDefault: false },
      { name: 'WESTUS2', baseUri: 'https://wus2.gssv-play-prod.xboxlive.com', isDefault: false },
      { name: 'BRAZILSOUTH', baseUri: 'https://brs.gssv-play-prod.xboxlive.com', isDefault: false },
      { name: 'UKSOUTH', baseUri: 'https://uks.gssv-play-prod.xboxlive.com', isDefault: false },
      { name: 'WESTEUROPE', baseUri: 'https://weu.gssv-play-prod.xboxlive.com', isDefault: false },
      { name: 'JAPANEAST', baseUri: 'https://jpe.gssv-play-prod.xboxlive.com', isDefault: false },
    ],
  };
}
