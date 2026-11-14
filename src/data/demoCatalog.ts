import type { CatalogProduct, FriendPresence, HomeConsole, LibraryData, UserProfile } from '../types';

export function makePosterFallbackUri(title: string, subtitle: string): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeSub = subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f291e"/>
        <stop offset="100%" stop-color="#0b0e14"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="480" cy="120" r="140" fill="#107c10" fill-opacity="0.22"/>
    <text x="40" y="450" fill="#ffffff" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="38">${safeTitle.slice(0, 26)}</text>
    <text x="40" y="496" fill="#94a3b8" font-family="Inter,system-ui,sans-serif" font-weight="600" font-size="20">${safeSub.slice(0, 32)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function img(appsId: string, width = 600): string {
  return `https://play.xbox.com/media/images/v1/product/image/${appsId}?imwidth=${width}&blurSigma=0&q=100`;
}

function editorial(id: string): string {
  return `https://play.xbox.com/media/images/v1/editorial/creativeservice/${id}?imwidth=1280&blurSigma=0`;
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
    titleId: '9PP5G1F0C2B6',
    device: 'XboxSeries',
    isGame: true,
  },
  {
    xuid: '1002',
    gamertag: 'DriftKingBR',
    gamerpicUrl: './assets/icon0.png',
    presenceState: 'Online',
    presenceText: 'Forza Horizon 6 — Tokyo City',
    titleId: '9N431PX143P8',
    device: 'Cloud',
    isGame: true,
  },
  {
    xuid: '1003',
    gamertag: 'VaultWanderer',
    gamerpicUrl: './assets/icon0.png',
    presenceState: 'Online',
    presenceText: 'Fortnite — Zero Build',
    titleId: 'BT5P2X999VH2',
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

interface SeedGame {
  productId: string;
  xcloudTitleId: string;
  xboxTitleId?: string;
  title: string;
  publisher: string;
  description: string;
  tileAppId: string;
  heroUrl?: string;
  categories: string[];
  plan: 0 | 1 | 2 | 3;
  ratingAge: string;
  ratingSystem?: string;
  platform?: string;
  mouseKeyboard?: boolean;
  touch?: boolean;
  isFreeToPlay?: boolean;
  purchasable?: boolean;
  price?: { list: number; msrp: number; currency: string; formatted: string };
  friends?: FriendPresence[];
}

const REAL_CLOUD_GAMES: SeedGame[] = [
  {
    productId: 'BT5P2X999VH2',
    xcloudTitleId: 'BT5P2X999VH2',
    title: 'Fortnite',
    publisher: 'Epic Games Inc.',
    description:
      'Create, play, and battle with friends for free in Fortnite. Drop into Battle Royale, Zero Build, Reload, LEGO Fortnite, and Fortnite Festival directly via Xbox Cloud Gaming.',
    tileAppId: 'apps.52548.70702278257994163.f7265b8a-f10e-49c4-8115-73c4d800af63.a0e057ff-c216-4206-a6b9-65bfc7d54fb0',
    heroUrl: editorial('9144f5ac-06e5-5d13-f915-bb5d9c7a00f7_4383832130455494943_128000000006474449_assets__featuredheroimageuri_1793350944651.jpg'),
    categories: ['Shooter', 'Action & adventure'],
    plan: 0,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: true,
    touch: true,
    isFreeToPlay: true,
    friends: [DEMO_FRIENDS[2]],
  },
  {
    productId: '9N431PX143P8',
    xcloudTitleId: '9N431PX143P8',
    title: 'Forza Horizon 6',
    publisher: 'Xbox Game Studios',
    description:
      'Discover the breathtaking landscapes of Japan in over 550 real-world cars and become a racing Legend at the Horizon Festival across Tokyo City and mountain touge roads.',
    tileAppId: 'apps.24935.14202278764680089.8e4c786a-0a1c-4737-a244-0bdfa34aab7b.40c11e20-8ff6-4db3-9365-faad9fa06d1a',
    heroUrl: editorial('ee096d89-b4f9-139e-0aec-996847dc2a5e_4383832130455494943_128000000006467249_assets__featuredheroimageuri_1792988161161.jpg'),
    categories: ['Racing & flying'],
    plan: 3,
    ratingAge: 'E',
    platform: 'XSX',
    mouseKeyboard: false,
    touch: false,
    purchasable: true,
    price: { list: 52.49, msrp: 69.99, currency: 'USD', formatted: '$52.49' },
    friends: [DEMO_FRIENDS[1]],
  },
  {
    productId: '9PP5G1F0C2B6',
    xcloudTitleId: '9PP5G1F0C2B6',
    title: 'Halo Infinite',
    publisher: 'Xbox Game Studios',
    description:
      'Experience Halo’s celebrated multiplayer reimagined and free-to-play, plus Master Chief’s epic Zeta Halo campaign with Forge and Firefight.',
    tileAppId: 'apps.20857.14330850369313893.a687698c-b891-44f6-9576-fe28978ce915.8d309ca3-e6ec-47e8-8009-a65f7e2e907b',
    heroUrl: img('apps.47030.14330850369313893.a687698c-b891-44f6-9576-fe28978ce915.ce613c75-aac4-4721-9941-6a254d061488', 1280),
    categories: ['Shooter', 'Action & adventure'],
    plan: 2,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: true,
    touch: false,
    isFreeToPlay: true,
    friends: [DEMO_FRIENDS[0]],
  },
  {
    productId: 'BX3M8L83BBRW',
    xcloudTitleId: 'BX3M8L83BBRW',
    title: 'Cyberpunk 2077',
    publisher: 'CD PROJEKT RED',
    description:
      'An open-world, action-adventure RPG set in the megalopolis of Night City, featuring the Edgerunners 2 Update and cyberware customization.',
    tileAppId: 'apps.47379.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.89bb995b-b066-4a53-9fe4-0260ce07e894',
    heroUrl: editorial('acc20e08-12d6-463d-dab4-8f67b8787ea0_4383832130455494943_128000000006454709_assets__featuredheroimageuri_1792619059673.jpg'),
    categories: ['RPG', 'Action & adventure'],
    plan: 0,
    ratingAge: 'M',
    platform: 'XSX',
    mouseKeyboard: true,
    touch: false,
    purchasable: true,
    price: { list: 59.99, msrp: 59.99, currency: 'USD', formatted: '$59.99' },
  },
  {
    productId: '9N8PMW7QMD3D',
    xcloudTitleId: '9N8PMW7QMD3D',
    title: 'Call of Duty: Warzone',
    publisher: 'Activision Publishing Inc.',
    description:
      'Welcome to Call of Duty: Warzone, the massive free-to-play combat arena featuring Battle Royale, Resurgence, and Plunder.',
    tileAppId: 'apps.20813.13739535057760905.64d1d264-ebf5-48f6-a5d3-2ac9c96b636b.fc5db7bc-2c84-4d72-9351-9f1e0985a53d',
    categories: ['Shooter'],
    plan: 0,
    ratingAge: 'M',
    platform: 'XSX',
    mouseKeyboard: true,
    touch: false,
    isFreeToPlay: true,
  },
  {
    productId: '9N4PT8HGCDHQ',
    xcloudTitleId: '9N4PT8HGCDHQ',
    title: 'Call of Duty: Black Ops 6',
    publisher: 'Activision Publishing Inc.',
    description:
      'Forced to go rogue. Hunted from within. Experience a signature Black Ops spy action thriller campaign, Multiplayer, and round-based Zombies.',
    tileAppId: 'apps.28966.14207097610490811.5b338e31-5c12-4d95-9a2a-2f16ceb01377.acc0294d-61eb-49e2-a059-758d5b1227d4',
    categories: ['Shooter'],
    plan: 3,
    ratingAge: 'M',
    platform: 'XSX',
    mouseKeyboard: true,
    touch: false,
  },
  {
    productId: '9NLKS78C4F3Z',
    xcloudTitleId: '9NLKS78C4F3Z',
    title: 'Marvel Rivals',
    publisher: 'NetEase Games',
    description:
      'A Super Hero Team-Based PvP Shooter! Assemble an all-star Marvel squad, devise countless strategies by combining powers to form unique Team-Up skills.',
    tileAppId: 'apps.34353.14045436403630681.cc137423-2355-4446-b7c3-22a6afc51480.3b442cea-ba4b-4bb9-bb64-6aed64ae5e05',
    categories: ['Shooter'],
    plan: 0,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: false,
    touch: false,
    isFreeToPlay: true,
  },
  {
    productId: '9NVD16NP4J8T',
    xcloudTitleId: '9NVD16NP4J8T',
    title: 'Gears of War: E-Day',
    publisher: 'Xbox Game Studios',
    description:
      'Experience the brutal horror of Emergence Day through the eyes of Marcus Fenix in the origin story of one of gaming’s most acclaimed sagas.',
    tileAppId: 'apps.58579.13978914104035031.46ab30c4-87b3-48d6-9e4a-ed44b301b17a.0c0f53d8-d3af-4c48-a1a6-22b31c4ec463',
    categories: ['Shooter', 'Action & adventure'],
    plan: 3,
    ratingAge: 'M',
    platform: 'XSX',
    mouseKeyboard: true,
    touch: false,
  },
  {
    productId: '9PM3J18QM4Q3',
    xcloudTitleId: '9PM3J18QM4Q3',
    title: 'Minecraft Dungeons II',
    publisher: 'Xbox Game Studios',
    description:
      'Brave the unknown in a brand-new action-adventure dungeon crawler set across the Overworld with co-op loot, bosses, and enchantments.',
    tileAppId: 'apps.54353.14609679373210979.beb28026-7f6b-4b1f-b526-43d0d04b269b.6dcfd9cd-f291-4121-b9d8-a09dd620a5c3',
    heroUrl: editorial('589a627a-b56d-49fe-c030-e0c093a71789_4383832130455494943_128000000006394629_assets__featuredheroimageuri_1790236622680.jpg'),
    categories: ['Action & adventure', 'Family friendly'],
    plan: 3,
    ratingAge: 'E10+',
    platform: 'XSX',
    mouseKeyboard: false,
    touch: true,
  },
  {
    productId: 'C3KLDKZBHNCZ',
    xcloudTitleId: 'C3KLDKZBHNCZ',
    title: 'Fallout 4',
    publisher: 'Bethesda Softworks',
    description:
      'As the sole survivor of Vault 111, enter a world destroyed by nuclear war. Every second is a fight for survival, and every choice is yours.',
    tileAppId: 'apps.31046.66091604408099736.4cc75ea1-c6a0-40ec-b7f9-7fdb8da581b2.a57d4b8c-5413-4da4-ac55-d22e67c07969',
    heroUrl: editorial('02258dcb-9535-8543-dd23-1070e118aecf_4383832130455494943_128000000005948369_assets__featuredheroimageuri_1772569793083.jpg'),
    categories: ['RPG'],
    plan: 1,
    ratingAge: 'M',
    platform: 'XSX',
    mouseKeyboard: false,
    touch: false,
  },
  {
    productId: '9N7271QN4SGB',
    xcloudTitleId: '9N7271QN4SGB',
    title: 'Mortal Kombat 1',
    publisher: 'Warner Bros. Games',
    description:
      'Discover a reborn Mortal Kombat Universe created by the Fire God Liu Kang with a new fighting system, game modes, and fatalities.',
    tileAppId: 'apps.23420.14007497573636681.4ee0da90-8866-4e78-bc18-31395aa61837.003a1b9a-1323-473f-959e-910d6fb66ecd',
    heroUrl: editorial('5d4df1c6-df81-c792-4e03-052872847ef4_4383832130455494943_128000000005943749_assets__featuredheroimageuri_1772226028817.jpg'),
    categories: ['Fighters & brawlers'],
    plan: 2,
    ratingAge: 'M',
    platform: 'XSX',
    mouseKeyboard: true,
    touch: false,
  },
  {
    productId: '9NTB0ZG811GR',
    xcloudTitleId: '9NTB0ZG811GR',
    title: 'The Crew Motorfest',
    publisher: 'UBISOFT',
    description:
      'Welcome to Motorfest in Hawaii! Enjoy over 20 themed car culture playlists and collect more than 700 vehicles across land, sea, and sky.',
    tileAppId: 'apps.55034.14417469726522832.9e08deb3-3374-441f-823d-984b36f6485c.9c631fd6-8e54-4410-9560-ef35f93d25b2',
    heroUrl: editorial('6508576a-63e2-4fd9-ea8e-3801ff6290f5_4383832130455494943_128000000005945789_assets__featuredheroimageuri_1772487733177.jpg'),
    categories: ['Racing & flying'],
    plan: 2,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: false,
    touch: false,
  },
  {
    productId: '9N3D82TFF6C4',
    xcloudTitleId: '9N3D82TFF6C4',
    title: 'NBA 2K27',
    publisher: '2K',
    description:
      'Step onto the hardwood in NBA 2K27 with next-gen ProPLAY realism, MyCAREER, MyTEAM, and online cross-play.',
    tileAppId: 'apps.31609.13934234425416393.c16fba18-9d46-4e2f-9891-5efae739df3f.356d4164-080b-449e-ae1e-3c7b8c5e8277',
    categories: ['Sports'],
    plan: 0,
    ratingAge: 'E',
    platform: 'XSX',
    isFreeToPlay: true,
  },
  {
    productId: 'C0N22P73QZ60',
    xcloudTitleId: 'C0N22P73QZ60',
    title: 'Tom Clancy’s Rainbow Six Siege',
    publisher: 'Ubisoft',
    description:
      'Master the art of destruction and gadgetry in intense 5v5 tactical close-quarters combat with destructible environments.',
    tileAppId: 'apps.37468.14593360489322669.3f8fc95e-5cef-4f57-a490-46a34c350153.f31473ed-f775-43f8-b1d6-d31dc5cb4033',
    categories: ['Shooter'],
    plan: 0,
    ratingAge: 'M',
    platform: 'XSX',
    isFreeToPlay: true,
  },
  {
    productId: '9NDF1F263RZ4',
    xcloudTitleId: '9NDF1F263RZ4',
    title: 'EA SPORTS Madden NFL 26',
    publisher: 'Electronic Arts',
    description:
      'Take your team to the Super Bowl with explosive FieldSENSE physics, Franchise updates, and Ultimate Team.',
    tileAppId: 'apps.17041.14396710821719966.730a4ed9-c54b-46d0-88ec-a2e00b01241b.b12dfe18-a64b-4faf-a7fe-0c50c900664f',
    categories: ['Sports'],
    plan: 2,
    ratingAge: 'E',
    platform: 'XSX',
  },
  {
    productId: '9P3PT7PQJD0M',
    xcloudTitleId: '9P3PT7PQJD0M',
    title: 'Call of Duty: Modern Warfare III',
    publisher: 'Activision Publishing Inc.',
    description:
      'Adapt or die in a fight against the ultimate threat with iconic Multiplayer maps and open-world Zombies.',
    tileAppId: 'apps.52449.14294905624066082.fe6438c3-35eb-479e-9a62-93f8c5cb99f9.5ce8f3d5-5a47-40fb-8639-39eaf21c678e',
    categories: ['Shooter'],
    plan: 3,
    ratingAge: 'M',
    platform: 'XSX',
  },
  {
    productId: '9P22THR57FV7',
    xcloudTitleId: '9P22THR57FV7',
    title: 'Call of Duty: Modern Warfare II',
    publisher: 'Activision Publishing Inc.',
    description:
      'Drops players into an unprecedented global conflict featuring the return of Task Force 141.',
    tileAppId: 'apps.24257.14054963169233798.dfad4b83-a18a-4b0a-a364-afa74b0ab375.4cf72f41-4ee7-4565-8df5-aee0568809f7',
    categories: ['Shooter'],
    plan: 3,
    ratingAge: 'M',
    platform: 'XSX',
  },
  {
    productId: '9PMFDKG5F9R7',
    xcloudTitleId: '9PMFDKG5F9R7',
    title: 'HELLDIVERS 2',
    publisher: 'PlayStation Publishing LLC',
    description:
      'Join the Helldivers and fight for freedom across a hostile galaxy in fast, frantic third-person squad combat.',
    tileAppId: 'apps.32079.14538027815579556.f358fa02-3caa-4f29-8eca-2536de6dba94.46ab4493-6956-4471-95a8-16f0fe2bc320',
    categories: ['Shooter', 'Action & adventure'],
    plan: 0,
    ratingAge: 'M',
    platform: 'XSX',
    purchasable: true,
    price: { list: 39.99, msrp: 39.99, currency: 'USD', formatted: '$39.99' },
  },
  {
    productId: 'BSR9NLHVF1KL',
    xcloudTitleId: 'BSR9NLHVF1KL',
    title: 'The Elder Scrolls V: Skyrim Special Edition',
    publisher: 'Bethesda Softworks',
    description:
      'Winner of more than 200 Game of the Year Awards, experience the epic fantasy open world in stunning detail.',
    tileAppId: 'apps.64810.68326442227858632.03782b23-7f26-4a8e-ba87-177bdf2c3c90.fdefe49f-270c-44e5-b660-6d7764b37f0f',
    categories: ['RPG'],
    plan: 1,
    ratingAge: 'M',
    platform: 'XSX',
  },
  {
    productId: '9NMCDQ6RCJKH',
    xcloudTitleId: '9NMCDQ6RCJKH',
    title: 'Dead by Daylight',
    publisher: 'Behaviour Interactive Inc.',
    description:
      'A multiplayer 4vs1 horror game where one player takes on the role of the savage Killer and four others play as Survivors.',
    tileAppId: 'apps.16719.64366672042187759.733004ed-c696-44cf-98cc-30eddf2375a8.3dd6c96e-e0c3-4a0b-aeb0-810f815a6d37',
    categories: ['Action & adventure'],
    plan: 2,
    ratingAge: 'M',
    platform: 'XSX',
  },
  {
    productId: 'BX1DTCBD1HXJ',
    xcloudTitleId: 'BX1DTCBD1HXJ',
    title: 'ARC Raiders',
    publisher: 'Embark Studios',
    description:
      'A multiplayer extraction adventure set on a lethal future Earth ravaged by a mechanized threat known as ARC.',
    tileAppId: 'apps.24249.13550041517005289.94982f01-a340-49e3-9d4f-37cb23ee22c9.22ffebb1-9164-4b10-9d7d-9d5caa1091a3',
    categories: ['Shooter'],
    plan: 0,
    ratingAge: 'T',
    platform: 'XSX',
    purchasable: true,
    price: { list: 39.99, msrp: 39.99, currency: 'USD', formatted: '$39.99' },
  },
  {
    productId: 'C37XBX7DCBZ0',
    xcloudTitleId: 'C37XBX7DCBZ0',
    title: 'Descenders',
    publisher: 'No More Robots',
    description:
      'Extreme downhill freeriding for the modern era, with procedurally generated worlds where mistakes have real consequences.',
    tileAppId: 'apps.62864.69762792333465121.4086c71f-fab9-4c14-b959-3e77164a74cf.20973bfd-77f7-41d0-8e0a-7cb51d9f8add',
    heroUrl: editorial('862674b5-f1ca-710f-acb4-9c66d0f3db32_4383832130455494943_128000000005948349_assets__featuredheroimageuri_1772569439806.jpg'),
    categories: ['Racing & flying', 'Sports'],
    plan: 1,
    ratingAge: 'E',
    platform: 'XB1',
    touch: true,
  },
  {
    productId: '9N872NBW5XG5',
    xcloudTitleId: '9N872NBW5XG5',
    title: 'Once Human',
    publisher: 'NETEASE INTERACTIVE',
    description:
      'A multiplayer open-world survival game set in a strange, post-apocalyptic future overrun by Stardust.',
    tileAppId: 'apps.21123.13916126641198036.7e5a4785-388f-47fb-b99e-33d1a78b811a.6738bcf8-973a-47c1-bb1e-040bd55123a1',
    categories: ['Action & adventure', 'RPG'],
    plan: 0,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: true,
    isFreeToPlay: true,
  },
  {
    productId: '9NS86BQ33SPX',
    xcloudTitleId: '9NS86BQ33SPX',
    title: 'Where Winds Meet',
    publisher: 'NetEase Games',
    description:
      'An epic open-world action-adventure RPG rooted in Wuxia martial arts during China’s turbulent Ten Kingdoms era.',
    tileAppId: 'apps.35203.14070230506579552.3207f9f3-4cdf-4456-8efc-ead3b8d00b6f.ab850b97-5b91-49e1-9f69-4b090882959a',
    categories: ['RPG', 'Action & adventure'],
    plan: 0,
    ratingAge: 'T',
    platform: 'XSX',
    isFreeToPlay: true,
  },
  {
    productId: 'BPS3XF74B9V1',
    xcloudTitleId: 'BPS3XF74B9V1',
    title: 'War Thunder',
    publisher: 'Gaijin Distribution Kft',
    description:
      'Cross-platform MMO military game dedicated to aviation, armored vehicles, and naval craft.',
    tileAppId: 'apps.55452.63381296256995371.63fd92c7-ca2f-4730-a89d-ce2b9c6e5a2b.a5c666f2-b9bc-4ddc-bef2-cb3590d77419',
    categories: ['Simulation', 'Shooter'],
    plan: 0,
    ratingAge: 'T',
    platform: 'XSX',
    isFreeToPlay: true,
  },
  {
    productId: '9NK4NTBFWW81',
    xcloudTitleId: '9NK4NTBFWW81',
    title: 'Asphalt Legends',
    publisher: 'Gameloft',
    description:
      'Spark your competitive soul with Asphalt Legends Unite and experience heart-pounding arcade racing.',
    tileAppId: 'apps.7993.14471421918435459.0fabc2bd-d512-4bad-a240-2f7f08dedcdb.98e54601-82c5-448c-a8e9-c87c5bbf6ffe',
    categories: ['Racing & flying'],
    plan: 0,
    ratingAge: 'E10+',
    platform: 'XSX',
    touch: true,
    isFreeToPlay: true,
  },
  {
    productId: '9NZQPT0MWTD0',
    xcloudTitleId: '9NZQPT0MWTD0',
    title: 'Age of Empires II: Definitive Edition',
    publisher: 'Xbox Game Studios',
    description:
      'Celebrate one of the most popular strategy games ever with stunning 4K Ultra HD graphics and full controller & MKB support.',
    tileAppId: 'apps.55056.13678235101671609.c350aa6a-23e2-407c-94fd-5050e9bedb6f.f8b5d931-11f6-46e3-859f-54981d5b9d1b',
    categories: ['Strategy'],
    plan: 1,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: true,
  },
  {
    productId: '9P33VJGVPHVP',
    xcloudTitleId: '9P33VJGVPHVP',
    title: 'Age of Mythology: Retold',
    publisher: 'Xbox Game Studios',
    description:
      'Enter an age of gods, monsters, and humans in this modernized real-time strategy classic.',
    tileAppId: 'apps.11603.13792255792507479.e5089564-b472-427d-a39f-9e97ae74bf23.022933e1-6a30-4a52-8c02-0b9400857d8e',
    categories: ['Strategy'],
    plan: 2,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: true,
  },
  {
    productId: '9NG07QJNK38J',
    xcloudTitleId: '9NG07QJNK38J',
    title: 'Among Us',
    publisher: 'Innersloth',
    description:
      'Play with 4-15 players online or via local WiFi as you attempt to prepare your spaceship for departure—watch out for Impostors!',
    tileAppId: 'apps.30063.13589262686196899.16e3418a-cbf2-4748-9724-1c9dc9b7a0b9.672da915-9117-4230-960d-4f59f3d7beb5',
    categories: ['Family friendly', 'Strategy'],
    plan: 1,
    ratingAge: 'E10+',
    platform: 'XB1',
    touch: true,
  },
  {
    productId: '9MZZWGTF7V65',
    xcloudTitleId: '9MZZWGTF7V65',
    title: 'John Carpenter’s Toxic Commando',
    publisher: 'Focus Entertainment',
    description:
      'Take on hordes of terrifying monsters in an 80s-inspired co-op FPS powered by Swarm Engine.',
    tileAppId: 'apps.29766.13813225504277272.60187aa7-cee5-4670-9406-da8555a77e6d.c837b95c-ea53-45ca-8a1d-e10bea8f2ff1',
    categories: ['Shooter'],
    plan: 3,
    ratingAge: 'M',
    platform: 'XSX',
  },
  {
    productId: '9NRBW3FJSJWT',
    xcloudTitleId: '9NRBW3FJSJWT',
    title: 'Football Manager 27 Console',
    publisher: 'SEGA',
    description:
      'Make the big decisions at the world’s top football clubs and lead your squad to glory.',
    tileAppId: 'apps.33382.14035709193149319.c0b48782-5397-43ae-95b7-be2ecd468b49.f531ab0a-2ff2-42b3-9b12-e108b709763d',
    categories: ['Simulation', 'Sports'],
    plan: 3,
    ratingAge: 'E',
    platform: 'XSX',
  },
  {
    productId: '9P743P6195Q5',
    xcloudTitleId: '9P743P6195Q5',
    title: 'Grounded 2 (Game Preview)',
    publisher: 'Xbox Game Studios',
    description:
      'Shrunk down again in an expansive new backyard world—craft, build bases, and survive with friends.',
    tileAppId: 'apps.54353.14609679373210979.beb28026-7f6b-4b1f-b526-43d0d04b269b.6dcfd9cd-f291-4121-b9d8-a09dd620a5c3',
    categories: ['Action & adventure'],
    plan: 3,
    ratingAge: 'T',
    platform: 'XSX',
    mouseKeyboard: true,
  },
  {
    productId: '9PBG4MTM3JJC',
    xcloudTitleId: '9PBG4MTM3JJC',
    title: 'Battlefield 6',
    publisher: 'Electronic Arts',
    description:
      'All-out modern warfare with massive destructible maps, 64-player Conquest, and vehicle combat.',
    tileAppId: 'apps.65490.14559138935406168.e7f01a08-ebf9-41d8-88ba-39fb1a148711.c65ba007-7378-497e-b934-101230f24e82',
    categories: ['Shooter'],
    plan: 3,
    ratingAge: 'M',
    platform: 'XSX',
    mouseKeyboard: true,
  },
  {
    productId: '9P686C1GJ91L',
    xcloudTitleId: '9P686C1GJ91L',
    title: 'theHunter: Call of the Wild',
    publisher: 'Avalanche Studios',
    description:
      'Experience an atmospheric hunting game like no other in a realistic, breathtaking open world.',
    tileAppId: 'apps.31673.63553167684393025.1b31f51e-c4c6-49b1-bf61-a2e65ea14c73.150d2a5d-49a6-4724-8e53-cb908f866746',
    categories: ['Simulation'],
    plan: 1,
    ratingAge: 'T',
    platform: 'XB1',
  },
  {
    productId: 'C1ZT6N30L1WH',
    xcloudTitleId: 'C1ZT6N30L1WH',
    title: 'Gang Beasts',
    publisher: 'Boneloaf',
    description:
      'A silly multiplayer party game with surly gelatinous characters, brutal slapstick fight sequences, and absurdly hazardous environments.',
    tileAppId: 'apps.35593.68150164172276526.ddc374d7-ef5e-43b9-940a-bbc04440bb33.e0c05607-881c-449f-826b-fec43403598c',
    categories: ['Fighters & brawlers', 'Family friendly'],
    plan: 1,
    ratingAge: 'E10+',
    platform: 'XB1',
  },
  {
    productId: '9N5DDTDLTWCL',
    xcloudTitleId: '9N5DDTDLTWCL',
    title: 'DRAGON BALL XENOVERSE 2',
    publisher: 'BANDAI NAMCO Entertainment',
    description:
      'Defend Dragon Ball history as a Time Patroller with custom Saiyan, Namekian, Majin, or Earthling fighters.',
    tileAppId: 'apps.32513.63336639312113079.ceb7d6d9-5c03-4721-ab3f-09019902f961.e4eb532e-0d8b-41c0-ac6a-dbeb6ff4e9dd',
    categories: ['Fighters & brawlers', 'RPG'],
    plan: 2,
    ratingAge: 'T',
    platform: 'XSX',
  },
];

export function getDemoLibrary(): LibraryData {
  const products: CatalogProduct[] = REAL_CLOUD_GAMES.map((g) => ({
    productId: g.productId,
    xcloudTitleId: g.xcloudTitleId,
    xboxTitleId: g.xboxTitleId ?? '',
    title: g.title,
    publisher: g.publisher,
    description: g.description,
    tileUrl: img(g.tileAppId, 520),
    posterUrl: img(g.tileAppId, 600),
    heroUrl: g.heroUrl || img(g.tileAppId, 1280),
    categories: g.categories,
    plan: g.plan,
    ratingAge: g.ratingAge,
    ratingSystem: g.ratingSystem || 'ESRB',
    isFreeToPlay: g.isFreeToPlay,
    platform: g.platform || 'XSX',
    mouseKeyboard: g.mouseKeyboard,
    touch: g.touch,
    playable: true,
    purchasable: g.purchasable,
    price: g.price,
    friends: g.friends ?? [],
  }));

  return {
    demoMode: true,
    recentIds: ['BT5P2X999VH2', '9N431PX143P8', '9PP5G1F0C2B6', '9N4PT8HGCDHQ', 'BX3M8L83BBRW'],
    popularIds: [
      'BT5P2X999VH2',
      '9N3D82TFF6C4',
      '9NVD16NP4J8T',
      '9N8PMW7QMD3D',
      '9N4PT8HGCDHQ',
      'BX3M8L83BBRW',
      '9NLKS78C4F3Z',
      'C0N22P73QZ60',
      '9NDF1F263RZ4',
      '9PMFDKG5F9R7',
      'C3KLDKZBHNCZ',
      'BSR9NLHVF1KL',
      '9NMCDQ6RCJKH',
      'BX1DTCBD1HXJ',
      '9PP5G1F0C2B6',
    ],
    recentlyAddedIds: [
      '9N431PX143P8',
      '9PM3J18QM4Q3',
      '9MZZWGTF7V65',
      '9NRBW3FJSJWT',
      '9P743P6195Q5',
      '9PBG4MTM3JJC',
      '9NVD16NP4J8T',
    ],
    freeToPlayIds: [
      'BT5P2X999VH2',
      '9N8PMW7QMD3D',
      '9NLKS78C4F3Z',
      'C0N22P73QZ60',
      '9PP5G1F0C2B6',
      '9N3D82TFF6C4',
      '9N872NBW5XG5',
      '9NS86BQ33SPX',
      'BPS3XF74B9V1',
      '9NK4NTBFWW81',
    ],
    ownedIds: ['BX3M8L83BBRW', '9PMFDKG5F9R7', 'BX1DTCBD1HXJ', 'BT5P2X999VH2'],
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
