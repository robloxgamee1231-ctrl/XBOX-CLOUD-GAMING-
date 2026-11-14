// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted from PSBox Cloud Gaming (src/auth/xbox_live.cpp & auth_manager.cpp)

export interface XblToken {
  token: string;
  userHash: string;
  gamertag: string;
  xuid: string;
  notAfter: string;
}

export const RELYING_PARTIES = {
  GSSV: 'http://gssv.xboxlive.com/',
  XBOX_LIVE: 'http://xboxlive.com',
  MARKETPLACE: 'http://mp.microsoft.com/',
} as const;

export function xblAuthHeader(t: XblToken): string {
  return `XBL3.0 x=${t.userHash};${t.token}`;
}

const XERR_MESSAGES: Record<number, string> = {
  2148916227: 'This Xbox account is suspended or banned (2148916227).',
  2148916233:
    'This Microsoft account has no Xbox profile yet — sign in once at xbox.com to create a Gamertag (2148916233).',
  2148916235: 'Xbox Live is not offered in this account’s country/region (2148916235).',
  2148916236: 'Age verification or terms acceptance is required at xbox.com in a browser (2148916236).',
  2148916237: 'Age verification or terms acceptance is required at xbox.com in a browser (2148916237).',
  2148916238:
    'Child account: an adult must add this account to a Microsoft family at account.microsoft.com/family (2148916238).',
};

async function postXblJson(url: string, body: unknown, what: string): Promise<{ token: XblToken; redirectUrl?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-xbl-contract-version': '1',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let j: Record<string, unknown> | null = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = null;
  }
  if (!res.ok || !j || typeof j.Token !== 'string') {
    let msg = `${what} failed (HTTP ${res.status})`;
    const xerr = typeof j?.XErr === 'number' ? j.XErr : undefined;
    if (xerr !== undefined) {
      msg += ` XErr ${xerr}`;
      if (XERR_MESSAGES[xerr]) msg += ` — ${XERR_MESSAGES[xerr]}`;
    }
    const redirectUrl = typeof j?.Redirect === 'string' ? j.Redirect : undefined;
    const err = new Error(msg) as Error & { redirectUrl?: string; httpStatus?: number };
    err.redirectUrl = redirectUrl;
    err.httpStatus = res.status;
    throw err;
  }
  const claims = j.DisplayClaims as { xui?: Array<Record<string, string>> } | undefined;
  const xui = claims?.xui?.[0] ?? {};
  return {
    token: {
      token: j.Token,
      notAfter: typeof j.NotAfter === 'string' ? j.NotAfter : '',
      userHash: xui.uhs ?? '',
      gamertag: xui.gtg ?? '',
      xuid: xui.xid ?? '',
    },
  };
}

export async function getXblUserToken(msaAccessToken: string): Promise<XblToken> {
  try {
    const { token } = await postXblJson(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `t=${msaAccessToken}`,
        },
      },
      'Xbox user authentication',
    );
    return token;
  } catch {
    // Fallback to MSAL "d=" prefix if "t=" was rejected
    const { token } = await postXblJson(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${msaAccessToken}`,
        },
      },
      'Xbox user authentication',
    );
    return token;
  }
}

export async function getXstsToken(userToken: XblToken, relyingParty: string): Promise<XblToken> {
  const { token } = await postXblJson(
    'https://xsts.auth.xboxlive.com/xsts/authorize',
    {
      RelyingParty: relyingParty,
      TokenType: 'JWT',
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [userToken.token],
      },
    },
    `XSTS authorization (${relyingParty})`,
  );
  return token;
}

export interface XboxProfileInfo {
  gamertag: string;
  xuid: string;
  gamerpicUrl: string;
  gamerscore: string;
}

export async function fetchXboxProfile(profileXsts: XblToken): Promise<XboxProfileInfo> {
  const auth = xblAuthHeader(profileXsts);
  const info: XboxProfileInfo = {
    gamertag: profileXsts.gamertag,
    xuid: profileXsts.xuid,
    gamerpicUrl: '',
    gamerscore: '',
  };
  try {
    const res = await fetch(
      'https://profile.xboxlive.com/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore',
      {
        headers: {
          Authorization: auth,
          'x-xbl-contract-version': '3',
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return info;
    const data = (await res.json()) as {
      profileUsers?: Array<{ id?: string; settings?: Array<{ id?: string; value?: string }> }>;
    };
    const settings = data.profileUsers?.[0]?.settings ?? [];
    for (const s of settings) {
      if (s.id === 'GameDisplayName' && s.value && !info.gamertag) info.gamertag = s.value;
      if (s.id === 'GameDisplayPicRaw' && s.value) info.gamerpicUrl = s.value;
      if (s.id === 'Gamerscore' && s.value) info.gamerscore = s.value;
    }
  } catch {
    // Non-fatal
  }
  return info;
}

export async function fetchSubscriptionTier(
  userToken: XblToken,
  market = 'US',
): Promise<{ subscription: string; playtimeRemainingSec: number; playtimeMaxSec: number; playtimeUnlimited: boolean }> {
  let subscription = '';
  let playtimeRemainingSec = -1;
  let playtimeMaxSec = -1;
  let playtimeUnlimited = false;

  try {
    const mpXsts = await getXstsToken(userToken, RELYING_PARTIES.MARKETPLACE);
    const mpAuth = xblAuthHeader(mpXsts);
    const res = await fetch(
      `https://contentaccess.exp.xboxservices.com/all/v1?market=${encodeURIComponent(market || 'US')}`,
      {
        headers: { Authorization: mpAuth },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer());
      const decoded = decodeContentAccessProtobuf(buf);
      if (decoded.subscription) subscription = decoded.subscription;
      playtimeRemainingSec = decoded.remainingSec;
      playtimeMaxSec = decoded.maxSec;
      playtimeUnlimited = decoded.unlimited;
    }
  } catch {
    // Non-fatal
  }

  return { subscription, playtimeRemainingSec, playtimeMaxSec, playtimeUnlimited };
}

