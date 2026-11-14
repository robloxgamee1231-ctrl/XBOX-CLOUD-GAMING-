import QRCode from 'qrcode';
import { DEMO_CONSOLES, DEMO_PROFILE, getDemoLibrary } from '../data/demoCatalog';
import type {
  CatalogProduct,
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

interface StaticAuthState {
  demoMode: boolean;
  refreshToken?: string;
  accessToken?: string;
  msaExpiresAt?: number;
  xblUser?: { token: string; userHash: string; gamertag: string; xuid: string };
  xblProfile?: { token: string; userHash: string };
  gssvCloud?: { gsToken: string; market: string; regions: RegionInfo[]; selectedRegion: RegionInfo; expiresAt: number };
  gssvHome?: { gsToken: string; market: string; regions: RegionInfo[]; selectedRegion: RegionInfo; expiresAt: number };
  profile?: UserProfile;
  loginCountry: string;
  activeSessionPath?: string;
  activeSessionIsHome?: boolean;
  activeResolution: ResolutionMode;
}

let hasLocalBackend: boolean | null = null;

export function getRelayUrl(): string {
  return (localStorage.getItem(LS_RELAY_URL) || '').trim().replace(/\/+$/, '');
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
  if (!relay) {
    throw new Error('NO_RELAY');
  }
  const headers = new Headers(init.headers);
  if (country && COUNTRY_IPS[country]) {
    headers.set('X-PSBox-Country', COUNTRY_IPS[country]);
  }
  const proxiedUrl = `${relay}/?url=${encodeURIComponent(targetUrl)}`;
  return fetch(proxiedUrl, { ...init, headers });
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

  const gssvLoginReq = async (offering: 'xgpuweb' | 'xhome') => {
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
    };
  };

  const gssvCloud = await gssvLoginReq('xgpuweb').catch(() => undefined);
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
    demoMode: false,
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
      subscription: gssvCloud ? 'GamePass' : '',
      playtimeRemainingSec: -1,
      playtimeMaxSec: -1,
      playtimeUnlimited: false,
    },
    loginCountry,
    activeResolution: '1080p',
  };
}

