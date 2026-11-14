import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Gamepad2,
  Globe,
  Link2,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { t, type LangCode } from '../i18n/translations';
import { getRelayUrl, psboxApi, setRelayUrl } from '../services/psboxApi';
import type { RegionInfo, UserProfile } from '../types';

interface DeviceCodeState {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  intervalSec: number;
  expiresInSec: number;
  qrDataUrl: string;
}

interface SignInScreenProps {
  lang: LangCode;
  loginCountry: string;
  onChangeCountry: (country: string) => void;
  onSignedIn: (data: {
    demoMode: boolean;
    profile: UserProfile;
    regions: RegionInfo[];
    selectedRegion: string;
  }) => void;
}

const BYPASS_COUNTRIES = [
  { code: '', label: 'Auto (Default Region)' },
  { code: 'us', label: 'United States (US)' },
  { code: 'br', label: 'Brazil (BR)' },
  { code: 'jp', label: 'Japan (JP)' },
  { code: 'kr', label: 'South Korea (KR)' },
  { code: 'pl', label: 'Poland (PL)' },
];

const WORKER_SNIPPET = `const ALLOWED = ['login.live.com','user.auth.xboxlive.com','xsts.auth.xboxlive.com','profile.xboxlive.com','peoplehub.xboxlive.com','titlehub.xboxlive.com','catalog.gamepass.com','displaycatalog.mp.microsoft.com','contentaccess.exp.xboxservices.com'];
const cors = (o) => ({ 'Access-Control-Allow-Origin': o || '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-xbl-contract-version,x-gssv-client,X-MS-Device-Info,X-PSBox-Country,calling-app-name,calling-app-version,ms-cv' });
export default {
  async fetch(req) {
    const o = req.headers.get('Origin') || '*';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) });
    const target = new URL(req.url).searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...cors(o) } });
    const u = new URL(target);
    if (!ALLOWED.includes(u.hostname) && !u.hostname.endsWith('.xboxlive.com')) return new Response('Forbidden', { status: 403, headers: cors(o) });
    const h = new Headers();
    for (const [k, v] of req.headers) if (/^(content-type|authorization|x-xbl-|x-gssv-|x-ms-|calling-app-|ms-cv|accept-language)/i.test(k)) h.set(k, v);
    if (req.headers.get('X-PSBox-Country')) h.set('X-Forwarded-For', req.headers.get('X-PSBox-Country'));
    const up = await fetch(u, { method: req.method, headers: h, body: /GET|HEAD/.test(req.method) ? undefined : await req.arrayBuffer() });
    const rh = new Headers(up.headers);
    for (const [k, v] of Object.entries(cors(o))) rh.set(k, v);
    return new Response(up.body, { status: up.status, headers: rh });
  }
};`;

