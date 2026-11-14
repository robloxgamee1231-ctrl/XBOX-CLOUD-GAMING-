import QRCode from 'qrcode';
import type {
  AchievementItem,
  CatalogProduct,
  FriendPresence,
  HomeConsole,
  LibraryData,
  RegionInfo,
  ResolutionMode,
  UserProfile,
} from '../types';

const MSA_CLIENT_ID = '000000004c20a908';
const MSA_SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
const MSA_TRANSFER_SCOPE =
  'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN';

const LS_RELAY_URL = 'psbox_relay_url';
const LS_STATIC_SESSION = 'psbox_static_session_v1';

const COUNTRY_IPS: Record<string, string> = {
  br: '169.150.198.66',
  jp: '138.199.21.239',
  kr: '121.125.60.151',
  pl: '45.134.212.66',
  us: '143.244.47.65',
};

interface GssvLoginState {
  gsToken: string;
  market: string;
  regions: RegionInfo[];
  selectedRegion: RegionInfo;
  expiresAt: number;
  offering: 'xgpuweb' | 'xgpuwebf2p' | 'xhome';
}

interface StaticAuthState {
  refreshToken?: string;
  accessToken?: string;
  msaExpiresAt?: number;
  xblUser?: { token: string; userHash: string; gamertag: string; xuid: string };
  xblProfile?: { token: string; userHash: string };
  gssvCloud?: GssvLoginState;
  gssvHome?: GssvLoginState;
  profile?: UserProfile;
  loginCountry: string;
  activeSessionPath?: string;
  activeSessionIsHome?: boolean;
  activeResolution: ResolutionMode;
}

let hasLocalBackend: boolean | null = null;

const ENV_RELAY_URL = (import.meta.env?.VITE_PSBOX_RELAY_URL || '').trim().replace(/\/+$/, '');

export function getRelayUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = (params.get('relay') || '').trim().replace(/\/+$/, '');
    if (qp && /^https?:\/\//i.test(qp)) {
      localStorage.setItem(LS_RELAY_URL, qp);
      return qp;
    }
  } catch {
    // ignore
  }
  return (localStorage.getItem(LS_RELAY_URL) || ENV_RELAY_URL || '').trim().replace(/\/+$/, '');
}

export function setRelayUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) localStorage.setItem(LS_RELAY_URL, clean);
  else localStorage.removeItem(LS_RELAY_URL);
}

function loadStaticState(): StaticAuthState | null {
  try {
    const raw = localStorage.getItem(LS_STATIC_SESSION);
    return raw ? (JSON.parse(raw) as StaticAuthState) : null;
  } catch {
    return null;
  }
}

function saveStaticState(st: StaticAuthState | null) {
  if (!st) localStorage.removeItem(LS_STATIC_SESSION);
  else localStorage.setItem(LS_STATIC_SESSION, JSON.stringify(st));
}

