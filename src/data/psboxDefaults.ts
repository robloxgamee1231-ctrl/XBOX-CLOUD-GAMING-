import type { AchievementItem, AppSettings, CatalogProduct } from '../types';

export const DEFAULT_PAD_MAP: Record<string, string> = {
  A: 'Cross (✕)',
  B: 'Circle (○)',
  X: 'Square (□)',
  Y: 'Triangle (△)',
  LB: 'L1',
  RB: 'R1',
  LT: 'L2',
  RT: 'R2',
  View: 'Touchpad Left / Select',
  Menu: 'Options / Start',
  LS: 'L3',
  RS: 'R3',
};

export const DEFAULT_KEY_MAP: Record<string, string> = {
  A: 'Space',
  B: 'Escape / C',
  X: 'R / X',
  Y: 'E / F',
  LB: 'Q',
  RB: 'E / Tab',
  LT: 'Right Click',
  RT: 'Left Click',
  View: 'M / Backspace',
  Menu: 'Enter',
  DPadUp: 'ArrowUp',
  DPadDown: 'ArrowDown',
  DPadLeft: 'ArrowLeft',
  DPadRight: 'ArrowRight',
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: 'en',
  resolution: '1080p',
  regionName: '',
  loginCountry: '',
  storeCountry: '',
  upscaler: 'fsr',
  sharpness: 'medium',
  deband: 'auto',
  fpsLimit: 0,
  maxBitrateMbps: 0,
  highRefresh: true,
  videoDecoder: 'hw',
  gameVolume: 100,
  padSpeakerVolume: 70,
  audioHaptics: 1,
  deadzone: 0.08,
  deadzoneRight: 0.08,
  triggerRumble: true,
  triggerStrength: 2,
  triggerHz: 1,
  triggerResistance: 1,
  triggerPulses: false,
  triggerProfile: 'standard',
  lightBarMode: 'game',
  lightBarColour: '#107c10',
  circleConfirms: false,
  gyroMode: 'off',
  gyroYawScale: 100,
  gyroPitchScale: 80,
  gyroInvertX: false,
  gyroInvertY: false,
  queueReadyAlert: true,
  previewFeatures: true,
  syncTrophies: false,
  glyphStyle: 'playstation',
  touchpadShortcuts: {
    swipeUp: 'xbox_button',
    swipeDown: 'game_menu',
    swipeLeft: 'toggle_stats',
    swipeRight: 'toggle_mic',
    clickLeft: 'none',
    clickRight: 'none',
  },
  padMap: { ...DEFAULT_PAD_MAP },
  keyMap: { ...DEFAULT_KEY_MAP },
  statsEnabled: true,
  telemetryMask: {
    fps: true,
    bitrate: true,
    latency: true,
    loss: true,
    graph: true,
    delay: false,
    qp: false,
    mic: false,
  },
  perGameSettings: {},
  wishlist: ['9N431PX143P8', 'BX3M8L83BBRW'],
  favorites: ['BT5P2X999VH2', '9PP5G1F0C2B6'],
  hidden: [],
  playtimeSecByProduct: {
    BT5P2X999VH2: 6420,
    '9PP5G1F0C2B6': 3900,
  },
};

export function loadStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('psbox_settings_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
        touchpadShortcuts: {
          ...DEFAULT_APP_SETTINGS.touchpadShortcuts,
          ...(parsed.touchpadShortcuts ?? {}),
        },
        padMap: {
          ...DEFAULT_APP_SETTINGS.padMap,
          ...(parsed.padMap ?? {}),
        },
        keyMap: {
          ...DEFAULT_APP_SETTINGS.keyMap,
          ...(parsed.keyMap ?? {}),
        },
        telemetryMask: {
          ...DEFAULT_APP_SETTINGS.telemetryMask,
          ...(parsed.telemetryMask ?? {}),
        },
        perGameSettings: parsed.perGameSettings ?? {},
      };
    }
  } catch {
    // ignore corrupted storage
  }
  return { ...DEFAULT_APP_SETTINGS };
}

// Rotating helpful loading tips matching PSBox drawLaunching()
export const PSBOX_LAUNCH_TIPS: string[] = [
  'Touchpad: swipe ↓ (or Touchpad + Options / F12) for the menu, ↑ for the Xbox button',
  'Keyboard and mouse are supported in enabled cloud games',
  'Claim free games, trials, and discover store promotions directly from the app library',
  'Encountered an issue? Open Bug Report in Settings to scan a QR code with attached logs',
  'Enable 120 Hz display output (VRR) in Settings for reduced frame latency and smoother response',
  'Calibrate DualSense stick dead zones in Settings to eliminate drift and improve precision',
  'Use the DualSense built-in microphone for party and multiplayer game voice chat',
  'In keyboard and mouse supported games, use the touchpad surface as a mouse pointer',
  'Enable gyro aiming in Settings to fine-tune your weapon aim with motion sensors',
  'AMD FSR & Anime4K upscaling and sharpness filters enhance visual clarity during streaming',
  'Adjust the streaming bitrate cap in Settings up to 50 Mbps or Unlimited for pristine visual quality',
  'Toggle per-game settings from the Game Details screen (Options / Game Settings)',
  'Press F12 or START + BACK during gameplay to adjust volume, bitrate, and stream settings',
  'Queue Ready Chime plays an audio alert the moment your cloud slot opens',
];

export function getProductAchievements(product: CatalogProduct): AchievementItem[] {
  const hash = product.productId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const title = product.title;
  return [
    {
      id: `${product.productId}-1`,
      name: `First Steps in ${title}`,
      description: 'Launch and complete the opening mission or first match.',
      gamerscore: 15,
      unlocked: hash % 3 !== 0,
      unlockedAt: 'Unlocked 2 days ago',
    },
    {
      id: `${product.productId}-2`,
      name: 'Cloud Explorer',
      description: 'Reach your first milestone or unlock a major progression tier.',
      gamerscore: 30,
      unlocked: hash % 2 === 0,
      unlockedAt: 'Unlocked yesterday',
    },
    {
      id: `${product.productId}-3`,
      name: 'Seasoned Veteran',
      description: 'Win 10 challenges or defeat a chapter boss on Normal or higher.',
      gamerscore: 50,
      unlocked: hash % 5 === 0,
    },
    {
      id: `${product.productId}-4`,
      name: 'Squad Goals',
      description: 'Complete an objective with friends or online co-op.',
      gamerscore: 25,
      unlocked: false,
      lockedDescription: 'Join a multiplayer or co-op session to earn this.',
    },
    {
      id: `${product.productId}-5`,
      name: 'Hidden Legend',
      description: 'Discover the secret encounter hidden off the main path.',
      gamerscore: 100,
      unlocked: false,
      isSecret: true,
    },
  ];
}
