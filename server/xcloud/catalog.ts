// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted from PSBox Cloud Gaming (src/xcloud/catalog.cpp, social.cpp, titlehub.cpp, prices.cpp)

export const SIGL_IDS = {
  RECENTLY_ADDED: '06323672-b8c8-43cc-b0de-32d5a9834749',
  MOST_POPULAR: '6a589fa0-d493-472b-8e20-3813699d7056',
  LEAVING_SOON: '31ff2361-2772-4622-849b-f4f1abb4ad1b',
  ALL_GAMES: 'af206485-e87d-4624-9007-cb7f6d0cc42e',
  FREE_TO_PLAY: 'd8f4afcd-882a-49e3-86b3-f61fa0172b75',
} as const;

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
  plan: 0 | 1 | 2 | 3; // 0=none/free, 1=Essential, 2=Premium, 3=Ultimate
  ratingAge: string;
  ratingSystem: string;
  isFreeToPlay?: boolean;
  platform?: string; // XSX, XB1, 360
  mouseKeyboard?: boolean;
  touch?: boolean;
  playable?: boolean;
  purchasable?: boolean;
  price?: { list: number; msrp: number; currency: string; formatted: string };
  friends?: FriendPresence[];
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

const CATALOG_HEADERS = {
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'ms-cv': '0.0',
  'calling-app-name': 'psbox-browser',
  'calling-app-version': '1.0',
};

export async function fetchSiglList(
  siglId: string,
  market = 'US',
  language = 'en-US',
): Promise<{ title: string; productIds: string[] }> {
  const url = `https://catalog.gamepass.com/sigls/v2?id=${encodeURIComponent(siglId)}&market=${encodeURIComponent(market)}&language=${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: CATALOG_HEADERS, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Catalog list ${siglId}: HTTP ${res.status}`);
  const j = (await res.json()) as unknown;
  const productIds: string[] = [];
  let title = '';
  if (Array.isArray(j)) {
    for (const item of j as Array<Record<string, unknown>>) {
      if (item.siglId) title = String(item.title ?? '');
      else if (typeof item.id === 'string' && item.id) productIds.push(item.id);
    }
  } else if (j && typeof j === 'object') {
    const obj = j as { title?: string; productIds?: Array<string | { id?: string }> };
    title = String(obj.title ?? '');
    for (const item of obj.productIds ?? []) {
      const id = typeof item === 'string' ? item : String(item.id ?? '');
      if (id) productIds.push(id);
    }
  }
  return { title, productIds };
}

function fixImg(url: unknown): string {
  const s = typeof url === 'string' ? url : '';
  return s.startsWith('//') ? `https:${s}` : s;
}

function parsePlan(passMeta: Record<string, unknown> | undefined): 0 | 1 | 2 | 3 {
  if (!passMeta) return 0;
  if ('CFQ7TTC0K5DJ' in passMeta) return 1; // Essential
  if ('CFQ7TTC0P85B' in passMeta) return 2; // Premium
  return 3; // Ultimate
}