async function detectLocalBackend(): Promise<boolean> {
  if (hasLocalBackend !== null) return hasLocalBackend;
  try {
    const res = await fetch('./api/auth/session', { cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      hasLocalBackend = true;
      return true;
    }
  } catch {
    // ignore
  }
  hasLocalBackend = false;
  return false;
}

export function isStaticHostingMode(): boolean {
  return hasLocalBackend === false;
}

async function relayFetch(targetUrl: string, init: RequestInit = {}, country = ''): Promise<Response> {
  const relay = getRelayUrl();
  if (relay) {
    const headers = new Headers(init.headers);
    if (country && COUNTRY_IPS[country]) {
      headers.set('X-PSBox-Country', COUNTRY_IPS[country]);
    }
    const proxiedUrl = `${relay}/?url=${encodeURIComponent(targetUrl)}`;
    return fetch(proxiedUrl, { ...init, headers });
  }
  try {
    return await fetch(targetUrl, init);
  } catch {
    throw new Error('NO_RELAY');
  }
}

function buildDeviceInfo(resolution: ResolutionMode): string {
  if (resolution === '1440p') {
    return JSON.stringify({
      appInfo: {
        env: {
          clientAppId: 'play.xbox.com',
          clientAppType: 'browser',
          clientAppVersion: '1.0.2610.0201',
          clientSdkVersion: '10.6.65',
          httpEnvironment: 'prod',
          sdkInstallId: crypto.randomUUID(),
        },
      },
      dev: {
        displayInfo: { dimensions: { heightInPixels: 1440, widthInPixels: 2560 }, pixelDensity: { dpiX: 1, dpiY: 1 } },
        browser: { browserName: 'edge', browserVersion: '141.0.0.0' },
        hw: { make: 'Microsoft', model: 'Windows', platformType: 'desktop', sdkType: 'web' },
        os: { name: 'windows', ver: '10.0', platform: 'desktop' },
      },
    });
  }
  if (resolution === '1080pHQ') {
    return JSON.stringify({
      appInfo: {
        env: {
          clientAppId: 'play.xbox.com',
          clientAppType: 'browser',
          clientAppVersion: '26.1.97',
          clientSdkVersion: '10.3.7',
          httpEnvironment: 'prod',
          sdkInstallId: '',
        },
      },
      dev: {
        os: { name: 'tizen', ver: '22631.2715', platform: 'desktop' },
        hw: { make: 'Microsoft', model: 'unknown', sdktype: 'web' },
        browser: { browserName: 'chrome', browserVersion: '140.0.3485.54' },
        displayInfo: { dimensions: { widthInPixels: 4096, heightInPixels: 2160 }, pixelDensity: { dpiX: 1, dpiY: 1 } },
      },
    });
  }
  const hd = resolution !== '720p';
  return JSON.stringify({
    appInfo: {
      env: {
        clientAppId: 'play.xbox.com',
        clientAppType: 'browser',
        clientAppVersion: '26.1.97',
        clientSdkVersion: '10.3.7',
        httpEnvironment: 'prod',
        sdkInstallId: '',
      },
    },
    dev: {
      hw: { make: hd ? 'Microsoft' : 'Google', model: hd ? 'Surface Pro' : 'Pixel', sdktype: 'web' },
      os: { name: hd ? 'Windows 11' : 'Android', ver: hd ? '22631.2715' : '14', platform: hd ? 'desktop' : 'phone' },
      displayInfo: {
        dimensions: { widthInPixels: hd ? 1920 : 1280, heightInPixels: hd ? 1080 : 720 },
        pixelDensity: { dpiX: 1, dpiY: 1 },
      },
    },
  });
}

async function xblAuthFlow(accessToken: string, refreshToken: string, loginCountry: string): Promise<StaticAuthState> {
  const xblRes = await relayFetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-xbl-contract-version': '1' },
    body: JSON.stringify({
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `t=${accessToken}` },
    }),
  });
  if (!xblRes.ok) throw new Error(`Xbox user auth failed (HTTP ${xblRes.status})`);
  const xblJson = (await xblRes.json()) as {
    Token: string;
    DisplayClaims?: { xui?: Array<{ uhs?: string; gtg?: string; xid?: string }> };
  };
  const xui = xblJson.DisplayClaims?.xui?.[0] ?? {};
  const userToken = {
    token: xblJson.Token,
    userHash: xui.uhs || '',
    gamertag: xui.gtg || '',
    xuid: xui.xid || '',
  };

  const getXsts = async (rp: string) => {
    const r = await relayFetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-xbl-contract-version': '1' },
      body: JSON.stringify({
        RelyingParty: rp,
        TokenType: 'JWT',
        Properties: { SandboxId: 'RETAIL', UserTokens: [userToken.token] },
      }),
    });
    const j = (await r.json()) as {
      Token?: string;
      XErr?: number;
      DisplayClaims?: { xui?: Array<{ uhs?: string; gtg?: string; xid?: string }> };
    };
    if (!r.ok || !j.Token) {
      throw new Error(`XSTS ${rp} failed (HTTP ${r.status}${j.XErr ? ` XErr ${j.XErr}` : ''})`);
    }
    return {
      token: j.Token,
      userHash: j.DisplayClaims?.xui?.[0]?.uhs || userToken.userHash,
      gamertag: j.DisplayClaims?.xui?.[0]?.gtg || userToken.gamertag,
      xuid: j.DisplayClaims?.xui?.[0]?.xid || userToken.xuid,
    };
  };

  const profileXsts = await getXsts('http://xboxlive.com').catch(() => userToken);
  const gssvXsts = await getXsts('http://gssv.xboxlive.com/');

  const gssvLoginReq = async (offering: 'xgpuweb' | 'xgpuwebf2p' | 'xhome'): Promise<GssvLoginState> => {
    const r = await relayFetch(
      `https://${offering}.gssv-play-prod.xboxlive.com/v2/login/user`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gssv-client': 'XboxComBrowser' },
        body: JSON.stringify({ token: gssvXsts.token, offeringId: offering }),
      },
      loginCountry,
    );
    if (!r.ok) throw new Error(`xCloud ${offering} login failed (HTTP ${r.status})`);
    const j = (await r.json()) as {
      gsToken: string;
      market?: string;
      durationInSeconds?: number;
      offeringSettings?: { regions?: Array<{ name: string; baseUri: string; isDefault: boolean }> };
    };
    const regions = (j.offeringSettings?.regions ?? []).filter((rg) => rg.baseUri);
    const selectedRegion = regions.find((rg) => rg.isDefault) ?? regions[0];
    return {
      gsToken: j.gsToken,
      market: j.market || 'US',
      regions,
      selectedRegion,
      expiresAt: Math.floor(Date.now() / 1000) + (j.durationInSeconds || 3600),
      offering,
    };
  };

  let gssvCloud = await gssvLoginReq('xgpuweb').catch(() => undefined);
  if (!gssvCloud) {
    gssvCloud = await gssvLoginReq('xgpuwebf2p').catch(() => undefined);
  }
  const gssvHome = await gssvLoginReq('xhome').catch(() => undefined);
  if (!gssvCloud && !gssvHome) {
    throw new Error('Could not log into xCloud or Xbox Remote Play. Check subscription or Country Bypass.');
  }

  let gamertag = profileXsts.gamertag || 'Xbox Player';
  let gamerpicUrl = './assets/icon0.png';
  let gamerscore = '';
  try {
    const profRes = await relayFetch(
      'https://profile.xboxlive.com/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore',
      {
        headers: {
          Authorization: `XBL3.0 x=${profileXsts.userHash};${profileXsts.token}`,
          'x-xbl-contract-version': '3',
        },
      },
    );
    if (profRes.ok) {
      const pj = (await profRes.json()) as {
        profileUsers?: Array<{ settings?: Array<{ id?: string; value?: string }> }>;
      };
      for (const s of pj.profileUsers?.[0]?.settings ?? []) {
        if (s.id === 'GameDisplayName' && s.value) gamertag = s.value;
        if (s.id === 'GameDisplayPicRaw' && s.value) gamerpicUrl = s.value;
        if (s.id === 'Gamerscore' && s.value) gamerscore = s.value;
      }
    }
  } catch {
    // ignore
  }

  return {
    refreshToken,
    accessToken,
    msaExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    xblUser: userToken,
    xblProfile: { token: profileXsts.token, userHash: profileXsts.userHash },
    gssvCloud,
    gssvHome,
    profile: {
      gamertag,
      xuid: profileXsts.xuid,
      gamerpicUrl,
      gamerscore,
      subscription:
        gssvCloud?.offering === 'xgpuwebf2p'
          ? 'Free (Cloud F2P)'
          : gssvCloud
            ? 'Game Pass Ultimate'
            : 'Remote Play',
      playtimeRemainingSec: -1,
      playtimeMaxSec: -1,
      playtimeUnlimited: false,
    },
    loginCountry,
    activeResolution: '1080p',
  };
}

