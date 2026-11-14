// PSBox Cloud Gaming — Free Cloudflare Worker CORS Relay
// Deploy once at https://dash.cloudflare.com (Workers & Pages -> Create Worker),
// then paste your *.workers.dev URL into PSBox's Sign-In screen on GitHub Pages.

const ALLOWED_HOSTS = new Set([
  'login.live.com',
  'user.auth.xboxlive.com',
  'xsts.auth.xboxlive.com',
  'profile.xboxlive.com',
  'peoplehub.xboxlive.com',
  'titlehub.xboxlive.com',
  'catalog.gamepass.com',
  'displaycatalog.mp.microsoft.com',
  'contentaccess.exp.xboxservices.com',
]);

function isAllowedHost(hostname) {
  return (
    ALLOWED_HOSTS.has(hostname) ||
    hostname.endsWith('.gssv-play-prod.xboxlive.com') ||
    hostname.endsWith('.xboxlive.com') ||
    hostname.endsWith('.xboxservices.com')
  );
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-xbl-contract-version, x-gssv-client, X-MS-Device-Info, X-PSBox-Country, calling-app-name, calling-app-version, calling-app-context, ms-cv, Accept-Language, Cache-Control, Pragma',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '*';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ ok: true, service: 'psbox-cors-relay' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Invalid target URL', { status: 400, headers: corsHeaders(origin) });
    }

    if (parsed.protocol !== 'https:' || !isAllowedHost(parsed.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: corsHeaders(origin) });
    }

    const fwdHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      const lower = k.toLowerCase();
      if (
        lower === 'content-type' ||
        lower === 'authorization' ||
        lower === 'x-xbl-contract-version' ||
        lower === 'x-gssv-client' ||
        lower === 'x-ms-device-info' ||
        lower === 'calling-app-name' ||
        lower === 'calling-app-version' ||
        lower === 'calling-app-context' ||
        lower === 'ms-cv' ||
        lower === 'accept-language' ||
        lower === 'cache-control' ||
        lower === 'pragma'
      ) {
        fwdHeaders.set(k, v);
      }
    }

    const countryIp = request.headers.get('X-PSBox-Country');
    if (countryIp) fwdHeaders.set('X-Forwarded-For', countryIp);

    const upstream = await fetch(parsed.toString(), {
      method: request.method,
      headers: fwdHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    });

    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      respHeaders.set(k, v);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  },
};
