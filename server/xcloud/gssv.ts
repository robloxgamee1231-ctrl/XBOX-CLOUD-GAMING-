// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted from PSBox Cloud Gaming (src/xcloud/gssv.cpp)

import { randomUUID } from 'node:crypto';

export type ResolutionMode = '720p' | '1080p' | '1080pHQ' | '1440p';

export interface RegionInfo {
  name: string;
  baseUri: string;
  isDefault: boolean;
}

export interface GssvSessionLogin {
  gsToken: string;
  market: string;
  expiresAt: number;
  regions: RegionInfo[];
  selectedRegion: RegionInfo;
  offering: 'xgpuweb' | 'xhome';
}

export interface CloudTitle {
  titleId: string;
  productId: string;
  xboxTitleId: string;
  name: string;
  imageUrl: string;
  supportedInputs: string[];
  mouseKeyboard: boolean;
  touch: boolean;
  isHomeConsole?: boolean;
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

export interface IceCandidateDto {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

const CLIENT_HEADER = 'XboxComBrowser';

const COUNTRY_ADDRESSES: Record<string, string> = {
  br: '169.150.198.66',
  jp: '138.199.21.239',
  kr: '121.125.60.151',
  pl: '45.134.212.66',
  us: '143.244.47.65',
};

export function buildDeviceInfo(resolution: ResolutionMode, previewFeatures = true): string {
  if (resolution === '1440p') {
    return JSON.stringify({
      appInfo: {
        env: {
          clientAppId: previewFeatures ? 'play.xbox.com' : 'www.xbox.com',
          clientAppType: 'browser',
          clientAppVersion: '1.0.2610.0201',
          clientSdkVersion: '10.6.65',
          httpEnvironment: 'prod',
          sdkInstallId: randomUUID(),
        },
      },
      dev: {
        displayInfo: {
          dimensions: { heightInPixels: 1440, widthInPixels: 2560 },
          pixelDensity: { dpiX: 1, dpiY: 1 },
        },
        browser: { browserName: 'edge', browserVersion: '141.0.0.0' },
        hw: {
          make: 'Microsoft',
          model: 'Windows',
          platformType: 'desktop',
          sdkType: 'web',
        },
        os: { name: 'windows', ver: '10.0', platform: 'desktop' },
      },
    });
  }

  if (resolution === '1080pHQ') {
    return JSON.stringify({
      appInfo: {
        env: {
          clientAppId: previewFeatures ? 'play.xbox.com' : 'www.xbox.com',
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
        displayInfo: {
          dimensions: { widthInPixels: 4096, heightInPixels: 2160 },
          pixelDensity: { dpiX: 1, dpiY: 1 },
        },
      },
    });
  }

  const hd = resolution !== '720p';
  return JSON.stringify({
    appInfo: {
      env: {
        clientAppId: previewFeatures ? 'play.xbox.com' : 'Microsoft.GamingApp',
        clientAppType: previewFeatures ? 'browser' : 'native',
        clientAppVersion: previewFeatures ? '26.1.97' : '2203.1001.4.0',
        clientSdkVersion: previewFeatures ? '10.3.7' : '8.5.2',
        httpEnvironment: 'prod',
        sdkInstallId: '',
      },
    },
    dev: {
      hw: {
        make: hd ? 'Microsoft' : 'Google',
        model: hd ? 'Surface Pro' : 'Pixel',
        sdktype: previewFeatures ? 'web' : 'native',
      },
      os: {
        name: hd ? 'Windows 11' : 'Android',
        ver: hd ? '22631.2715' : '14',
        platform: hd ? 'desktop' : 'phone',
      },
      displayInfo: {
        dimensions: { widthInPixels: hd ? 1920 : 1280, heightInPixels: hd ? 1080 : 720 },
        pixelDensity: { dpiX: 1, dpiY: 1 },
      },
    },
  });
}

function authedHeaders(gsToken: string, resolution: ResolutionMode, hasBody = false): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${gsToken}`,
    'x-gssv-client': CLIENT_HEADER,
    'X-MS-Device-Info': buildDeviceInfo(resolution, true),
  };
  if (hasBody) h['Content-Type'] = 'application/json';
  return h;
}

export async function gssvLogin(
  gssvXstsToken: string,
  offering: 'xgpuweb' | 'xhome' = 'xgpuweb',
  loginCountry = '',
): Promise<GssvSessionLogin> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-gssv-client': CLIENT_HEADER,
  };
  const countryIp = COUNTRY_ADDRESSES[loginCountry.toLowerCase()];
  if (countryIp) headers['X-Forwarded-For'] = countryIp;

  const url = `https://${offering}.gssv-play-prod.xboxlive.com/v2/login/user`;
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: gssvXstsToken, offeringId: offering }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let j: Record<string, unknown> | null = null;
    try {
      j = JSON.parse(text);
    } catch {
      j = null;
    }
    if (res.ok && j && typeof j.gsToken === 'string') {
      const regionsRaw =
        (j.offeringSettings as { regions?: Array<Record<string, unknown>> } | undefined)?.regions ?? [];
      const regions: RegionInfo[] = regionsRaw
        .map((r) => ({
          name: String(r.name ?? ''),
          baseUri: String(r.baseUri ?? ''),
          isDefault: Boolean(r.isDefault),
        }))
        .filter((r) => r.baseUri.length > 0);
      const selectedRegion = regions.find((r) => r.isDefault) ?? regions[0];
      if (!selectedRegion) throw new Error('xCloud login returned no regions');
      return {
        gsToken: j.gsToken,
        market: String(j.market ?? 'US'),
        expiresAt: Math.floor(Date.now() / 1000) + Number(j.durationInSeconds ?? 3600),
        regions,
        selectedRegion,
        offering,
      };
    }
    lastErr = `xCloud login failed (HTTP ${res.status}): ${text.slice(0, 200)}`;
    if (res.status === 403) {
      throw new Error(
        `${lastErr} (No Game Pass cloud gaming plan or xCloud is not available in this region; try Region Bypass in Settings)`,
      );
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      throw new Error(lastErr);
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw new Error(lastErr);
}

export async function listGssvTitles(
  login: GssvSessionLogin,
  recentOnly = false,
  resolution: ResolutionMode = '1080p',
): Promise<CloudTitle[]> {
  const out: CloudTitle[] = [];
  let continuation = '';
  let pages = 0;

  do {
    const path = recentOnly ? '/v2/titles/mru?mr=25' : '/v2/titles?mr=200';
    const fullUrl = `${login.selectedRegion.baseUri}${path}${continuation ? `&ct=${encodeURIComponent(continuation)}` : ''}`;
    const res = await fetch(fullUrl, {
      headers: authedHeaders(login.gsToken, resolution),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Title list failed: HTTP ${res.status}`);
    const j = (await res.json()) as {
      results?: Array<Record<string, unknown>>;
      continuationToken?: string;
    };
    for (const item of j.results ?? []) {
      const details = (item.details ?? {}) as Record<string, unknown>;
      const supportedInputs = Array.isArray(details.supportedInputTypes)
        ? (details.supportedInputTypes as string[])
        : [];
      out.push({
        titleId: String(item.titleId ?? ''),
        productId: String(details.productId ?? ''),
        xboxTitleId: String(details.xboxTitleId ?? ''),
        name: '',
        imageUrl: '',
        supportedInputs,
        mouseKeyboard: supportedInputs.some((x) => /mkb|mouse|keyboard/i.test(x)),
        touch: supportedInputs.some((x) => /touch/i.test(x)),
      });
    }
    continuation = typeof j.continuationToken === 'string' ? j.continuationToken : '';
    pages++;
  } while (continuation && !recentOnly && pages < 20);

  return out;
}

export async function listHomeConsoles(
  login: GssvSessionLogin,
  resolution: ResolutionMode = '1080p',
): Promise<HomeConsole[]> {
  const res = await fetch(`${login.selectedRegion.baseUri}/v6/servers/home`, {
    headers: authedHeaders(login.gsToken, resolution),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Console list failed: HTTP ${res.status}`);
  const j = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (j.results ?? [])
    .map((c) => ({
      serverId: String(c.serverId ?? ''),
      deviceName: String(c.deviceName ?? 'Xbox Console'),
      consoleType: String(c.consoleType ?? 'Xbox'),
      powerState: String(c.powerState ?? 'Unknown'),
      playPath: String(c.playPath ?? ''),
      outOfHomeWarning: Boolean(c.outOfHomeWarning),
      wirelessWarning: Boolean(c.wirelessWarning),
    }))
    .filter((c) => c.serverId.length > 0);
}

export async function startCloudSession(
  login: GssvSessionLogin,
  targetId: string,
  locale: string,
  resolution: ResolutionMode,
  isHome = false,
): Promise<{ sessionPath: string }> {
  const osName =
    resolution === '720p' ? 'android' : resolution === '1080pHQ' ? 'tizen' : 'windows';
  const body = {
    clientSessionId: randomUUID(),
    titleId: isHome ? '' : targetId,
    systemUpdateGroup: '',
    settings: {
      nanoVersion: 'V3;WebrtcTransport.dll',
      enableTextToSpeech: false,
      magnifier: false,
      highContrast: 0,
      locale: locale || 'en-US',
      useIceConnection: false,
      timezoneOffsetMinutes: 0,
      sdkType: 'web',
      osName,
      enableOptionalDataCollection: false,
    },
    serverId: isHome ? targetId : '',
    fallbackRegionNames: [],
  };
  const kind = isHome ? 'home' : 'cloud';
  const res = await fetch(`${login.selectedRegion.baseUri}/v5/sessions/${kind}/play`, {
    method: 'POST',
    headers: authedHeaders(login.gsToken, resolution, true),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let j: Record<string, unknown> | null = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = null;
  }
  if (!res.ok || !j || typeof j.sessionPath !== 'string') {
    throw new Error(`Session start failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  return { sessionPath: j.sessionPath };
}

function sessionUrl(login: GssvSessionLogin, sessionPath: string, suffix: string): string {
  const p = sessionPath.startsWith('/') ? sessionPath : `/${sessionPath}`;
  return `${login.selectedRegion.baseUri}${p}${suffix}`;
}

export async function getSessionState(
  login: GssvSessionLogin,
  sessionPath: string,
  resolution: ResolutionMode,
): Promise<{ state: string; errorCode?: string; errorMessage?: string }> {
  const res = await fetch(sessionUrl(login, sessionPath, '/state'), {
    headers: authedHeaders(login.gsToken, resolution),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Session state failed: HTTP ${res.status}`);
  const j = (await res.json()) as {
    state?: string;
    errorDetails?: { code?: string; message?: string };
  };
  return {
    state: j.state ?? 'Unknown',
    errorCode: j.errorDetails?.code,
    errorMessage: j.errorDetails?.message,
  };
}

export async function getWaitTime(
  login: GssvSessionLogin,
  titleId: string,
  resolution: ResolutionMode,
): Promise<number> {
  try {
    const res = await fetch(`${login.selectedRegion.baseUri}/v1/waittime/${encodeURIComponent(titleId)}`, {
      headers: authedHeaders(login.gsToken, resolution),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return -1;
    const j = (await res.json()) as { estimatedTotalWaitTimeInSeconds?: number };
    return typeof j.estimatedTotalWaitTimeInSeconds === 'number' ? j.estimatedTotalWaitTimeInSeconds : -1;
  } catch {
    return -1;
  }
}

export async function connectSession(
  login: GssvSessionLogin,
  sessionPath: string,
  userToken: string,
  resolution: ResolutionMode,
): Promise<void> {
  const res = await fetch(sessionUrl(login, sessionPath, '/connect'), {
    method: 'POST',
    headers: authedHeaders(login.gsToken, resolution, true),
    body: JSON.stringify({ userToken }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Session connect failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function sendSdpOffer(
  login: GssvSessionLogin,
  sessionPath: string,
  sdp: string,
  resolution: ResolutionMode,
): Promise<void> {
  const res = await fetch(sessionUrl(login, sessionPath, '/sdp'), {
    method: 'POST',
    headers: authedHeaders(login.gsToken, resolution, true),
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
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SDP offer failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function pollSdpAnswer(
  login: GssvSessionLogin,
  sessionPath: string,
  resolution: ResolutionMode,
): Promise<string | null> {
  const res = await fetch(sessionUrl(login, sessionPath, '/sdp'), {
    headers: authedHeaders(login.gsToken, resolution),
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`SDP answer poll failed: HTTP ${res.status}`);
  const j = (await res.json()) as { exchangeResponse?: unknown };
  const payload =
    typeof j.exchangeResponse === 'string'
      ? (JSON.parse(j.exchangeResponse) as Record<string, unknown>)
      : (j.exchangeResponse as Record<string, unknown> | undefined);
  if (!payload) return null;
  if (payload.status && payload.status !== 'success') {
    throw new Error(`SDP negotiation rejected: ${JSON.stringify(payload)}`);
  }
  return typeof payload.sdp === 'string' ? payload.sdp : null;
}

export async function sendIceCandidates(
  login: GssvSessionLogin,
  sessionPath: string,
  candidates: IceCandidateDto[],
  resolution: ResolutionMode,
): Promise<void> {
  const res = await fetch(sessionUrl(login, sessionPath, '/ice'), {
    method: 'POST',
    headers: authedHeaders(login.gsToken, resolution, true),
    body: JSON.stringify({ messageType: 'iceCandidate', candidate: candidates }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ICE upload failed: HTTP ${res.status}`);
}

export async function pollIceCandidates(
  login: GssvSessionLogin,
  sessionPath: string,
  resolution: ResolutionMode,
): Promise<IceCandidateDto[]> {
  const res = await fetch(sessionUrl(login, sessionPath, '/ice'), {
    headers: authedHeaders(login.gsToken, resolution),
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`ICE poll failed: HTTP ${res.status}`);
  const j = (await res.json()) as { exchangeResponse?: unknown };
  const payload =
    typeof j.exchangeResponse === 'string'
      ? (JSON.parse(j.exchangeResponse) as Array<Record<string, unknown>>)
      : (j.exchangeResponse as Array<Record<string, unknown>> | undefined);
  if (!Array.isArray(payload)) return [];
  return payload
    .map((c) => ({
      candidate: String(c.candidate ?? ''),
      sdpMid: String(c.sdpMid ?? ''),
      sdpMLineIndex: Number(c.sdpMLineIndex ?? 0),
    }))
    .filter((c) => c.candidate.length > 0);
}

export async function keepaliveSession(
  login: GssvSessionLogin,
  sessionPath: string,
  resolution: ResolutionMode,
): Promise<void> {
  const res = await fetch(sessionUrl(login, sessionPath, '/keepalive'), {
    method: 'POST',
    headers: authedHeaders(login.gsToken, resolution, true),
    body: '',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Keepalive failed: HTTP ${res.status}`);
}

export async function stopCloudSession(
  login: GssvSessionLogin,
  sessionPath: string,
  resolution: ResolutionMode,
): Promise<void> {
  if (!sessionPath) return;
  await fetch(sessionUrl(login, sessionPath, ''), {
    method: 'DELETE',
    headers: authedHeaders(login.gsToken, resolution),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}