async function ensureStaticSessionFresh(st: StaticAuthState): Promise<StaticAuthState> {
  const now = Math.floor(Date.now() / 1000);
  const expired =
    !st.gssvCloud ||
    st.gssvCloud.expiresAt - now < 180 ||
    !st.msaExpiresAt ||
    st.msaExpiresAt - now < 180;
  if (!expired || !st.refreshToken) return st;

  const res = await relayFetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MSA_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: st.refreshToken,
      scope: MSA_SCOPE,
    }).toString(),
  });
  const j = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!res.ok || !j.access_token) return st;
  const refreshed = await xblAuthFlow(j.access_token, j.refresh_token || st.refreshToken, st.loginCountry);
  refreshed.activeResolution = st.activeResolution;
  saveStaticState(refreshed);
  return refreshed;
}

function fixImgUrl(u: unknown): string {
  const s = typeof u === 'string' ? u : '';
  return s.startsWith('//') ? `https:${s}` : s;
}

function parsePlan(passMeta: Record<string, unknown> | undefined, isF2p: boolean): 0 | 1 | 2 | 3 {
  if (isF2p) return 0;
  if (!passMeta) return 3;
  if ('CFQ7TTC0K5DJ' in passMeta) return 1;
  if ('CFQ7TTC0P85B' in passMeta) return 2;
  return 3;
}

