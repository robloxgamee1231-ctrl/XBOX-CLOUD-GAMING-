// SPDX-License-Identifier: GPL-3.0-or-later
import express from 'express';
import cookieParser from 'cookie-parser';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import {
  isNetworkBlocked,
  MSA_TRANSFER_SCOPE,
  pollDeviceCode,
  refreshMsaToken,
  startDeviceCode,
} from './auth/msa.ts';
import {
  fetchSubscriptionTier,
  fetchXboxProfile,
  getXblUserToken,
  getXstsToken,
  RELYING_PARTIES,
  xblAuthHeader,
} from './auth/xboxLive.ts';
import {
  connectSession,
  getSessionState,
  getWaitTime,
  gssvLogin,
  keepaliveSession,
  listGssvTitles,
  listHomeConsoles,
  pollIceCandidates,
  pollSdpAnswer,
  sendIceCandidates,
  sendSdpOffer,
  startCloudSession,
  stopCloudSession,
  type GssvSessionLogin,
  type IceCandidateDto,
  type ResolutionMode,
} from './xcloud/gssv.ts';
import {
  fetchCatalogProducts,
  fetchFriendsPresence,
  fetchSiglList,
  fetchTitlePlatforms,
  SIGL_IDS,
  type CatalogProduct,
} from './xcloud/catalog.ts';
import {
  deleteSession,
  getOrCreateSession,
  getSession,
  saveSessionsToDisk,
  type StoredSession,
} from './sessionStore.ts';
import { DEMO_CONSOLES, DEMO_PROFILE, getDemoCatalog } from './demoData.ts';

const PORT = Number(process.env.PORT || 3000);
const COOKIE_NAME = 'psbox_sid';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

function attachSession(req: express.Request, res: express.Response): StoredSession {
  const sid = typeof req.cookies?.[COOKIE_NAME] === 'string' ? req.cookies[COOKIE_NAME] : undefined;
  const session = getOrCreateSession(sid);
  if (sid !== session.id) {
    res.cookie(COOKIE_NAME, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600 * 1000,
    });
  }
  return session;
}

async function completeXboxChain(session: StoredSession, loginCountry = '') {
  if (!session.msaTokens?.accessToken) throw new Error('Missing MSA access token');
  const userToken = await getXblUserToken(session.msaTokens.accessToken);
  session.xblUser = userToken;

  let profileXsts = userToken;
  try {
    profileXsts = await getXstsToken(userToken, RELYING_PARTIES.XBOX_LIVE);
    session.xblProfileXsts = profileXsts;
  } catch {
    // Non-fatal
  }

  const profileInfo = await fetchXboxProfile(profileXsts);

  const gssvXsts = await getXstsToken(userToken, RELYING_PARTIES.GSSV);
  session.gssvXsts = gssvXsts;

  let gssvCloud: GssvSessionLogin | undefined;
  let gssvHome: GssvSessionLogin | undefined;

  try {
    gssvCloud = await gssvLogin(gssvXsts.token, 'xgpuweb', loginCountry);
    session.gssvCloud = gssvCloud;
  } catch (err) {
    // Some free accounts only have xhome or F2P; try xhome before failing
    try {
      gssvHome = await gssvLogin(gssvXsts.token, 'xhome', loginCountry);
      session.gssvHome = gssvHome;
    } catch {
      throw err;
    }
  }

  if (!gssvHome) {
    gssvHome = await gssvLogin(gssvXsts.token, 'xhome', loginCountry).catch(() => undefined);
    if (gssvHome) session.gssvHome = gssvHome;
  }

  const market = gssvCloud?.market ?? gssvHome?.market ?? 'US';
  const sub = await fetchSubscriptionTier(userToken, market);

  session.profile = {
    gamertag: profileInfo.gamertag || userToken.gamertag || 'Xbox Player',
    xuid: profileInfo.xuid || userToken.xuid,
    gamerpicUrl: profileInfo.gamerpicUrl,
    gamerscore: profileInfo.gamerscore,
    subscription: sub.subscription,
    playtimeRemainingSec: sub.playtimeRemainingSec,
    playtimeMaxSec: sub.playtimeMaxSec,
    playtimeUnlimited: sub.playtimeUnlimited,
  };
  session.demoMode = false;
  session.loginCountry = loginCountry;
  session.updatedAt = Date.now();
  saveSessionsToDisk();
}

