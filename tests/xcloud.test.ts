import test from 'node:test';
import assert from 'node:assert/strict';
import { startDeviceCode, pollDeviceCode } from '../server/auth/msa.ts';
import { getXblUserToken, getXstsToken } from '../server/auth/xboxLive.ts';
import { fetchCatalogProducts, fetchDisplayCatalogProducts, fetchSiglList } from '../server/xcloud/catalog.ts';
import { gssvLogin, listGssvTitles, startCloudSession, getSessionState, sendSdpOffer, pollSdpAnswer, sendIceCandidates, pollIceCandidates } from '../server/xcloud/gssv.ts';
import { GamepadButton, gamepadReport, parseVibration } from '../src/stream/inputPacket.ts';

function mockFetch(routes: Record<string, (url: string, init?: RequestInit) => Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    for (const [prefix, handler] of Object.entries(routes)) {
      if (url.startsWith(prefix)) {
        return handler(url, init);
      }
    }
    throw new Error(`Unexpected fetch URL in test: ${url}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('MSA device code + XBL + XSTS + xGPUWeb/xGPUWebF2P + xCloud catalog hydration + WebRTC signaling', async () => {
  const restore = mockFetch({
    'https://login.live.com/oauth20_connect.srf': () =>
      new Response(
        JSON.stringify({
          user_code: 'W7K9P2QX',
          device_code: 'dc-123',
          verification_uri: 'https://www.microsoft.com/link',
          interval: 5,
          expires_in: 900,
        }),
        { status: 200 },
      ),
    'https://login.live.com/oauth20_token.srf': () =>
      new Response(
        JSON.stringify({
          access_token: 'msa-access-1',
          refresh_token: 'msa-refresh-1',
          user_id: 'u1',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    'https://user.auth.xboxlive.com/user/authenticate': () =>
      new Response(
        JSON.stringify({
          Token: 'xbl-user-token',
          DisplayClaims: { xui: [{ uhs: 'uhs-1', gtg: 'TestSpartan', xid: '2535000001' }] },
        }),
        { status: 200 },
      ),
    'https://xsts.auth.xboxlive.com/xsts/authorize': () =>
      new Response(
        JSON.stringify({
          Token: 'xsts-gssv-token',
          DisplayClaims: { xui: [{ uhs: 'uhs-1', gtg: 'TestSpartan', xid: '2535000001' }] },
        }),
        { status: 200 },
      ),
    'https://xgpuweb.gssv-play-prod.xboxlive.com/v2/login/user': () =>
      new Response(
        JSON.stringify({
          gsToken: 'gs-token-1',
          market: 'US',
          durationInSeconds: 3600,
          offeringSettings: {
            regions: [{ name: 'EastUS', baseUri: 'https://eus.core.gssv-play-prod.xboxlive.com', isDefault: true }],
          },
        }),
        { status: 200 },
      ),
    'https://eus.core.gssv-play-prod.xboxlive.com/v2/titles': () =>
      new Response(
        JSON.stringify({
          results: [
            {
              titleId: 'HALOINFINITE',
              details: {
                productId: '',
                alternateProductIds: ['9PP5G1F0C2B6'],
                xboxTitleId: '2043073184',
                supportedInputTypes: ['Controller', 'MKB'],
              },
            },
            {
              titleId: 'GAMEDLC_SOUNDTRACK',
              details: { productId: 'BAD1', xboxTitleId: '1', supportedInputTypes: [] },
            },
          ],
        }),
        { status: 200 },
      ),
    'https://catalog.gamepass.com/sigls/v2': () =>
      new Response(JSON.stringify([{ siglId: '6a589fa0', title: 'Most popular' }, { id: '9PP5G1F0C2B6' }]), {
        status: 200,
      }),
    'https://catalog.gamepass.com/v3/products': () =>
      new Response(
        JSON.stringify({
          Products: {
            '9PP5G1F0C2B6': {
              ProductTitle: 'Halo Infinite',
              PublisherName: 'Xbox Game Studios',
              ProductDescription: 'Campaign and Multiplayer.',
              XCloudTitleId: 'HALOINFINITE',
              XboxTitleId: '2043073184',
              Image_Tile: { URL: '//store-images.s-microsoft.com/image/tile.jpg' },
              Image_Poster: { URL: '//store-images.s-microsoft.com/image/poster.jpg' },
              Image_TitledHero: { URL: '//store-images.s-microsoft.com/image/hero.jpg' },
              LocalizedCategories: ['Shooter'],
              PassMetadataByPassProductId: { CFQ7TTC0K6L8: {} },
              ContentRating: { LongName: '14+', RatingSystem: 'ESRB' },
            },
          },
        }),
        { status: 200 },
      ),
    'https://displaycatalog.mp.microsoft.com/v7.0/products': () =>
      new Response(
        JSON.stringify({
          Products: [
            {
              ProductId: 'OWNED_1',
              LocalizedProperties: [
                {
                  ProductTitle: 'Owned Cloud Game',
                  PublisherName: 'Studio X',
                  Images: [{ ImagePurpose: 'BoxArt', Uri: '//store-images.s-microsoft.com/owned.jpg' }],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    'https://eus.core.gssv-play-prod.xboxlive.com/v5/sessions/cloud/play': () =>
      new Response(JSON.stringify({ sessionPath: '/v5/sessions/cloud/abc-123' }), { status: 200 }),
    'https://eus.core.gssv-play-prod.xboxlive.com/v5/sessions/cloud/abc-123/state': () =>
      new Response(JSON.stringify({ state: 'ReadyToConnect' }), { status: 200 }),
    'https://eus.core.gssv-play-prod.xboxlive.com/v5/sessions/cloud/abc-123/sdp': (_url, init) => {
      if (init?.method === 'POST') return new Response('{}', { status: 202 });
      return new Response(JSON.stringify({ exchangeResponse: JSON.stringify({ status: 'success', sdp: 'v=0\r\n' }) }), {
        status: 200,
      });
    },
    'https://eus.core.gssv-play-prod.xboxlive.com/v5/sessions/cloud/abc-123/ice': (_url, init) => {
      if (init?.method === 'POST') return new Response('{}', { status: 202 });
      return new Response(
        JSON.stringify({
          exchangeResponse: JSON.stringify([
            { candidate: 'candidate:1 1 UDP 1 52.160.1.1 9002 typ host', sdpMid: '0', sdpMLineIndex: 0 },
          ]),
        }),
        { status: 200 },
      );
    },
  });

  try {
    const dc = await startDeviceCode();
    assert.equal(dc.userCode, 'W7K9P2QX');
    assert.equal(dc.verificationUri, 'https://www.microsoft.com/link');

    const poll = await pollDeviceCode(dc.deviceCode);
    assert.equal(poll.status, 'success');

    const xbl = await getXblUserToken(poll.tokens!.accessToken);
    const xsts = await getXstsToken(xbl, 'http://gssv.xboxlive.com/');
    const gssv = await gssvLogin(xsts.token, 'xgpuweb', 'us');
    assert.equal(gssv.selectedRegion.name, 'EastUS');

    const titles = await listGssvTitles(gssv, false);
    assert.equal(titles.length, 1);
    assert.equal(titles[0].productId, '9PP5G1F0C2B6');
    assert.equal(titles[0].mouseKeyboard, true);

    const sigl = await fetchSiglList('6a589fa0');
    assert.deepEqual(sigl.productIds, ['9PP5G1F0C2B6']);

    const prods = await fetchCatalogProducts(sigl.productIds, 'US', 'en-US', true);
    assert.equal(prods['9PP5G1F0C2B6'].title, 'Halo Infinite');
    assert.equal(prods['9PP5G1F0C2B6'].tileUrl, 'https://store-images.s-microsoft.com/image/tile.jpg');
    assert.equal(prods['9PP5G1F0C2B6'].heroUrl, 'https://store-images.s-microsoft.com/image/hero.jpg');
    assert.deepEqual(prods['9PP5G1F0C2B6'].categories, ['Shooter']);

    const owned = await fetchDisplayCatalogProducts(['OWNED_1']);
    assert.equal(owned['OWNED_1'].tileUrl, 'https://store-images.s-microsoft.com/owned.jpg');

    const started = await startCloudSession(gssv, 'HALOINFINITE', 'en-US', '1080p', false);
    assert.equal(started.sessionPath, '/v5/sessions/cloud/abc-123');
    const st = await getSessionState(gssv, started.sessionPath, '1080p');
    assert.equal(st.state, 'ReadyToConnect');
    await sendSdpOffer(gssv, started.sessionPath, 'v=0\r\n', '1080p');
    const ans = await pollSdpAnswer(gssv, started.sessionPath, '1080p');
    assert.equal(ans, 'v=0\r\n');
    await sendIceCandidates(gssv, started.sessionPath, [], '1080p');
    const ice = await pollIceCandidates(gssv, started.sessionPath, '1080p');
    assert.equal(ice.length, 1);
  } finally {
    restore();
  }
});

test('Binary xCloud input packet & vibration parser', () => {
  const pkt = gamepadReport(7, 1234.5, {
    index: 0,
    buttons: GamepadButton.A | GamepadButton.Nexus,
    leftX: 0.5,
    leftY: -0.5,
    rightX: 0,
    rightY: 0,
    leftTrigger: 1,
    rightTrigger: 0,
  });
  assert.equal(pkt.byteLength, 38);
  const view = new DataView(pkt);
  assert.equal(view.getUint16(0, true), 2); // ReportType.Gamepad
  assert.equal(view.getUint32(2, true), 7);
  assert.equal(view.getUint16(16, true), GamepadButton.A | GamepadButton.Nexus);

  // Vibration packet matching parseVibration
  const vibBuf = new ArrayBuffer(14);
  const vv = new DataView(vibBuf);
  vv.setUint8(0, 128); // ReportType.Vibration
  vv.setUint8(3, 0);
  vv.setUint8(4, 80);
  vv.setUint8(5, 40);
  vv.setUint8(6, 10);
  vv.setUint8(7, 20);
  vv.setUint16(8, 200, true);
  vv.setUint16(10, 0, true);
  vv.setUint8(12, 0);
  const parsed = parseVibration(new Uint8Array(vibBuf));
  assert.equal(parsed?.leftMotor, 80);
  assert.equal(parsed?.durationMs, 200);
});
