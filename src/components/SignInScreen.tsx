import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Link2, Play, RefreshCw, ShieldAlert } from 'lucide-react';
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
  { code: '', label: 'None (Use my real IP region)' },
  { code: 'us', label: 'United States (US)' },
  { code: 'br', label: 'Brazil (BR)' },
  { code: 'jp', label: 'Japan (JP)' },
  { code: 'kr', label: 'South Korea (KR)' },
  { code: 'pl', label: 'Poland (PL)' },
];

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
  const [copied, setCopied] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const pollTimer = useRef<number | null>(null);

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
    <div
      className="min-h-screen w-full relative flex items-center justify-center px-6 py-10 overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(120deg, rgba(8,12,10,0.92) 0%, rgba(10,16,12,0.82) 55%, rgba(8,14,10,0.88) 100%), url('./assets/pic1.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left: Microsoft Account Device-Code Sign-In */}
        <div className="lg:col-span-7 bg-[#12161b]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-7 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3.5 mb-6">
            <BrandMark size={44} />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{t(lang, 'appName')}</h1>
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                GitHub Pages Web Client • Official PSBox Assets
              </p>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
            {t(lang, 'signInTitle')}
          </h2>
          <p className="text-sm text-[#b4bcc8] mb-6 leading-relaxed">
            Sign in with your real Microsoft / Xbox account using Microsoft’s official device-code flow.
            Your credentials go directly to <span className="text-white font-medium">microsoft.com/link</span> —
            no password is ever entered on this page.
          </p>

          {loadingCode ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 bg-white/5 rounded-2xl border border-white/10">
              <RefreshCw className="w-8 h-8 text-emerald-400 psbox-spinner" />
              <span className="text-sm text-[#b4bcc8]">Requesting sign-in code from Microsoft...</span>
            </div>
          ) : dc ? (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#9aa4b8] mb-2">
                  {t(lang, 'signInStep1')}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={dc.verificationUri || 'https://www.microsoft.com/link'}
                    target="_blank"
                    rel="noreferrer"
                    className="psbox-btn psbox-btn-primary text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t(lang, 'openLink')} ({cleanUri})
                  </a>
                  <button type="button" onClick={requestNewCode} className="psbox-btn text-xs">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t(lang, 'newCode')}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#9aa4b8] mb-2">
                  {t(lang, 'signInStep2')}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-[#0b0e14] border border-white/15 rounded-2xl px-4 py-3">
                    {dc.userCode.split('').map((ch, idx) => (
                      <span
                        key={idx}
                        className="w-9 h-12 flex items-center justify-center rounded-lg bg-[#1b212c] border border-white/10 text-2xl font-bold tracking-wider text-white font-mono"
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

              <div className="flex items-center gap-3 pt-1 text-sm text-[#b4bcc8]">
                <RefreshCw className="w-4 h-4 text-emerald-400 psbox-spinner shrink-0" />
                <span>{t(lang, 'signInWaiting')}</span>
              </div>
            </div>
          ) : needsRelay ? (
            <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Link2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <div className="font-semibold text-white text-sm">
                    Connect a CORS Relay for Live Microsoft Sign-In on GitHub Pages
                  </div>
                  <p className="text-xs text-[#b4bcc8] leading-relaxed">
                    Microsoft’s <code>login.live.com</code> and <code>xboxlive.com</code> APIs block direct
                    cross-origin browser requests from static GitHub Pages. Deploy the included free{' '}
                    <code>cloudflare-worker/worker.js</code> (takes ~1 minute) and paste its{' '}
                    <code>*.workers.dev</code> URL below, or launch Demo Mode right away.
                  </p>
                </div>
              </div>
              <form onSubmit={handleSaveRelay} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={relayInput}
                  onChange={(e) => setRelayInput(e.target.value)}
                  placeholder="https://psbox-relay.your-name.workers.dev"
                  className="flex-1 bg-[#0b0e14] border border-white/15 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
                <button type="submit" className="psbox-btn psbox-btn-primary text-xs shrink-0">
                  Connect Microsoft Sign-In
                </button>
              </form>
            </div>
          ) : null}

          {error && (
            <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-100 text-sm space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-200">
                    {networkBlocked ? 'Microsoft Sign-In Unreachable from This Host' : 'Sign-In Issue'}
                  </div>
                  <p className="text-xs text-amber-100/85 mt-1 break-words">{error}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={requestNewCode} className="psbox-btn text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Microsoft Sign-In
                </button>
              </div>
            </div>
          )}

          {/* Region bypass & Demo Mode */}
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[#9aa4b8]">
              <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
              <label htmlFor="country-bypass" className="shrink-0">
                Country:
              </label>
              <select
                id="country-bypass"
                value={loginCountry}
                onChange={(e) => onChangeCountry(e.target.value)}
                className="bg-[#1b212c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none"
              >
                {BYPASS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleDemoMode}
              disabled={demoLoading}
              className="psbox-btn psbox-btn-primary text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              {demoLoading ? 'Starting Demo...' : 'Launch Browser Demo Mode'}
            </button>
          </div>
        </div>

        {/* Right: QR Card + Feature highlights */}
        <div className="lg:col-span-5 flex flex-col items-center gap-5">
          {dc?.qrDataUrl ? (
            <div className="bg-white rounded-3xl p-5 shadow-2xl text-center max-w-[290px] w-full">
              <img src={dc.qrDataUrl} alt="Microsoft Link QR Code" className="w-full h-auto rounded-xl" />
              <p className="text-xs font-semibold text-slate-700 mt-3 leading-snug">
                {t(lang, 'signInScan')}
              </p>
            </div>
          ) : (
            <div className="bg-[#12161b]/85 border border-white/10 rounded-3xl p-7 text-center max-w-[320px] w-full">
              <img
                src="./assets/icons/guitar.svg"
                alt="PSBox Icon"
                className="w-16 h-12 mx-auto mb-4 opacity-90"
              />
              <h3 className="text-lg font-bold text-white mb-2">Play Xbox Cloud in Your Browser</h3>
              <p className="text-xs text-[#9aa4b8] leading-relaxed">
                Supports DualSense, DualShock 4, Xbox controllers, vibration rumble, keyboard &amp; mouse,
                1080p HQ / 1440p streaming, and Xbox Remote Play.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 w-full max-w-[320px] text-xs">
            <div className="bg-[#12161b]/85 border border-white/10 rounded-2xl p-3.5">
              <div className="font-bold text-white">DualSense Ready</div>
              <div className="text-[#9aa4b8] mt-0.5">Browser Gamepad API + Rumble</div>
            </div>
            <div className="bg-[#12161b]/85 border border-white/10 rounded-2xl p-3.5">
              <div className="font-bold text-white">Up to 1440p60</div>
              <div className="text-[#9aa4b8] mt-0.5">WebRTC + Sharpness Filter</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
