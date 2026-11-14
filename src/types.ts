import type { LangCode } from './i18n/translations';

export type ResolutionMode = '720p' | '1080p' | '1080pHQ' | '1440p';
export type SharpnessLevel = 'off' | 'low' | 'medium' | 'high';
export type GlyphStyle = 'playstation' | 'xbox' | 'keyboard';

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
  demoMode: boolean;
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
  sharpness: SharpnessLevel;
  deband: boolean;
  deadzone: number; // 0..0.35
  triggerRumble: boolean;
  glyphStyle: GlyphStyle;
  wishlist: string[];
  hidden: string[];
  playtimeSecByProduct: Record<string, number>;
}