async function ensureValidAuth(session: StoredSession) {
  if (session.demoMode) return;
  if (!session.msaTokens?.refreshToken) throw new Error('Not signed in');
  const now = Math.floor(Date.now() / 1000);
  const gssvExpired =
    !session.gssvCloud || session.gssvCloud.expiresAt - now < 180;
  const msaExpired = session.msaTokens.expiresAt - now < 180;

  if (msaExpired || gssvExpired) {
    const ref = await refreshMsaToken(session.msaTokens.refreshToken);
    if (!ref.tokens) {
      throw new Error(ref.error || 'Token refresh failed');
    }
    session.msaTokens = ref.tokens;
    await completeXboxChain(session, session.loginCountry);
  }
}

// --- Auth Endpoints ----------------------------------------------------------

app.get('/api/auth/session', async (req, res) => {
  const session = attachSession(req, res);
  if (session.demoMode) {
    res.json({
      signedIn: true,
      demoMode: true,
      profile: DEMO_PROFILE,
      regions: getDemoCatalog().regions,
      selectedRegion: 'EASTUS',
      market: 'US',
      loginCountry: session.loginCountry,
    });
    return;
  }

  if (session.msaTokens?.refreshToken && session.profile) {
    try {
      await ensureValidAuth(session);
      res.json({
        signedIn: true,
        demoMode: false,
        profile: session.profile,
        regions: session.gssvCloud?.regions ?? session.gssvHome?.regions ?? [],
        selectedRegion:
          session.gssvCloud?.selectedRegion.name ?? session.gssvHome?.selectedRegion.name ?? '',
        market: session.gssvCloud?.market ?? session.gssvHome?.market ?? 'US',
        loginCountry: session.loginCountry,
      });
      return;
    } catch {
      // Fall through to signedOut if refresh invalid
    }
  }

  res.json({ signedIn: false, demoMode: false });
});

app.post('/api/auth/device-code', async (req, res) => {
  attachSession(req, res);
  try {
    const dc = await startDeviceCode();
    // PSBox rule: QR points to verificationUri WITHOUT ?otc= to avoid Microsoft first-party consent refusal
    const qrDataUrl = await QRCode.toDataURL(dc.verificationUri || 'https://www.microsoft.com/link', {
      margin: 2,
      width: 280,
      color: { dark: '#0b0e14', light: '#ffffff' },
    });
    res.json({ ...dc, qrDataUrl });
  } catch (err) {
    res.status(isNetworkBlocked(err) ? 503 : 500).json({
      error: err instanceof Error ? err.message : String(err),
      networkBlocked: isNetworkBlocked(err),
    });
  }
});

app.post('/api/auth/poll', async (req, res) => {
  const session = attachSession(req, res);
  const deviceCode = String(req.body?.deviceCode ?? '');
  const loginCountry = String(req.body?.loginCountry ?? '');
  if (!deviceCode) {
    res.status(400).json({ error: 'Missing deviceCode' });
    return;
  }

  const poll = await pollDeviceCode(deviceCode);
  if (poll.status !== 'success') {
    res.json(poll);
    return;
  }

  try {
    session.msaTokens = poll.tokens;
    await completeXboxChain(session, loginCountry);
    res.json({
      status: 'success',
      profile: session.profile,
      regions: session.gssvCloud?.regions ?? session.gssvHome?.regions ?? [],
      selectedRegion:
        session.gssvCloud?.selectedRegion.name ?? session.gssvHome?.selectedRegion.name ?? '',
      market: session.gssvCloud?.market ?? session.gssvHome?.market ?? 'US',
    });
  } catch (err) {
    const e = err as Error & { redirectUrl?: string };
    res.status(400).json({
      status: 'error',
      error: e.message,
      redirectUrl: e.redirectUrl,
    });
  }
});