export const SignInScreen: React.FC<SignInScreenProps> = ({
  lang,
  loginCountry,
  onChangeCountry,
  onSignedIn,
}) => {
  const [dc, setDc] = useState<DeviceCodeState | null>(null);
  const [loadingCode, setLoadingCode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsRelay, setNeedsRelay] = useState(false);
  const [networkBlocked, setNetworkBlocked] = useState(false);
  const [relayInput, setRelayInput] = useState(() => getRelayUrl());
  const [showRelayHelp, setShowRelayHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedWorker, setCopiedWorker] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [defaultQr, setDefaultQr] = useState('');
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    QRCode.toDataURL('https://www.microsoft.com/link', {
      margin: 2,
      width: 280,
      color: { dark: '#0b0e14', light: '#ffffff' },
    })
      .then(setDefaultQr)
      .catch(() => {});
  }, []);

  const requestNewCode = async () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    setLoadingCode(true);
    setError(null);
    setNeedsRelay(false);
    setNetworkBlocked(false);
    try {
      const data = await psboxApi.startDeviceCode();
      if (data.needsRelay) {
        setNeedsRelay(true);
        setDc(null);
        return;
      }
      if (data.error || !data.userCode) {
        setNetworkBlocked(Boolean(data.networkBlocked));
        setError(data.error || 'Could not start Microsoft sign-in.');
        setDc(null);
        return;
      }
      setDc(data);
    } catch (err) {
      setNetworkBlocked(true);
      setError(err instanceof Error ? err.message : 'Network error connecting to sign-in service');
    } finally {
      setLoadingCode(false);
    }
  };

  useEffect(() => {
    requestNewCode();
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!dc) return;
    let cancelled = false;
    let intervalMs = Math.max(3000, (dc.intervalSec || 5) * 1000);

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await psboxApi.pollDeviceCode(dc.deviceCode, loginCountry);
        if (cancelled) return;

        if (data.status === 'success') {
          onSignedIn({
            demoMode: false,
            profile: data.profile,
            regions: data.regions ?? [],
            selectedRegion: data.selectedRegion ?? '',
          });
          return;
        }
        if (data.status === 'slow_down') {
          intervalMs = Math.min(intervalMs + 5000, 60000);
        } else if (data.status === 'expired' || data.status === 'denied' || data.status === 'error') {
          setError(data.error || `Microsoft sign-in ${data.status}. Click "New code" to try again.`);
          return;
        }
      } catch {
        // Keep polling on brief hiccup
      }
      if (!cancelled) {
        pollTimer.current = window.setTimeout(poll, intervalMs);
      }
    };

    pollTimer.current = window.setTimeout(poll, intervalMs);
    return () => {
      cancelled = true;
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [dc, loginCountry, onSignedIn]);

  const handleCopy = async () => {
    if (!dc?.userCode) return;
    await navigator.clipboard?.writeText(dc.userCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWorker = async () => {
    await navigator.clipboard?.writeText(WORKER_SNIPPET).catch(() => {});
    setCopiedWorker(true);
    setTimeout(() => setCopiedWorker(false), 2200);
  };

  const handleSaveRelay = (e: React.FormEvent) => {
    e.preventDefault();
    setRelayUrl(relayInput);
    requestNewCode();
  };

  const handleDemoMode = async () => {
    setDemoLoading(true);
    try {
      const data = await psboxApi.enterDemoMode();
      onSignedIn({
        demoMode: true,
        profile: data.profile,
        regions: data.regions ?? [],
        selectedRegion: data.selectedRegion ?? 'EASTUS',
      });
    } finally {
      setDemoLoading(false);
    }
  };

  const cleanUri = (dc?.verificationUri || 'https://www.microsoft.com/link').replace(/^https?:\/\/(www\.)?/, '');

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between px-5 sm:px-14 py-8 sm:py-12 psbox-shell-bg overflow-x-hidden">
      <div className="max-w-6xl w-full mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        {/* Left: PSBox Sign-In Column */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center gap-3.5">
            <BrandMark size={44} />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">{t(lang, 'appName')}</h1>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight pt-1">
            {t(lang, 'signInTitle')}
          </h2>

          {loadingCode ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 bg-[#242424] rounded-2xl my-4">
              <RefreshCw className="w-8 h-8 text-white psbox-spinner" />
              <span className="text-sm text-[#bebebe]">Connecting to Microsoft sign-in...</span>
            </div>
          ) : dc ? (
            <div className="space-y-5 pt-1">
              <div>
                <div className="text-base sm:text-lg text-[#bebebe] mb-1.5">
                  {t(lang, 'signInStep1')}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={dc.verificationUri || 'https://www.microsoft.com/link'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-2xl sm:text-3xl font-semibold text-white hover:underline inline-flex items-center gap-2"
                  >
                    {cleanUri}
                    <ExternalLink className="w-5 h-5 text-[#bebebe]" />
                  </a>
                  <button type="button" onClick={requestNewCode} className="psbox-btn text-xs">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t(lang, 'newCode')}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-base sm:text-lg text-[#bebebe] mb-2.5">
                  {t(lang, 'signInStep2')}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 bg-[#242424] rounded-2xl px-6 py-4">
                    {dc.userCode.split('').map((ch, idx) => (
                      <span
                        key={idx}
                        className="w-9 sm:w-12 text-center text-4xl sm:text-5xl font-bold tracking-wider text-white font-mono"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={handleCopy} className="psbox-btn text-sm">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? t(lang, 'copied') : t(lang, 'copyCode')}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 text-base text-[#8c8c8c]">
                <RefreshCw className="w-5 h-5 text-white psbox-spinner shrink-0" />
                <span>{t(lang, 'signInWaiting')}</span>
              </div>
            </div>
          ) : needsRelay ? (
            <div className="space-y-4 pt-1">
              <div>
                <div className="text-base sm:text-lg text-[#bebebe] mb-1.5">
                  {t(lang, 'signInStep1')}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://www.microsoft.com/link"
                    target="_blank"
                    rel="noreferrer"
                    className="text-2xl sm:text-3xl font-semibold text-white hover:underline inline-flex items-center gap-2"
                  >
                    microsoft.com/link
                    <ExternalLink className="w-5 h-5 text-[#bebebe]" />
                  </a>
                  <button
                    type="button"
                    onClick={handleDemoMode}
                    disabled={demoLoading}
                    className="psbox-btn psbox-btn-primary text-sm"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    {demoLoading ? 'Launching...' : 'Enter Demo Mode'}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm sm:text-base text-[#bebebe] mb-2">
                  {t(lang, 'signInStep2')}
                </div>
                <div className="inline-flex items-center gap-2 bg-[#242424] rounded-2xl px-6 py-4 opacity-75">
                  {'••••••••'.split('').map((ch, idx) => (
                    <span
                      key={idx}
                      className="w-8 sm:w-10 text-center text-3xl sm:text-4xl font-bold text-[#8c8c8c] font-mono"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>

              {/* Microsoft Account Relay Box */}
              <div className="bg-[#242424]/90 border border-white/10 rounded-2xl p-4 space-y-3 max-w-xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white">
                    <Link2 className="w-4 h-4 text-[#107c10] shrink-0" />
                    Connect Relay for Live Microsoft Code on GitHub Pages
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRelayHelp((v) => !v)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {showRelayHelp ? 'Hide Worker Code' : 'Get Free Worker Code'}
                    {showRelayHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showRelayHelp && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-[#bebebe] leading-relaxed">
                      Deploy <code>cloudflare-worker/worker.js</code> for free at <code>dash.cloudflare.com</code> and
                      paste its URL below (or set GitHub variable <code>PSBOX_RELAY_URL</code>):
                    </p>
                    <div className="relative">
                      <pre className="bg-[#0e0e0e] border border-white/10 rounded-xl p-3 text-[10px] text-emerald-200 overflow-x-auto max-h-32">
                        {WORKER_SNIPPET}
                      </pre>
                      <button
                        type="button"
                        onClick={handleCopyWorker}
                        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-[#242424] border border-white/15 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedWorker ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedWorker ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSaveRelay} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={relayInput}
                    onChange={(e) => setRelayInput(e.target.value)}
                    placeholder="https://psbox-relay.your-name.workers.dev"
                    className="flex-1 bg-[#0e0e0e] border border-white/15 focus:border-[#107c10] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  />
                  <button type="submit" className="psbox-btn psbox-btn-primary text-xs shrink-0">
                    Connect &amp; Get Code
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-100 text-sm space-y-2 max-w-xl">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-200">
                    {networkBlocked ? 'Microsoft Sign-In Unreachable from This Host' : 'Sign-In Issue'}
                  </div>
                  <p className="text-xs text-amber-100/85 mt-1 break-words">{error}</p>
                </div>
              </div>
              <button type="button" onClick={requestNewCode} className="psbox-btn text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Microsoft Sign-In
              </button>
            </div>
          )}

          {/* Region bypass & Demo Mode */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 max-w-xl">
            <div className="flex items-center gap-2 text-xs text-[#bebebe]">
              <Globe className="w-4 h-4 text-[#107c10] shrink-0" />
              <label htmlFor="country-bypass" className="shrink-0">
                Country Bypass:
              </label>
              <select
                id="country-bypass"
                value={loginCountry}
                onChange={(e) => onChangeCountry(e.target.value)}
                className="bg-[#242424] border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none"
              >
                {BYPASS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {!needsRelay && (
              <button
                type="button"
                onClick={handleDemoMode}
                disabled={demoLoading}
                className="psbox-btn text-xs"
              >
                <Play className="w-3.5 h-3.5" />
                {demoLoading ? 'Starting...' : 'Demo Mode'}
              </button>
            )}
          </div>
        </div>

        {/* Right: White QR Box matching PSBox */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4">
          {(dc?.qrDataUrl || defaultQr) ? (
            <div className="flex flex-col items-center">
              <div className="bg-white rounded-3xl p-5 shadow-2xl max-w-[290px] w-full">
                <img
                  src={dc?.qrDataUrl || defaultQr}
                  alt="Microsoft Link QR Code"
                  className="w-full h-auto rounded-xl"
                />
              </div>
              <p className="text-sm font-medium text-[#bebebe] mt-4 text-center">
                {t(lang, 'signInScan')}
              </p>
            </div>
          ) : (
            <div className="bg-[#242424] border border-white/10 rounded-3xl p-6 text-center w-full max-w-[320px]">
              <img src="./assets/icons/guitar.svg" alt="PSBox Icon" className="w-16 h-12 mx-auto mb-3 opacity-95" />
              <h3 className="text-base font-bold text-white mb-1">PSBox Cloud Gaming</h3>
              <p className="text-xs text-[#bebebe]">Xbox Cloud Gaming &amp; Remote Play in your browser.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 w-full max-w-[300px] text-xs">
            <div className="bg-[#242424]/90 border border-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Gamepad2 className="w-3.5 h-3.5 text-[#107c10]" />
                DualSense
              </div>
              <div className="text-[#8c8c8c] mt-0.5">USB / BT + Touch</div>
            </div>
            <div className="bg-[#242424]/90 border border-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Sparkles className="w-3.5 h-3.5 text-[#107c10]" />
                1440p60
              </div>
              <div className="text-[#8c8c8c] mt-0.5">WebRTC Stream</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
