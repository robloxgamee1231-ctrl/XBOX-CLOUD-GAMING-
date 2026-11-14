// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted from PSBox Cloud Gaming (src/auth/msa.cpp) for Node/Browser

export const MSA_CLIENT_ID = '000000004c20a908';
export const MSA_SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
export const MSA_TRANSFER_SCOPE =
  'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN';

const CONNECT_URL = 'https://login.live.com/oauth20_connect.srf';
const TOKEN_URL = 'https://login.live.com/oauth20_token.srf';

export interface DeviceCodeInfo {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  intervalSec: number;
  expiresInSec: number;
}

export interface MsaTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number; // unix seconds
}

export type PollStatus =
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'success'; tokens: MsaTokens }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'error'; error: string; networkBlocked?: boolean };

export function isNetworkBlocked(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${(err as { cause?: unknown }).cause ?? ''}` : String(err);
  return /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|fetch failed|network|403 Forbidden|proxy|egress/i.test(msg);
}

async function postForm(url: string, fields: Record<string, string>) {
  const body = new URLSearchParams(fields).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, text, json };
}

function parseTokens(j: Record<string, unknown>, prevUserId = ''): MsaTokens | null {
  const accessToken =
    typeof j.access_token === 'string'
      ? j.access_token
      : typeof j.lpt === 'string'
        ? j.lpt
        : '';
  if (!accessToken) return null;
  const refreshToken = typeof j.refresh_token === 'string' ? j.refresh_token : '';
  const userId = typeof j.user_id === 'string' ? j.user_id : prevUserId;
  const expiresIn = typeof j.expires_in === 'number' ? j.expires_in : 3600;
  return {
    accessToken,
    refreshToken,
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };
}

export async function startDeviceCode(): Promise<DeviceCodeInfo> {
  const r = await postForm(CONNECT_URL, {
    client_id: MSA_CLIENT_ID,
    scope: MSA_SCOPE,
    response_type: 'device_code',
  });
  if (!r.ok || !r.json) {
    throw new Error(`Device code request failed (HTTP ${r.status}): ${r.text.slice(0, 200)}`);
  }
  const userCode = String(r.json.user_code ?? '');
  const deviceCode = String(r.json.device_code ?? '');
  const verificationUri = String(r.json.verification_uri ?? 'https://www.microsoft.com/link');
  const intervalSec = Math.min(60, Math.max(1, Number(r.json.interval ?? 5)));
  const expiresInSec = Math.min(3600, Math.max(60, Number(r.json.expires_in ?? 900)));
  if (!userCode || !deviceCode) {
    throw new Error('Device code response missing user_code or device_code');
  }
  return { userCode, deviceCode, verificationUri, intervalSec, expiresInSec };
}

export async function pollDeviceCode(deviceCode: string): Promise<PollStatus> {
  try {
    const r = await postForm(TOKEN_URL, {
      client_id: MSA_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (r.status >= 500) {
      return { status: 'pending' };
    }
    if (r.status === 429) {
      return { status: 'slow_down' };
    }
    if (r.ok && r.json) {
      const tokens = parseTokens(r.json);
      if (tokens) return { status: 'success', tokens };
    }
    const errCode = typeof r.json?.error === 'string' ? r.json.error : '';
    if (errCode === 'authorization_pending') return { status: 'pending' };
    if (errCode === 'slow_down') return { status: 'slow_down' };
    if (errCode === 'expired_token') return { status: 'expired' };
    if (errCode === 'authorization_declined' || errCode === 'access_denied') return { status: 'denied' };
    const desc = typeof r.json?.error_description === 'string' ? r.json.error_description : r.text.slice(0, 200);
    return { status: 'error', error: `HTTP ${r.status} ${errCode}: ${desc}`.trim() };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      networkBlocked: isNetworkBlocked(err),
    };
  }
}

export async function refreshMsaToken(
  refreshToken: string,
  scope: string = MSA_SCOPE,
): Promise<{ tokens?: MsaTokens; error?: string; invalidGrant?: boolean; networkError?: boolean }> {
  try {
    const r = await postForm(TOKEN_URL, {
      client_id: MSA_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: scope || MSA_SCOPE,
    });
    const oauthErr = typeof r.json?.error === 'string' ? r.json.error : '';
    const invalidGrant = oauthErr === 'invalid_grant';
    const networkError = r.status === 0 || r.status >= 500 || r.status === 429 || r.status === 408;
    if (!r.ok || !r.json) {
      return {
        error: `HTTP ${r.status} ${oauthErr}: ${String(r.json?.error_description ?? r.text.slice(0, 180))}`,
        invalidGrant,
        networkError,
      };
    }
    const tokens = parseTokens(r.json);
    if (!tokens) {
      return { error: 'Token response missing access token', invalidGrant, networkError };
    }
    if (!tokens.refreshToken) tokens.refreshToken = refreshToken;
    return { tokens };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      networkError: true,
    };
  }
}