export const psboxApi = {
  async getSession(): Promise<{
    signedIn: boolean;
    staticHosting: boolean;
    profile?: UserProfile;
    regions?: RegionInfo[];
    selectedRegion?: string;
  }> {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/auth/session');
      const d = await res.json();
      return { ...d, staticHosting: false };
    }

    const st = loadStaticState();
    if (!st || !st.profile) {
      return { signedIn: false, staticHosting: true };
    }
    const fresh = await ensureStaticSessionFresh(st).catch(() => st);
    return {
      signedIn: Boolean(fresh.profile),
      staticHosting: true,
      profile: fresh.profile,
      regions: fresh.gssvCloud?.regions ?? fresh.gssvHome?.regions ?? [],
      selectedRegion: fresh.gssvCloud?.selectedRegion.name ?? fresh.gssvHome?.selectedRegion.name ?? '',
    };
  },

  async startDeviceCode(): Promise<{
    userCode: string;
    deviceCode: string;
    verificationUri: string;
    intervalSec: number;
    expiresInSec: number;
    qrDataUrl: string;
    needsRelay?: boolean;
    networkBlocked?: boolean;
    error?: string;
  }> {
    const defaultUri = 'https://www.microsoft.com/link';
    const defaultQr = await QRCode.toDataURL(defaultUri, {
      margin: 2,
      width: 280,
      color: { dark: '#0b0e14', light: '#ffffff' },
    }).catch(() => '');

    if (await detectLocalBackend()) {
      const res = await fetch('./api/auth/device-code', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        return {
          userCode: '',
          deviceCode: '',
          verificationUri: defaultUri,
          intervalSec: 5,
          expiresInSec: 900,
          qrDataUrl: defaultQr,
          networkBlocked: Boolean(data.networkBlocked),
          error: data.error,
        };
      }
      return data;
    }

    try {
      const res = await relayFetch('https://login.live.com/oauth20_connect.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MSA_CLIENT_ID,
          scope: MSA_SCOPE,
          response_type: 'device_code',
        }).toString(),
      });
      const j = (await res.json()) as Record<string, unknown>;
      if (!res.ok || !j.user_code || !j.device_code) {
        return {
          userCode: '',
          deviceCode: '',
          verificationUri: defaultUri,
          intervalSec: 5,
          expiresInSec: 900,
          qrDataUrl: defaultQr,
          error: `Microsoft device code failed (HTTP ${res.status})`,
        };
      }
      const verificationUri = String(j.verification_uri || defaultUri);
      const qrDataUrl = await QRCode.toDataURL(verificationUri, {
        margin: 2,
        width: 280,
        color: { dark: '#0b0e14', light: '#ffffff' },
      });
      return {
        userCode: String(j.user_code),
        deviceCode: String(j.device_code),
        verificationUri,
        intervalSec: Number(j.interval ?? 5),
        expiresInSec: Number(j.expires_in ?? 900),
        qrDataUrl,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const needsRelay = msg === 'NO_RELAY' && !getRelayUrl();
      return {
        userCode: '',
        deviceCode: '',
        verificationUri: defaultUri,
        intervalSec: 5,
        expiresInSec: 900,
        qrDataUrl: defaultQr,
        needsRelay,
        error: needsRelay
          ? 'Browser CORS blocked direct sign-in to login.live.com. Connect a Cloudflare Relay URL below or run PSBox locally (npm start) to get your live Microsoft sign-in code.'
          : msg,
      };
    }
  },

  async pollDeviceCode(deviceCode: string, loginCountry: string) {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/auth/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode, loginCountry }),
      });
      return res.json();
    }

    const res = await relayFetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MSA_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }).toString(),
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (res.ok && typeof j.access_token === 'string') {
      const st = await xblAuthFlow(j.access_token, String(j.refresh_token || ''), loginCountry);
      saveStaticState(st);
      return {
        status: 'success',
        profile: st.profile,
        regions: st.gssvCloud?.regions ?? st.gssvHome?.regions ?? [],
        selectedRegion: st.gssvCloud?.selectedRegion.name ?? st.gssvHome?.selectedRegion.name ?? '',
      };
    }
    const errCode = String(j.error || '');
    if (errCode === 'authorization_pending') return { status: 'pending' };
    if (errCode === 'slow_down') return { status: 'slow_down' };
    if (errCode === 'expired_token') return { status: 'expired' };
    if (errCode === 'authorization_declined' || errCode === 'access_denied') return { status: 'denied' };
    return { status: 'error', error: String(j.error_description || errCode || `HTTP ${res.status}`) };
  },

  async signOut() {
    if (await detectLocalBackend()) {
      await fetch('./api/auth/signout', { method: 'POST' }).catch(() => {});
    }
    saveStaticState(null);
  },

  async updateRegion(regionName?: string, loginCountry?: string) {
    if (await detectLocalBackend()) {
      await fetch('./api/xcloud/region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionName, loginCountry }),
      }).catch(() => {});
      return;
    }
    const st = loadStaticState();
    if (!st) return;
    if (regionName && st.gssvCloud) {
      const found = st.gssvCloud.regions.find((r) => r.name === regionName);
      if (found) st.gssvCloud.selectedRegion = found;
    }
    if (typeof loginCountry === 'string') st.loginCountry = loginCountry;
    saveStaticState(st);
  },

  async getLibrary(locale: string): Promise<LibraryData> {
    if (await detectLocalBackend()) {
      const res = await fetch(`./api/xcloud/library?lang=${encodeURIComponent(locale)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load catalog');
      return data as LibraryData;
    }

    const rawSt = loadStaticState();
    if (!rawSt) throw new Error('Not signed in');
    const st = await ensureStaticSessionFresh(rawSt);
    const login = st.gssvCloud;
    if (!login) {
      return {
        recentIds: [],
        popularIds: [],
        recentlyAddedIds: [],
        freeToPlayIds: [],
        ownedIds: [],
        products: [],
        regions: st.gssvHome?.regions ?? [],
      };
    }

    const base = login.selectedRegion.baseUri;
    const headers = {
      Authorization: `Bearer ${login.gsToken}`,
      'x-gssv-client': 'XboxComBrowser',
      'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
    };
    const [titlesRes, mruRes, popRes, addRes, ftpRes, allRes, peopleRes] = await Promise.all([
      relayFetch(`${base}/v2/titles?mr=250`, { headers }),
      relayFetch(`${base}/v2/titles/mru?mr=25`, { headers }).catch(() => null),
      relayFetch(
        `https://catalog.gamepass.com/sigls/v2?id=6a589fa0-d493-472b-8e20-3813699d7056&market=${login.market}&language=${encodeURIComponent(locale)}`,
      ).catch(() => null),
      relayFetch(
        `https://catalog.gamepass.com/sigls/v2?id=06323672-b8c8-43cc-b0de-32d5a9834749&market=${login.market}&language=${encodeURIComponent(locale)}`,
      ).catch(() => null),
      relayFetch(
        `https://catalog.gamepass.com/sigls/v2?id=d8f4afcd-882a-49e3-86b3-f61fa0172b75&market=${login.market}&language=${encodeURIComponent(locale)}`,
      ).catch(() => null),
      relayFetch(
        `https://catalog.gamepass.com/sigls/v2?id=af206485-e87d-4624-9007-cb7f6d0cc42e&market=${login.market}&language=${encodeURIComponent(locale)}`,
      ).catch(() => null),
      st.xblProfile
        ? relayFetch(
            'https://peoplehub.xboxlive.com/users/me/people/social/decoration/detail,presencedetail,preferredcolor',
            {
              headers: {
                Authorization: `XBL3.0 x=${st.xblProfile.userHash};${st.xblProfile.token}`,
                'x-xbl-contract-version': '2',
                'Accept-Language': locale,
              },
            },
          ).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!titlesRes.ok) {
      throw new Error(`Failed to fetch Xbox Cloud Gaming titles (HTTP ${titlesRes.status})`);
    }
    const titlesJson = (await titlesRes.json()) as {
      results?: Array<{
        titleId?: string;
        details?: {
          productId?: string;
          alternateProductIds?: string[];
          xboxTitleId?: string;
          supportedInputTypes?: string[];
          userPrograms?: string[];
          hasEntitlement?: boolean;
        };
      }>;
    };
    const mruJson = mruRes?.ok
      ? ((await mruRes.json()) as { results?: Array<{ titleId?: string; details?: { productId?: string } }> })
      : { results: [] };

    const parseSigl = async (r: Response | null) => {
      if (!r || !r.ok) return [] as string[];
      const arr = (await r.json()) as Array<{ id?: string }>;
      return Array.isArray(arr) ? arr.map((x) => x.id).filter((x): x is string => Boolean(x)) : [];
    };
    const [popIds, addIds, ftpIds, allGpIds] = await Promise.all([
      parseSigl(popRes),
      parseSigl(addRes),
      parseSigl(ftpRes),
      parseSigl(allRes),
    ]);

    const friends: FriendPresence[] = [];
    if (peopleRes && peopleRes.ok) {
      const pj = (await peopleRes.json()) as { people?: Array<Record<string, unknown>> };
      for (const p of pj.people ?? []) {
        const details = Array.isArray(p.presenceDetails)
          ? (p.presenceDetails as Array<Record<string, unknown>>)
          : [];
        let titleId = '';
        let device = '';
        let isGame = false;
        for (const d of details) {
          const tid = d.TitleId !== undefined ? String(d.TitleId) : '';
          if (!tid || tid === '750323071' || tid === '1022622766') continue;
          if (Boolean(d.IsGame) || d.State === 'Active') {
            titleId = tid;
            device = String(d.Device ?? '');
            isGame = Boolean(d.IsGame);
            if (isGame) break;
          }
        }
        if (titleId) {
          friends.push({
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
      }
    }

    const gssvByProduct = new Map<
      string,
      { titleId: string; xboxTitleId: string; mkb: boolean; touch: boolean }
    >();
    for (const item of titlesJson.results ?? []) {
      const pid = item.details?.productId || item.details?.alternateProductIds?.[0] || '';
      const tid = item.titleId || '';
      if (
        !pid ||
        !tid ||
        /ARTBOOK|SOUNDTRACK|DIGITALSTORYART|INSTALLPACK|DIGITALEXTRAS|BONUSCONTENT/i.test(tid)
      ) {
        continue;
      }
      const inputs = item.details?.supportedInputTypes ?? [];
      gssvByProduct.set(pid, {
        titleId: tid,
        xboxTitleId: String(item.details?.xboxTitleId ?? ''),
        mkb: inputs.some((x) => /mkb|mouse|keyboard/i.test(x)),
        touch: inputs.some((x) => /touch/i.test(x)),
      });
    }

    const recentIds = (mruJson.results ?? [])
      .map((t) => t.details?.productId || '')
      .filter(Boolean);

    const f2pSet = new Set(ftpIds);
    const gpSet = new Set(allGpIds);

    const batchIds = Array.from(
      new Set([
        ...recentIds,
        ...popIds.slice(0, 60),
        ...addIds.slice(0, 40),
        ...ftpIds.slice(0, 40),
        ...Array.from(gssvByProduct.keys()).slice(0, 120),
      ]),
    ).filter(Boolean);

    const products: CatalogProduct[] = [];
    for (let i = 0; i < batchIds.length; i += 20) {
      const chunk = batchIds.slice(i, i + 20);
      const prodRes = await relayFetch(
        `https://catalog.gamepass.com/v3/products?market=${login.market}&language=${encodeURIComponent(locale)}&hydration=RemoteHighSapphire0`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'calling-app-name': 'psbox-browser',
            'calling-app-version': '1.0',
            'ms-cv': '0.0',
          },
          body: JSON.stringify({ Products: chunk }),
        },
      );
      if (!prodRes.ok) continue;
      const prodJson = (await prodRes.json()) as { Products?: Record<string, Record<string, unknown>> };
      for (const [id, p] of Object.entries(prodJson.Products ?? {})) {
        const imgs = (p.Images || {}) as Record<string, Record<string, unknown>>;
        const hero = fixImgUrl(
          (p.Image_Hero as { URL?: string } | undefined)?.URL ??
            (p.Image_TitledHero as { URL?: string } | undefined)?.URL ??
            (p.ImageHero as { URL?: string } | undefined)?.URL ??
            imgs.TitledHeroArt?.URL ??
            imgs.SuperHeroArt?.URL,
        );
        const tile = fixImgUrl(
          (p.Image_Tile as { URL?: string } | undefined)?.URL ??
            (p.ImageTile as { URL?: string } | undefined)?.URL ??
            imgs.BoxArt?.URL ??
            imgs.Logo?.URL,
        );
        const poster = fixImgUrl(
          (p.Image_Poster as { URL?: string } | undefined)?.URL ??
            (p.ImagePoster as { URL?: string } | undefined)?.URL ??
            imgs.Poster?.URL ??
            tile,
        );
        const rating = (p.ContentRating as Record<string, unknown> | undefined) ?? {};
        const childIds = Array.isArray(p.ChildXboxTitleIds) ? (p.ChildXboxTitleIds as string[]) : [];
        const cats = Array.isArray(p.LocalizedCategories)
          ? (p.LocalizedCategories as string[])
          : Array.isArray(p.Categories)
            ? (p.Categories as string[])
            : [];
        const title = String(p.ProductTitle || '');
        const xcloudTitleId = String(p.XCloudTitleId || gssvByProduct.get(id)?.titleId || '');
        if (
          /ARTBOOK|SOUNDTRACK|DIGITALSTORYART|INSTALLPACK|DIGITALEXTRAS|BONUSCONTENT/i.test(xcloudTitleId) ||
          /\b(soundtrack|artbook|digital art book)\b/i.test(title)
        ) {
          continue;
        }
        const gssv = gssvByProduct.get(id);
        const xboxTitleId = String(p.XboxTitleId ?? gssv?.xboxTitleId ?? childIds[0] ?? '');
        const isF2p = f2pSet.has(id);
        const titleFriends = friends.filter(
          (f) => f.titleId && (f.titleId === xboxTitleId || f.titleId === gssv?.titleId),
        );

        products.push({
          productId: id,
          xcloudTitleId,
          xboxTitleId,
          title,
          publisher: String(p.PublisherName || ''),
          description: String(p.ProductDescription || p.ProductDescriptionShort || ''),
          tileUrl: tile || poster || hero,
          posterUrl: poster || tile || hero,
          heroUrl: hero || poster || tile,
          categories: cats,
          plan: parsePlan(p.PassMetadataByPassProductId as Record<string, unknown> | undefined, isF2p),
          ratingAge: String(rating.LongName ?? rating.RatingId ?? rating.Age ?? ''),
          ratingSystem: String(rating.RatingSystem ?? ''),
          isFreeToPlay: isF2p,
          playable: Boolean(gssv) || gpSet.has(id) || isF2p,
          mouseKeyboard: gssv?.mkb ?? false,
          touch: gssv?.touch ?? false,
          platform: 'XSX',
          friends: titleFriends,
        });
      }
    }

    // Hydrate any owned/unlisted GSSV titles via displaycatalog.mp.microsoft.com
    const hydratedSet = new Set(products.map((p) => p.productId));
    const missingOwned = Array.from(gssvByProduct.keys()).filter((pid) => !hydratedSet.has(pid));
    for (let i = 0; i < Math.min(missingOwned.length, 40); i += 20) {
      const chunk = missingOwned.slice(i, i + 20);
      try {
        const dcRes = await relayFetch(
          `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${chunk.join(',')}&market=${login.market}&languages=${encodeURIComponent(locale)}`,
        );
        if (!dcRes.ok) continue;
        const dcJson = (await dcRes.json()) as { Products?: Array<Record<string, unknown>> };
        for (const p of dcJson.Products ?? []) {
          const pid = String(p.ProductId ?? '');
          const loc = ((p.LocalizedProperties as Array<Record<string, unknown>> | undefined) ?? [])[0] ?? {};
          const imgs = Array.isArray(loc.Images) ? (loc.Images as Array<Record<string, unknown>>) : [];
          const findImg = (purposes: string[]) => {
            for (const purp of purposes) {
              const found = imgs.find((im) => im.ImagePurpose === purp && typeof im.Uri === 'string');
              if (found) return fixImgUrl(found.Uri);
            }
            return '';
          };
          const tile = findImg(['BoxArt', 'Tile', 'Poster']);
          const poster = findImg(['Poster', 'BoxArt', 'Tile']);
          const hero = findImg(['SuperHeroArt', 'TitledHeroArt', 'Hero', 'Poster']) || tile;
          const gssv = gssvByProduct.get(pid);
          if (!pid || !gssv) continue;
          products.push({
            productId: pid,
            xcloudTitleId: gssv.titleId,
            xboxTitleId: gssv.xboxTitleId,
            title: String(loc.ProductTitle || pid),
            publisher: String(loc.PublisherName || ''),
            description: String(loc.ProductDescription || loc.ShortDescription || ''),
            tileUrl: tile || poster || hero,
            posterUrl: poster || tile || hero,
            heroUrl: hero || poster || tile,
            categories: [],
            plan: f2pSet.has(pid) ? 0 : 3,
            ratingAge: '',
            ratingSystem: '',
            isFreeToPlay: f2pSet.has(pid),
            playable: true,
            mouseKeyboard: gssv.mkb,
            touch: gssv.touch,
            platform: 'XSX',
          });
        }
      } catch {
        // ignore fallback batch error
      }
    }

    const ownedIds = Array.from(gssvByProduct.keys()).filter(
      (pid) => !gpSet.has(pid) && !f2pSet.has(pid),
    );

    return {
      recentIds,
      popularIds: popIds,
      recentlyAddedIds: addIds,
      freeToPlayIds: ftpIds,
      ownedIds,
      products,
      regions: login.regions,
    };
  },

  async getAchievements(xboxTitleId: string, locale = 'en-US'): Promise<AchievementItem[]> {
    if (!xboxTitleId) return [];
    if (await detectLocalBackend()) {
      const res = await fetch(
        `./api/xcloud/achievements/${encodeURIComponent(xboxTitleId)}?lang=${encodeURIComponent(locale)}`,
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { achievements?: AchievementItem[] };
      return data.achievements ?? [];
    }
    const st = loadStaticState();
    const xuid = st?.profile?.xuid;
    const xbl = st?.xblProfile;
    if (!xuid || !xbl) return [];
    try {
      const r = await relayFetch(
        `https://achievements.xboxlive.com/users/xuid(${encodeURIComponent(xuid)})/achievements?titleId=${encodeURIComponent(xboxTitleId)}&maxItems=100`,
        {
          headers: {
            Authorization: `XBL3.0 x=${xbl.userHash};${xbl.token}`,
            'x-xbl-contract-version': '2',
            'Accept-Language': locale,
          },
        },
      );
      if (!r.ok) return [];
      const data = (await r.json()) as { achievements?: Array<Record<string, unknown>> };
      return (data.achievements ?? []).map((a) => {
        const rewards = Array.isArray(a.rewards) ? (a.rewards as Array<Record<string, unknown>>) : [];
        const gsReward = rewards.find((rw) => rw.type === 'Gamerscore');
        const unlocked = a.progressState === 'Achieved';
        const progression = a.progression as { timeUnlocked?: string } | undefined;
        return {
          id: String(a.id ?? ''),
          name: String(a.name ?? ''),
          description: String(a.description ?? ''),
          lockedDescription: String(a.lockedDescription ?? ''),
          gamerscore: Number(gsReward?.value ?? 0) || 0,
          unlocked,
          isSecret: Boolean(a.isSecret),
          unlockedAt: unlocked && progression?.timeUnlocked ? progression.timeUnlocked : undefined,
        };
      });
    } catch {
      return [];
    }
  },

  async getConsoles(): Promise<HomeConsole[]> {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/xcloud/consoles');
      if (!res.ok) return [];
      const data = await res.json();
      return data.consoles ?? [];
    }
    const st = loadStaticState();
    if (!st || !st.gssvHome) return [];
    const res = await relayFetch(`${st.gssvHome.selectedRegion.baseUri}/v6/servers/home`, {
      headers: {
        Authorization: `Bearer ${st.gssvHome.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo('1080p'),
      },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { results?: HomeConsole[] };
    return j.results ?? [];
  },

  // Streaming signaling helper (used by XCloudWebRtcClient)
  async sessionStart(titleId: string, resolution: ResolutionMode, locale: string, isHome: boolean) {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/xcloud/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleId, resolution, locale, isHome }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Session start failed');
      return res.json();
    }
    const rawSt = loadStaticState();
    if (!rawSt) throw new Error('Not signed in to xCloud');
    const st = await ensureStaticSessionFresh(rawSt);
    const login = isHome ? st.gssvHome : st.gssvCloud;
    if (!login) throw new Error('Not signed in to xCloud');
    const kind = isHome ? 'home' : 'cloud';
    const res = await relayFetch(`${login.selectedRegion.baseUri}/v5/sessions/${kind}/play`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(resolution),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientSessionId: crypto.randomUUID(),
        titleId: isHome ? '' : titleId,
        systemUpdateGroup: '',
        settings: {
          nanoVersion: 'V3;WebrtcTransport.dll',
          enableTextToSpeech: false,
          magnifier: false,
          highContrast: 0,
          locale,
          useIceConnection: false,
          timezoneOffsetMinutes: 0,
          sdkType: 'web',
          osName: resolution === '720p' ? 'android' : resolution === '1080pHQ' ? 'tizen' : 'windows',
          enableOptionalDataCollection: false,
        },
        serverId: isHome ? titleId : '',
        fallbackRegionNames: [],
      }),
    });
    const j = (await res.json()) as { sessionPath?: string };
    if (!res.ok || !j.sessionPath) throw new Error(`Session start failed (HTTP ${res.status})`);
    st.activeSessionPath = j.sessionPath;
    st.activeSessionIsHome = isHome;
    st.activeResolution = resolution;
    saveStaticState(st);
    return { sessionPath: j.sessionPath };
  },

  async sessionState(titleId: string) {
    if (await detectLocalBackend()) {
      const res = await fetch(`./api/xcloud/session/state?titleId=${encodeURIComponent(titleId)}`);
      if (!res.ok) throw new Error('State failed');
      return res.json();
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (!st?.activeSessionPath || !login) throw new Error('No active session');
    const res = await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}/state`, {
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
      },
    });
    return res.json();
  },

  async sessionConnect() {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/xcloud/session/connect', { method: 'POST' });
      if (!res.ok) throw new Error('Connect failed');
      return res.json();
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (!st?.activeSessionPath || !st.refreshToken || !login) throw new Error('No active session');
    const tokRes = await relayFetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MSA_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: st.refreshToken,
        scope: MSA_TRANSFER_SCOPE,
      }).toString(),
    });
    const tj = (await tokRes.json()) as { access_token?: string; lpt?: string; refresh_token?: string };
    const userToken = tj.access_token || tj.lpt || '';
    if (tj.refresh_token) {
      st.refreshToken = tj.refresh_token;
      saveStaticState(st);
    }
    await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}/connect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userToken }),
    });
    return { ok: true };
  },

  async sendSdpOffer(sdp: string) {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/xcloud/session/sdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp }),
      });
      if (!res.ok) throw new Error('SDP upload failed');
      return;
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (!st?.activeSessionPath || !login) throw new Error('No active session');
    await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}/sdp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageType: 'offer',
        sdp,
        requestId: '1',
        configuration: {
          chatConfiguration: {
            bytesPerSample: 2,
            expectedClipDurationMs: 20,
            format: { codec: 'opus', container: 'webm' },
            numChannels: 1,
            sampleFrequencyHz: 24000,
          },
          chat: { minVersion: 1, maxVersion: 1 },
          control: { minVersion: 1, maxVersion: 3 },
          input: { minVersion: 1, maxVersion: 9 },
          message: { minVersion: 1, maxVersion: 1 },
        },
      }),
    });
  },

  async pollSdpAnswer(): Promise<{ ready: boolean; sdp?: string }> {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/xcloud/session/sdp');
      return res.json();
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (!st?.activeSessionPath || !login) return { ready: false };
    const res = await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}/sdp`, {
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
      },
    });
    if (res.status === 204 || !res.ok) return { ready: false };
    const j = (await res.json()) as { exchangeResponse?: string | { sdp?: string } };
    const ex = typeof j.exchangeResponse === 'string' ? JSON.parse(j.exchangeResponse) : j.exchangeResponse;
    return { ready: Boolean(ex?.sdp), sdp: ex?.sdp };
  },

  async sendIceCandidates(candidates: Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number }>) {
    if (await detectLocalBackend()) {
      await fetch('./api/xcloud/session/ice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates }),
      });
      return;
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (!st?.activeSessionPath || !login) return;
    await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}/ice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageType: 'iceCandidate', candidate: candidates }),
    });
  },

  async pollIceCandidates(): Promise<Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number }>> {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/xcloud/session/ice');
      const d = (await res.json()) as { candidates?: Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number }> };
      return d.candidates ?? [];
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (!st?.activeSessionPath || !login) return [];
    const res = await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}/ice`, {
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
      },
    });
    if (res.status === 204 || !res.ok) return [];
    const j = (await res.json()) as { exchangeResponse?: string | Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number }> };
    const ex = typeof j.exchangeResponse === 'string' ? JSON.parse(j.exchangeResponse) : j.exchangeResponse;
    return Array.isArray(ex) ? ex : [];
  },

  async keepalive() {
    if (await detectLocalBackend()) {
      await fetch('./api/xcloud/session/keepalive', { method: 'POST' }).catch(() => {});
      return;
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (!st?.activeSessionPath || !login) return;
    await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}/keepalive`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.gsToken}`,
        'x-gssv-client': 'XboxComBrowser',
        'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
      },
    }).catch(() => {});
  },

  async stopSession() {
    if (await detectLocalBackend()) {
      await fetch('./api/xcloud/session', { method: 'DELETE' }).catch(() => {});
      return;
    }
    const st = loadStaticState();
    const login = st?.activeSessionIsHome ? st.gssvHome : st?.gssvCloud;
    if (st?.activeSessionPath && login) {
      await relayFetch(`${login.selectedRegion.baseUri}${st.activeSessionPath}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${login.gsToken}`,
          'x-gssv-client': 'XboxComBrowser',
          'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
        },
      }).catch(() => {});
      st.activeSessionPath = undefined;
      saveStaticState(st);
    }
  },
};