export const psboxApi = {
  async getSession(): Promise<{
    signedIn: boolean;
    demoMode: boolean;
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
    if (!st) return { signedIn: false, demoMode: false, staticHosting: true };
    if (st.demoMode) {
      return {
        signedIn: true,
        demoMode: true,
        staticHosting: true,
        profile: DEMO_PROFILE,
        regions: getDemoLibrary().regions,
        selectedRegion: 'EASTUS',
      };
    }
    return {
      signedIn: Boolean(st.profile),
      demoMode: false,
      staticHosting: true,
      profile: st.profile,
      regions: st.gssvCloud?.regions ?? st.gssvHome?.regions ?? [],
      selectedRegion: st.gssvCloud?.selectedRegion.name ?? st.gssvHome?.selectedRegion.name ?? '',
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
    if (await detectLocalBackend()) {
      const res = await fetch('./api/auth/device-code', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        return {
          userCode: '',
          deviceCode: '',
          verificationUri: '',
          intervalSec: 5,
          expiresInSec: 900,
          qrDataUrl: '',
          networkBlocked: Boolean(data.networkBlocked),
          error: data.error,
        };
      }
      return data;
    }

    if (!getRelayUrl()) {
      return {
        userCode: '',
        deviceCode: '',
        verificationUri: 'https://www.microsoft.com/link',
        intervalSec: 5,
        expiresInSec: 900,
        qrDataUrl: '',
        needsRelay: true,
        error: 'GitHub Pages static hosting needs a CORS relay URL to contact Microsoft login.live.com.',
      };
    }

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
      throw new Error(`Device code failed (HTTP ${res.status})`);
    }
    const verificationUri = String(j.verification_uri || 'https://www.microsoft.com/link');
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

  async enterDemoMode() {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/auth/demo', { method: 'POST' });
      return res.json();
    }
    saveStaticState({ demoMode: true, loginCountry: '', activeResolution: '1080p', profile: DEMO_PROFILE });
    return {
      signedIn: true,
      demoMode: true,
      profile: DEMO_PROFILE,
      regions: getDemoLibrary().regions,
      selectedRegion: 'EASTUS',
    };
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

    const st = loadStaticState();
    if (!st || st.demoMode || !st.gssvCloud) {
      return getDemoLibrary();
    }

    const login = st.gssvCloud;
    const base = login.selectedRegion.baseUri;
    const headers = {
      Authorization: `Bearer ${login.gsToken}`,
      'x-gssv-client': 'XboxComBrowser',
      'X-MS-Device-Info': buildDeviceInfo(st.activeResolution),
    };
    const [titlesRes, popRes] = await Promise.all([
      relayFetch(`${base}/v2/titles?mr=200`, { headers }),
      relayFetch(
        `https://catalog.gamepass.com/sigls/v2?id=6a589fa0-d493-472b-8e20-3813699d7056&market=${login.market}&language=${locale}`,
      ),
    ]);
    const titlesJson = (await titlesRes.json()) as { results?: Array<{ titleId?: string; details?: { productId?: string } }> };
    const popJson = (await popRes.json()) as Array<{ id?: string }>;
    const popIds = popJson.map((x) => x.id).filter((x): x is string => Boolean(x));
    const gssvMap = new Map((titlesJson.results ?? []).map((t) => [t.details?.productId || '', t.titleId || '']));
    const batchIds = Array.from(new Set([...popIds.slice(0, 40), ...Array.from(gssvMap.keys()).slice(0, 60)])).filter(Boolean);

    const prodRes = await relayFetch(
      `https://catalog.gamepass.com/v3/products?market=${login.market}&language=${locale}&hydration=RemoteHighSapphire0`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Products: batchIds.slice(0, 20) }),
      },
    );
    const prodJson = (await prodRes.json()) as { Products?: Record<string, Record<string, unknown>> };
    const products: CatalogProduct[] = Object.entries(prodJson.Products ?? {}).map(([id, p]) => {
      const fix = (u: unknown) => {
        const s = typeof u === 'string' ? u : '';
        return s.startsWith('//') ? `https:${s}` : s;
      };
      return {
        productId: id,
        xcloudTitleId: String(p.XCloudTitleId || gssvMap.get(id) || ''),
        xboxTitleId: String(p.XboxTitleId || ''),
        title: String(p.ProductTitle || ''),
        publisher: String(p.PublisherName || ''),
        description: String(p.ProductDescription || ''),
        tileUrl: fix((p.ImageTile as { URL?: string } | undefined)?.URL),
        posterUrl: fix((p.ImagePoster as { URL?: string } | undefined)?.URL),
        heroUrl: fix((p.ImageHero as { URL?: string } | undefined)?.URL),
        categories: Array.isArray(p.Categories) ? (p.Categories as string[]) : [],
        plan: 3,
        ratingAge: '',
        ratingSystem: '',
        playable: true,
        platform: 'XSX',
      };
    });

    return {
      demoMode: false,
      recentIds: [],
      popularIds: popIds,
      recentlyAddedIds: [],
      freeToPlayIds: [],
      ownedIds: [],
      products,
      regions: login.regions,
    };
  },

  async getConsoles(): Promise<HomeConsole[]> {
    if (await detectLocalBackend()) {
      const res = await fetch('./api/xcloud/consoles');
      const data = await res.json();
      return data.consoles ?? [];
    }
    const st = loadStaticState();
    if (!st || st.demoMode || !st.gssvHome) return DEMO_CONSOLES;
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
    const st = loadStaticState();
    const login = isHome ? st?.gssvHome : st?.gssvCloud;
    if (!st || !login) throw new Error('Not signed in to xCloud');
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