// Lightweight protobuf wire reader matching PSBox's src/auth/auth_manager.cpp
function decodeContentAccessProtobuf(buf: Uint8Array): {
  subscription: string;
  remainingSec: number;
  maxSec: number;
  unlimited: boolean;
} {
  let pos = 0;
  const readVarint = (data: Uint8Array, state: { p: number; ok: boolean }): number => {
    let v = 0n;
    for (let shift = 0n; shift < 64n && state.p < data.length; shift += 7n) {
      const b = data[state.p++];
      v |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return Number(v);
    }
    state.ok = false;
    return 0;
  };

  const iterFields = (
    data: Uint8Array,
    cb: (field: number, wire: number, val: number, sub: Uint8Array) => void,
  ) => {
    const st = { p: 0, ok: true };
    while (st.ok && st.p < data.length) {
      const tag = readVarint(data, st);
      if (!st.ok) break;
      const field = tag >>> 3;
      const wire = tag & 7;
      if (wire === 0) {
        const val = readVarint(data, st);
        if (st.ok) cb(field, wire, val, new Uint8Array(0));
      } else if (wire === 1) {
        st.p += 8;
      } else if (wire === 5) {
        st.p += 4;
      } else if (wire === 2) {
        const len = readVarint(data, st);
        if (!st.ok || st.p + len > data.length) break;
        const sub = data.subarray(st.p, st.p + len);
        st.p += len;
        cb(field, wire, 0, sub);
      } else {
        break;
      }
    }
  };

  let subscription = '';
  let remainingSec = -1;
  let maxSec = -1;
  let unlimited = false;
  const textDec = new TextDecoder();

  iterFields(buf, (field, wire, _val, sub) => {
    if (field === 1 && wire === 2) {
      // passes by user {1: PUID, 2: passes}
      iterFields(sub, (f2, w2, _v2, sub2) => {
        if (f2 === 2 && w2 === 2) {
          const s = textDec.decode(sub2).toLowerCase();
          if (s.includes('ultimate')) subscription = 'Ultimate';
          else if (s.includes('premium') && subscription !== 'Ultimate') subscription = 'Premium';
          else if (s.includes('essential') && !subscription) subscription = 'Essential';
        }
      });
    } else if (field === 2 && wire === 2 && maxSec < 0) {
      // products {2: {2: access {11: streaming gameplay {2: remaining, 4: max}}}}
      iterFields(sub, (f2, w2, _v2, sub2) => {
        if (f2 === 2 && w2 === 2) {
          iterFields(sub2, (f3, w3, _v3, sub3) => {
            if (f3 === 2 && w3 === 2) {
              iterFields(sub3, (f4, w4, _v4, sub4) => {
                if (f4 === 11 && w4 === 2) {
                  let rem = -1;
                  let mx = -1;
                  iterFields(sub4, (f5, w5, v5) => {
                    if (f5 === 2 && w5 === 0) rem = v5;
                    if (f5 === 4 && w5 === 0) mx = v5;
                  });
                  if (mx > 0) {
                    remainingSec = Math.max(0, rem);
                    maxSec = mx;
                  } else if (rem === 0 && mx === 0) {
                    unlimited = true;
                  }
                }
              });
            }
          });
        }
      });
    }
  });

  void pos;
  return { subscription, remainingSec, maxSec, unlimited };
}