export async function fetchCatalogProducts(
  ids: string[],
  market = 'US',
  language = 'en-US',
  full = true,
): Promise<Record<string, CatalogProduct>> {
  const out: Record<string, CatalogProduct> = {};
  const batchSize = full ? 20 : 60;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const url = `https://catalog.gamepass.com/v3/products?market=${encodeURIComponent(market)}&language=${encodeURIComponent(language)}&hydration=${full ? 'RemoteHighSapphire0' : 'RemoteLowJade0'}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...CATALOG_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Products: batch }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) continue;
    const j = (await res.json()) as { Products?: Record<string, Record<string, unknown>> };
    for (const [id, p] of Object.entries(j.Products ?? {})) {
      const imgs = (p.ImageTile || p.Images || {}) as Record<string, Record<string, unknown>>;
      const hero = fixImg(
        (p.ImageHero as { URL?: string } | undefined)?.URL ?? imgs.TitledHeroArt?.URL ?? imgs.SuperHeroArt?.URL,
      );
      const tile = fixImg(
        (p.ImageTile as { URL?: string } | undefined)?.URL ?? imgs.BoxArt?.URL ?? imgs.Logo?.URL,
      );
      const poster = fixImg(
        (p.ImagePoster as { URL?: string } | undefined)?.URL ?? imgs.Poster?.URL ?? tile,
      );
      const rating = (p.ContentRating as Record<string, unknown> | undefined) ?? {};
      const childIds = Array.isArray(p.ChildXboxTitleIds) ? (p.ChildXboxTitleIds as string[]) : [];
      out[id] = {
        productId: id,
        xcloudTitleId: String(p.XCloudTitleId ?? ''),
        xboxTitleId: String(p.XboxTitleId ?? childIds[0] ?? ''),
        title: String(p.ProductTitle ?? ''),
        publisher: String(p.PublisherName ?? ''),
        description: String(p.ProductDescription ?? ''),
        tileUrl: tile || poster || hero,
        posterUrl: poster || tile,
        heroUrl: hero || poster || tile,
        categories: Array.isArray(p.Categories) ? (p.Categories as string[]) : [],
        plan: parsePlan(p.PassMetadataByPassProductId as Record<string, unknown> | undefined),
        ratingAge: String(rating.LongName ?? rating.RatingId ?? rating.Age ?? ''),
        ratingSystem: String(rating.RatingSystem ?? ''),
      };
    }
  }
  return out;
}

export async function fetchFriendsPresence(
  xblAuth: string,
  language = 'en-US',
): Promise<FriendPresence[]> {
  if (!xblAuth) return [];
  try {
    const res = await fetch(
      'https://peoplehub.xboxlive.com/users/me/people/social/decoration/detail,presencedetail,preferredcolor',
      {
        headers: {
          Authorization: xblAuth,
          'x-xbl-contract-version': '2',
          'Accept-Language': language,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as { people?: Array<Record<string, unknown>> };
    const out: FriendPresence[] = [];
    for (const p of j.people ?? []) {
      const details = Array.isArray(p.presenceDetails) ? (p.presenceDetails as Array<Record<string, unknown>>) : [];
      let titleId = '';
      let device = '';
      let isGame = false;
      for (const d of details) {
        const tid = d.TitleId !== undefined ? String(d.TitleId) : '';
        if (!tid || tid === '750323071' || tid === '1022622766') continue;
        const g = Boolean(d.IsGame);
        if (g || d.State === 'Active') {
          titleId = tid;
          device = String(d.Device ?? '');
          isGame = g;
          if (g) break;
        }
      }
      out.push({
        xuid: String(p.xuid ?? ''),
        gamertag: String(p.gamertag ?? ''),
        gamerpicUrl: String(p.displayPicRaw ?? ''),
        presenceState: String(p.presenceState ?? ''),
        presenceText: String(p.presenceText ?? ''),
        titleId,
        device,
        isGame,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchTitlePlatforms(
  xblAuth: string,
  titleIds: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!xblAuth || titleIds.length === 0) return out;
  for (let i = 0; i < titleIds.length; i += 100) {
    const batch = titleIds.slice(i, i + 100);
    try {
      const res = await fetch('https://titlehub.xboxlive.com/titles/batch/decoration/detail', {
        method: 'POST',
        headers: {
          Authorization: xblAuth,
          'x-xbl-contract-version': '2',
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US',
        },
        body: JSON.stringify({ pfns: null, titleIds: batch }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as { titles?: Array<Record<string, unknown>> };
      for (const t of j.titles ?? []) {
        const devs = Array.isArray(t.devices) ? (t.devices as string[]) : [];
        const attrs = ((t.detail as { attributes?: Array<{ name?: string }> } | undefined)?.attributes ?? []);
        const has360 = devs.includes('Xbox360');
        const hasOne = devs.includes('XboxOne');
        const hasSeries = devs.includes('XboxSeries');
        const optimized = attrs.some((a) => a.name === 'ConsoleGen9Optimized');
        const code = has360 ? '360' : optimized || (hasSeries && !hasOne) ? 'XSX' : 'XB1';
        out[String(t.titleId ?? '')] = code;
        if (typeof t.modernTitleId === 'string' && t.modernTitleId) out[t.modernTitleId] = code;
      }
    } catch {
      // ignore batch error
    }
  }
  return out;
}