app.post('/api/auth/demo', (req, res) => {
  const session = attachSession(req, res);
  session.demoMode = true;
  session.profile = DEMO_PROFILE;
  session.updatedAt = Date.now();
  saveSessionsToDisk();
  res.json({
    signedIn: true,
    demoMode: true,
    profile: DEMO_PROFILE,
    regions: getDemoCatalog().regions,
    selectedRegion: 'EASTUS',
    market: 'US',
  });
});

app.post('/api/auth/signout', (req, res) => {
  const sid = typeof req.cookies?.[COOKIE_NAME] === 'string' ? req.cookies[COOKIE_NAME] : undefined;
  if (sid) deleteSession(sid);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// --- Settings / Region -------------------------------------------------------

app.post('/api/xcloud/region', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  const regionName = String(req.body?.regionName ?? '');
  const loginCountry =
    typeof req.body?.loginCountry === 'string' ? req.body.loginCountry : session.loginCountry;

  if (session.demoMode) {
    session.loginCountry = loginCountry;
    res.json({ ok: true, selectedRegion: regionName || 'EASTUS', loginCountry });
    return;
  }

  try {
    if (loginCountry !== session.loginCountry) {
      session.loginCountry = loginCountry;
      await completeXboxChain(session, loginCountry);
    }
    if (regionName && session.gssvCloud) {
      const found = session.gssvCloud.regions.find((r) => r.name === regionName);
      if (found) session.gssvCloud.selectedRegion = found;
    }
    saveSessionsToDisk();
    res.json({
      ok: true,
      selectedRegion: session.gssvCloud?.selectedRegion.name ?? '',
      regions: session.gssvCloud?.regions ?? [],
      loginCountry: session.loginCountry,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Catalog & Library -------------------------------------------------------

app.get('/api/xcloud/library', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || (!session.demoMode && !session.msaTokens)) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  if (session.demoMode) {
    res.json({ demoMode: true, ...getDemoCatalog() });
    return;
  }

  try {
    await ensureValidAuth(session);
    const login = session.gssvCloud;
    if (!login) {
      res.json({
        demoMode: false,
        recentIds: [],
        popularIds: [],
        recentlyAddedIds: [],
        freeToPlayIds: [],
        ownedIds: [],
        products: [],
        regions: session.gssvHome?.regions ?? [],
      });
      return;
    }

    const market = login.market || 'US';
    const lang = String(req.query.lang || 'en-US');

    const [allTitles, mruTitles, popList, newList, f2pList, allList, friends] = await Promise.all([
      listGssvTitles(login, false),
      listGssvTitles(login, true).catch(() => []),
      fetchSiglList(SIGL_IDS.MOST_POPULAR, market, lang).catch(() => ({ title: '', productIds: [] })),
      fetchSiglList(SIGL_IDS.RECENTLY_ADDED, market, lang).catch(() => ({ title: '', productIds: [] })),
      fetchSiglList(SIGL_IDS.FREE_TO_PLAY, market, lang).catch(() => ({ title: '', productIds: [] })),
      fetchSiglList(SIGL_IDS.ALL_GAMES, market, lang).catch(() => ({ title: '', productIds: [] })),
      session.xblProfileXsts
        ? fetchFriendsPresence(xblAuthHeader(session.xblProfileXsts), lang)
        : Promise.resolve([]),
    ]);

    const f2pSet = new Set(f2pList.productIds);
    const gpSet = new Set(allList.productIds);

    const productIdsToHydrate = new Set<string>();
    for (const id of popList.productIds.slice(0, 60)) productIdsToHydrate.add(id);
    for (const id of newList.productIds.slice(0, 40)) productIdsToHydrate.add(id);
    for (const id of f2pList.productIds.slice(0, 40)) productIdsToHydrate.add(id);
    for (const t of mruTitles) if (t.productId) productIdsToHydrate.add(t.productId);
    for (const t of allTitles.slice(0, 120)) if (t.productId) productIdsToHydrate.add(t.productId);

    const productMap = await fetchCatalogProducts(Array.from(productIdsToHydrate), market, lang, true);

    const gssvByProduct = new Map(allTitles.filter((t) => t.productId).map((t) => [t.productId, t]));
    const xboxIds = Array.from(
      new Set(
        Object.values(productMap)
          .map((p) => p.xboxTitleId)
          .filter(Boolean),
      ),
    );
    const platforms = session.xblProfileXsts
      ? await fetchTitlePlatforms(xblAuthHeader(session.xblProfileXsts), xboxIds)
      : {};

    const products: CatalogProduct[] = [];
    for (const p of Object.values(productMap)) {
      const gssv = gssvByProduct.get(p.productId);
      const titleFriends = friends.filter(
        (f) => f.titleId && (f.titleId === p.xboxTitleId || f.titleId === gssv?.titleId),
      );
      products.push({
        ...p,
        xcloudTitleId: p.xcloudTitleId || gssv?.titleId || '',
        isFreeToPlay: f2pSet.has(p.productId),
        playable: Boolean(gssv) || gpSet.has(p.productId) || f2pSet.has(p.productId),
        mouseKeyboard: gssv?.mouseKeyboard ?? false,
        touch: gssv?.touch ?? false,
        platform: platforms[p.xboxTitleId] || 'XSX',
        friends: titleFriends,
      });
    }

    const ownedIds = allTitles
      .filter((t) => t.productId && !gpSet.has(t.productId) && !f2pSet.has(t.productId))
      .map((t) => t.productId);

    res.json({
      demoMode: false,
      recentIds: mruTitles.map((t) => t.productId).filter(Boolean),
      popularIds: popList.productIds,
      recentlyAddedIds: newList.productIds,
      freeToPlayIds: f2pList.productIds,
      ownedIds,
      products,
      regions: login.regions,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/xcloud/consoles', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || (!session.demoMode && !session.msaTokens)) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  if (session.demoMode) {
    res.json({ consoles: DEMO_CONSOLES });
    return;
  }
  try {
    await ensureValidAuth(session);
    if (!session.gssvHome && session.gssvXsts) {
      session.gssvHome = await gssvLogin(session.gssvXsts.token, 'xhome', session.loginCountry);
    }
    if (!session.gssvHome) {
      res.json({ consoles: [] });
      return;
    }
    const consoles = await listHomeConsoles(session.gssvHome);
    res.json({ consoles });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- WebRTC Streaming Signaling Endpoints ------------------------------------

app.post('/api/xcloud/session/start', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  const titleId = String(req.body?.titleId ?? '');
  const isHome = Boolean(req.body?.isHome);
  const resolution = (req.body?.resolution ?? '1080p') as ResolutionMode;
  const locale = String(req.body?.locale ?? 'en-US');

  if (session.demoMode) {
    session.activeSessionPath = `/demo/${titleId}`;
    session.activeSessionIsHome = isHome;
    session.activeResolution = resolution;
    res.json({ demoMode: true, sessionPath: session.activeSessionPath, state: 'ReadyToConnect' });
    return;
  }

  try {
    await ensureValidAuth(session);
    const login = isHome ? session.gssvHome : session.gssvCloud;
    if (!login) throw new Error('xCloud login unavailable for this offering');
    const started = await startCloudSession(login, titleId, locale, resolution, isHome);
    session.activeSessionPath = started.sessionPath;
    session.activeSessionIsHome = isHome;
    session.activeResolution = resolution;
    res.json({ demoMode: false, sessionPath: started.sessionPath });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/xcloud/session/state', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || !session.activeSessionPath) {
    res.status(400).json({ error: 'No active session' });
    return;
  }
  if (session.demoMode) {
    res.json({ state: 'ReadyToConnect', waitSeconds: 0 });
    return;
  }
  try {
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (!login) throw new Error('Missing login');
    const st = await getSessionState(login, session.activeSessionPath, session.activeResolution);
    const titleId = typeof req.query.titleId === 'string' ? req.query.titleId : '';
    let waitSeconds = -1;
    if (st.state === 'WaitingForResources' && titleId && !session.activeSessionIsHome) {
      waitSeconds = await getWaitTime(login, titleId, session.activeResolution);
    }
    res.json({ ...st, waitSeconds });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/xcloud/session/connect', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || !session.activeSessionPath) {
    res.status(400).json({ error: 'No active session' });
    return;
  }
  if (session.demoMode) {
    res.json({ ok: true });
    return;
  }
  try {
    if (!session.msaTokens?.refreshToken) throw new Error('Not signed in');
    const transfer = await refreshMsaToken(session.msaTokens.refreshToken, MSA_TRANSFER_SCOPE);
    if (!transfer.tokens) throw new Error(transfer.error || 'Failed to get transfer token');
    if (transfer.tokens.refreshToken) {
      session.msaTokens.refreshToken = transfer.tokens.refreshToken;
      saveSessionsToDisk();
    }
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (!login) throw new Error('Missing login');
    await connectSession(login, session.activeSessionPath, transfer.tokens.accessToken, session.activeResolution);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/xcloud/session/sdp', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || !session.activeSessionPath) {
    res.status(400).json({ error: 'No active session' });
    return;
  }
  const sdp = String(req.body?.sdp ?? '');
  if (!sdp) {
    res.status(400).json({ error: 'Missing SDP' });
    return;
  }
  try {
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (!login) throw new Error('Missing login');
    await sendSdpOffer(login, session.activeSessionPath, sdp, session.activeResolution);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/xcloud/session/sdp', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || !session.activeSessionPath) {
    res.status(400).json({ error: 'No active session' });
    return;
  }
  try {
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (!login) throw new Error('Missing login');
    const sdp = await pollSdpAnswer(login, session.activeSessionPath, session.activeResolution);
    res.json({ ready: Boolean(sdp), sdp });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/xcloud/session/ice', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || !session.activeSessionPath) {
    res.status(400).json({ error: 'No active session' });
    return;
  }
  const candidates = Array.isArray(req.body?.candidates)
    ? (req.body.candidates as IceCandidateDto[])
    : [];
  try {
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (!login) throw new Error('Missing login');
    await sendIceCandidates(login, session.activeSessionPath, candidates, session.activeResolution);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/xcloud/session/ice', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || !session.activeSessionPath) {
    res.status(400).json({ error: 'No active session' });
    return;
  }
  try {
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (!login) throw new Error('Missing login');
    const candidates = await pollIceCandidates(login, session.activeSessionPath, session.activeResolution);
    res.json({ candidates });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/xcloud/session/keepalive', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (!session || !session.activeSessionPath) {
    res.json({ ok: true });
    return;
  }
  if (session.demoMode) {
    res.json({ ok: true });
    return;
  }
  try {
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (login) await keepaliveSession(login, session.activeSessionPath, session.activeResolution);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/xcloud/session', async (req, res) => {
  const session = getSession(req.cookies?.[COOKIE_NAME]);
  if (session?.activeSessionPath && !session.demoMode) {
    const login = session.activeSessionIsHome ? session.gssvHome : session.gssvCloud;
    if (login) await stopCloudSession(login, session.activeSessionPath, session.activeResolution);
  }
  if (session) session.activeSessionPath = undefined;
  res.json({ ok: true });
});

// --- Frontend Serving (Vite Dev Middleware or Static Dist) --------------------

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));

  if (!isProd || !fs.existsSync(distDir)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PSBox Cloud Gaming Web listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
