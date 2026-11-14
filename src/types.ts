import type { LangCode } from './i18n/translations';

export type ResolutionMode = '720p' | '1080p' | '1080pHQ' | '1440p';
export type SharpnessLevel = 'off' | 'low' | 'medium' | 'high';
export type UpscalerMode = 'fsr' | 'fsr_clean' | 'ai' | 'ai_clean';
export type DebandLevel = 'off' | 'low' | 'high' | 'auto';
export type GlyphStyle = 'playstation' | 'xbox' | 'keyboard';
export type TriggerProfile = 'standard' | 'shooter' | 'racing';
export type GyroMode = 'off' | 'always' | 'aiming' | 'steering' | 'steering_drive';
export type TouchpadAction =
  | 'none'
  | 'game_menu'
  | 'xbox_button'
  | 'toggle_stats'
  | 'toggle_mic'
  | 'cycle_gyro'
  | 'cycle_trigger';

export interface TouchpadShortcuts {
  swipeUp: TouchpadAction;
  swipeDown: TouchpadAction;
  swipeLeft: TouchpadAction;
  swipeRight: TouchpadAction;
  clickLeft: TouchpadAction;
  clickRight: TouchpadAction;
}

export interface PerGameProfile {
  upscaler: UpscalerMode;
  sharpness: SharpnessLevel;
  deband: DebandLevel;
  resolution: ResolutionMode;
  deadzone: number;
  triggerStrength: number; // 0..4
  triggerProfile: TriggerProfile;
  gyroMode: GyroMode;
  circleConfirms: boolean;
}

export interface TelemetryMask {
  fps: boolean;
  bitrate: boolean;
  latency: boolean;
  loss: boolean;
  graph: boolean;
  delay: boolean;
  qp: boolean;
  mic: boolean;
}

export interface UserProfile {
  gamertag: string;
  xuid: string;
  gamerpicUrl: string;
  gamerscore: string;
  subscription: string;
  playtimeRemainingSec: number;
  playtimeMaxSec: number;
  playtimeUnlimited: boolean;
}

export interface RegionInfo {
  name: string;
  baseUri: string;
  isDefault: boolean;
}

export interface FriendPresence {
  xuid: string;
  gamertag: string;
  gamerpicUrl: string;
  presenceState: string;
  presenceText: string;
  titleId: string;
  device: string;
  isGame: boolean;
}

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  lockedDescription?: string;
  gamerscore: number;
  unlocked: boolean;
  isSecret?: boolean;
  unlockedAt?: string;
}

export interface CatalogProduct {
  productId: string;
  xcloudTitleId: string;
  xboxTitleId: string;
  title: string;
  publisher: string;
  description: string;
  tileUrl: string;
  posterUrl: string;
  heroUrl: string;
  categories: string[];
  plan: 0 | 1 | 2 | 3;
  ratingAge: string;
  ratingSystem: string;
  isFreeToPlay?: boolean;
  platform?: string;
  mouseKeyboard?: boolean;
  touch?: boolean;
  playable?: boolean;
  purchasable?: boolean;
  modes?: string[];
  price?: { list: number; msrp: number; currency: string; formatted: string };
  friends?: FriendPresence[];
}

export interface HomeConsole {
  serverId: string;
  deviceName: string;
  consoleType: string;
  powerState: string;
  playPath: string;
  outOfHomeWarning: boolean;
  wirelessWarning: boolean;
}

export interface LibraryData {
  recentIds: string[];
  popularIds: string[];
  recentlyAddedIds: string[];
  freeToPlayIds: string[];
  ownedIds: string[];
  products: CatalogProduct[];
  regions: RegionInfo[];
}

export interface AppSettings {
  language: LangCode;
  resolution: ResolutionMode;
  regionName: string;
  loginCountry: string;
  storeCountry: string;
  upscaler: UpscalerMode;
  sharpness: SharpnessLevel;
  deband: DebandLevel;
  fpsLimit: 0 | 30 | 60 | 120;
  maxBitrateMbps: number; // 0 = Auto, -1 = Unlimited, 15..50
  highRefresh: boolean;
  videoDecoder: 'hw' | 'sw';
  gameVolume: number; // 0..100
  padSpeakerVolume: number; // 0..100
  audioHaptics: 0 | 1 | 2 | 3; // Off, Low, Medium, High
  deadzone: number; // 0..0.35
  deadzoneRight: number; // 0..0.35
  triggerRumble: boolean;
  triggerStrength: number; // 0..4
  triggerHz: number; // 0..2
  triggerResistance: number; // 0..3
  triggerPulses: boolean;
  triggerProfile: TriggerProfile;
  lightBarMode: 'game' | 'custom';
  lightBarColour: string;
  circleConfirms: boolean;
  gyroMode: GyroMode;
  gyroYawScale: number;
  gyroPitchScale: number;
  gyroInvertX: boolean;
  gyroInvertY: boolean;
  queueReadyAlert: boolean;
  previewFeatures: boolean;
  syncTrophies: boolean;
  glyphStyle: GlyphStyle;
  touchpadShortcuts: TouchpadShortcuts;
  padMap: Record<string, string>;
  keyMap: Record<string, string>;
  statsEnabled: boolean;
  telemetryMask: TelemetryMask;
  perGameSettings: Record<string, PerGameProfile>;
  wishlist: string[];
  favorites: string[];
  hidden: string[];
  playtimeSecByProduct: Record<string, number>;
}
