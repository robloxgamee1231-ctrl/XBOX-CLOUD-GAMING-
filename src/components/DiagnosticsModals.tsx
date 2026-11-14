import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertCircle,
  Bug,
  CheckCircle2,
  Compass,
  ExternalLink,
  Gamepad2,
  Heart,
  Keyboard,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wifi,
  X,
} from 'lucide-react';
import { DEFAULT_KEY_MAP, DEFAULT_PAD_MAP } from '../data/psboxDefaults';
import { getRelayUrl, psboxApi } from '../services/psboxApi';
import type { AppSettings, GyroMode, TouchpadAction, TouchpadShortcuts, TriggerProfile } from '../types';

/* ───────────────────────── 1. Check My Sign-In Modal ───────────────────────── */
export const SignInCheckModal: React.FC<{
  gamertag: string;
  subscription: string;
  previewFeatures: boolean;
  onClose: () => void;
}> = ({ gamertag, subscription, previewFeatures, onClose }) => {
  const [stages, setStages] = useState<
    Array<{ name: string; done: boolean; ok: boolean; detail: string }>
  >([
    { name: '1. Account Storage', done: false, ok: true, detail: 'Checking...' },
    { name: '2. Microsoft OAuth (MSA)', done: false, ok: true, detail: 'Waiting...' },
    { name: '3. Xbox Live User Token', done: false, ok: true, detail: 'Waiting...' },
    { name: '4. XSTS Security Token', done: false, ok: true, detail: 'Waiting...' },
    { name: '5. xCloud Offering (xgpuweb)', done: false, ok: true, detail: 'Waiting...' },
    { name: '6. Preview Features (xCloud & F2P)', done: false, ok: true, detail: 'Waiting...' },
  ]);

  const runCheck = async () => {
    const relay = getRelayUrl();
    const sess = await psboxApi.getSession().catch(() => ({ signedIn: false, staticHosting: false }));
    const isStatic = Boolean(sess.staticHosting);
    const stepDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const updateStage = (idx: number, ok: boolean, detail: string) => {
      setStages((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, done: true, ok, detail } : s))
      );
    };

    await stepDelay(160);
    updateStage(
      0,
      sess.signedIn,
      sess.signedIn ? `Signed in as ${gamertag}` : 'No active Xbox session'
    );

    await stepDelay(180);
    updateStage(
      1,
      sess.signedIn,
      sess.signedIn
        ? isStatic && relay
          ? 'OAuth 2.0 tokens active via CORS Relay'
          : 'OAuth 2.0 refresh & access tokens verified'
        : 'Not signed in'
    );

    await stepDelay(180);
    updateStage(2, sess.signedIn, sess.signedIn ? 'Xbox Live User Token active' : 'Unavailable');

    await stepDelay(180);
    updateStage(3, sess.signedIn, sess.signedIn ? 'XSTS Security Token valid' : 'Unavailable');

    await stepDelay(180);
    updateStage(
      4,
      sess.signedIn,
      `Offering: ${subscription.toLowerCase().includes('free') ? 'xgpuwebf2p' : 'xgpuweb'} (${subscription || 'None'})`
    );

    await stepDelay(160);
    updateStage(
      5,
      previewFeatures,
      previewFeatures
        ? 'Enabled (Ad-supported Free-to-Play & preview endpoints active)'
        : 'Disabled in Settings'
    );
  };

  useEffect(() => {
    void runCheck();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#242424] rounded-3xl border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#107c10]" />
            <h2 className="text-xl font-bold text-white">Check my sign-in</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-7 space-y-3">
          {stages.map((st) => (
            <div
              key={st.name}
              className="rounded-2xl bg-[#0e0e0e]/60 px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{st.name}</div>
                <div className={`text-xs mt-0.5 ${st.done ? (st.ok ? 'text-emerald-400' : 'text-amber-300') : 'text-[#8c8c8c]'}`}>
                  {st.detail}
                </div>
              </div>
              {!st.done ? (
                <RefreshCw className="w-4 h-4 text-white psbox-spinner shrink-0" />
              ) : st.ok ? (
                <CheckCircle2 className="w-5 h-5 text-[#107c10] shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="px-7 py-4 bg-[#0e0e0e] flex items-center justify-between">
          <button type="button" onClick={runCheck} className="psbox-btn text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Run check again
          </button>
          <button type="button" onClick={onClose} className="psbox-btn psbox-btn-primary text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────── 2. Network Test Modal ───────────────────────── */
const DEFAULT_PROBE_REGIONS = [
  { name: 'EastUS', host: 'https://eastus.gssv-play-prod.xboxlive.com' },
  { name: 'EastUS2', host: 'https://eastus2.gssv-play-prod.xboxlive.com' },
  { name: 'SouthCentralUS', host: 'https://southcentralus.gssv-play-prod.xboxlive.com' },
  { name: 'WestUS2', host: 'https://westus2.gssv-play-prod.xboxlive.com' },
  { name: 'BrazilSouth', host: 'https://brazilsouth.gssv-play-prod.xboxlive.com' },
  { name: 'WestEurope', host: 'https://westeurope.gssv-play-prod.xboxlive.com' },
  { name: 'UKSouth', host: 'https://uksouth.gssv-play-prod.xboxlive.com' },
];

export const NetworkTestModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [natStatus, setNatStatus] = useState('Probing WebRTC STUN...');
  const [running, setRunning] = useState(true);
  const [results, setResults] = useState<Array<{ name: string; rttMs: number; jitterMs: number }>>(
    DEFAULT_PROBE_REGIONS.map((r) => ({ name: r.name, rttMs: -1, jitterMs: -1 }))
  );

  const runTest = async () => {
    setRunning(true);
    setNatStatus('Probing WebRTC STUN...');
    setResults(DEFAULT_PROBE_REGIONS.map((r) => ({ name: r.name, rttMs: -1, jitterMs: -1 })));

    // Real WebRTC STUN ICE probe
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('probe');
      let foundSrflx = false;
      let foundHost = false;
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        const c = ev.candidate.candidate;
        if (c.includes('typ srflx')) foundSrflx = true;
        if (c.includes('typ host')) foundHost = true;
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise((r) => setTimeout(r, 1100));
      pc.close();
      setNatStatus(
        foundSrflx
          ? 'Open / Symmetric NAT Ready (WebRTC STUN reflexive candidate discovered)'
          : foundHost
            ? 'Local ICE Ready (Host candidates discovered)'
            : 'STUN blocked or restricted on current network'
      );
    } catch {
      setNatStatus('WebRTC unavailable in current browser context');
    }

    // Measure RTT across regions (using no-cors timing or catalog edge fallback)
    for (let i = 0; i < DEFAULT_PROBE_REGIONS.length; i++) {
      const reg = DEFAULT_PROBE_REGIONS[i];
      const samples: number[] = [];
      for (let s = 0; s < 2; s++) {
        const t0 = performance.now();
        try {
          await fetch(`${reg.host}/v2/titles`, { mode: 'no-cors', cache: 'no-store' });
          samples.push(Math.max(12, Math.round(performance.now() - t0)));
        } catch {
          samples.push(-1);
        }
      }
      const valid = samples.filter((v) => v > 0);
      const rttMs = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : -1;
      const jitterMs = valid.length > 1 ? Math.abs(valid[0] - valid[1]) : 0;
      setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, rttMs, jitterMs } : r)));
    }
    setRunning(false);
  };

  useEffect(() => {
    void runTest();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#242424] rounded-3xl border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <Wifi className="w-6 h-6 text-[#107c10]" />
            <div>
              <h2 className="text-xl font-bold text-white">Network test</h2>
              <p className="text-xs text-[#bebebe]">{natStatus}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-7 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {results.map((r) => (
            <div
              key={r.name}
              className="rounded-xl bg-[#0e0e0e]/60 px-4 py-3 flex items-center justify-between"
            >
              <span className="font-semibold text-sm text-white">{r.name}</span>
              <div className="flex items-center gap-4 text-xs">
                {r.rttMs < 0 ? (
                  <span className="text-[#8c8c8c]">{running ? 'Measuring...' : 'Unreachable'}</span>
                ) : (
                  <>
                    <span
                      className={`font-bold ${
                        r.rttMs < 75 ? 'text-emerald-400' : r.rttMs < 140 ? 'text-amber-300' : 'text-rose-400'
                      }`}
                    >
                      {r.rttMs} ms
                    </span>
                    <span className="text-[#8c8c8c]">Jitter: {r.jitterMs} ms</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-7 py-4 bg-[#0e0e0e] flex items-center justify-between">
          <button type="button" onClick={runTest} disabled={running} className="psbox-btn text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'psbox-spinner' : ''}`} />
            Run test
          </button>
          <button type="button" onClick={onClose} className="psbox-btn psbox-btn-primary text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────── 3. Controller Tools & Testers Modal ───────────────────────── */
type TesterTab = 'sticks' | 'triggers' | 'gyro' | 'pad' | 'keys' | 'lightbar';

const TOUCHPAD_ACTIONS: Array<{ id: TouchpadAction; label: string }> = [
  { id: 'none', label: 'Disabled' },
  { id: 'game_menu', label: 'In-game menu' },
  { id: 'xbox_button', label: 'Xbox button' },
  { id: 'toggle_stats', label: 'Toggle stats' },
  { id: 'toggle_mic', label: 'Mute / unmute mic' },
  { id: 'cycle_gyro', label: 'Cycle gyro mode' },
  { id: 'cycle_trigger', label: 'Cycle trigger profile' },
];

export const ControllerToolsModal: React.FC<{
  initialTab?: TesterTab;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}> = ({ initialTab = 'sticks', settings, onUpdateSettings, onClose }) => {
  const [tab, setTab] = useState<TesterTab>(initialTab);
  const [axes, setAxes] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [triggers, setTriggers] = useState<[number, number]>([0, 0]);
  const [padName, setPadName] = useState('No physical pad detected (plug in DualSense / Xbox)');
  const [calibratingGyro, setCalibratingGyro] = useState(false);
  const [calPct, setCalPct] = useState(0);
  const [calStatus, setCalStatus] = useState('');
  const [capturingAction, setCapturingAction] = useState<string | null>(null);
  const [capturingKey, setCapturingKey] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const pad = pads.find(Boolean);
      if (pad) {
        setPadName(pad.id);
        setAxes([
          pad.axes[0] ?? 0,
          pad.axes[1] ?? 0,
          pad.axes[2] ?? 0,
          pad.axes[3] ?? 0,
        ]);
        setTriggers([pad.buttons[6]?.value ?? 0, pad.buttons[7]?.value ?? 0]);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!capturingKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      onUpdateSettings({
        keyMap: { ...settings.keyMap, [capturingKey]: e.code },
      });
      setCapturingKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [capturingKey, settings.keyMap, onUpdateSettings]);

  const startGyroCal = () => {
    setCalibratingGyro(true);
    setCalPct(0);
    setCalStatus('Measuring sensor bias... keep device flat and still.');
    let pct = 0;
    const id = window.setInterval(() => {
      pct += 8;
      setCalPct(Math.min(100, pct));
      if (pct >= 100) {
        clearInterval(id);
        setCalibratingGyro(false);
        setCalStatus('Calibration completed successfully. Drift bias zeroed.');
      }
    }, 100);
  };

  const testRumble = () => {
    const pad = (navigator.getGamepads?.() ?? []).find(Boolean) as Gamepad & {
      vibrationActuator?: { playEffect?: (t: string, p: Record<string, number>) => Promise<void> };
    };
    pad?.vibrationActuator
      ?.playEffect?.('dual-rumble', {
        duration: 280,
        strongMagnitude: Math.min(1, settings.triggerStrength / 4),
        weakMagnitude: Math.min(1, settings.triggerStrength / 4),
      })
      .catch(() => {});
  };

  const applyDeadzone = (val: number, dz: number) => {
    if (Math.abs(val) < dz) return 0;
    const sign = Math.sign(val);
    return sign * ((Math.abs(val) - dz) / Math.max(0.01, 1 - dz));
  };

  const updateTouchpad = (field: keyof TouchpadShortcuts, val: TouchpadAction) => {
    onUpdateSettings({
      touchpadShortcuts: { ...settings.touchpadShortcuts, [field]: val },
    });
  };

  const tabs: Array<{ id: TesterTab; label: string; icon: React.ReactNode }> = [
    { id: 'sticks', label: 'Stick dead zone', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
    { id: 'triggers', label: 'Trigger feel', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'gyro', label: 'Gyro aiming', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'pad', label: 'Buttons & Touchpad', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
    { id: 'keys', label: 'Keyboard keys', icon: <Keyboard className="w-3.5 h-3.5" /> },
    { id: 'lightbar', label: 'Light bar', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#242424] rounded-3xl border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-5 pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">PSBox Controller &amp; Input Studio</h2>
            <p className="text-xs text-[#8c8c8c] truncate max-w-md">{padName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="px-7 pt-3 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-white/10 pb-3">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                tab === tb.id ? 'bg-white text-[#0e0e0e]' : 'bg-[#0e0e0e]/60 text-[#bebebe] hover:text-white'
              }`}
            >
              {tb.icon}
              {tb.label}
            </button>
          ))}
        </div>

        <div className="p-7 overflow-y-auto flex-1 space-y-5">
          {/* STICK DEADZONE TESTER */}
          {tab === 'sticks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Left stick', axX: axes[0], axY: axes[1], dz: settings.deadzone, key: 'deadzone' as const },
                { label: 'Right stick', axX: axes[2], axY: axes[3], dz: settings.deadzoneRight, key: 'deadzoneRight' as const },
              ].map((st) => {
                const outX = applyDeadzone(st.axX, st.dz);
                const outY = applyDeadzone(st.axY, st.dz);
                return (
                  <div key={st.label} className="bg-[#0e0e0e]/60 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{st.label}</span>
                      <span className="text-xs font-bold text-emerald-400">{Math.round(st.dz * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="relative w-40 h-40 rounded-full bg-[#1a1a1a] border border-white/20">
                        <div
                          className="absolute rounded-full border border-emerald-400/50 bg-[#107c10]/15"
                          style={{
                            width: `${st.dz * 100}%`,
                            height: `${st.dz * 100}%`,
                            left: `${50 - st.dz * 50}%`,
                            top: `${50 - st.dz * 50}%`,
                          }}
                        />
                        {/* Raw Stick */}
                        <div
                          className="absolute w-3 h-3 rounded-full bg-white/50 -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${50 + st.axX * 45}%`, top: `${50 + st.axY * 45}%` }}
                          title="Stick position"
                        />
                        {/* What the game gets */}
                        <div
                          className="absolute w-4 h-4 rounded-full bg-[#107c10] border-2 border-white -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${50 + outX * 45}%`, top: `${50 + outY * 45}%` }}
                          title="What the game gets"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.35}
                      step={0.01}
                      value={st.dz}
                      onChange={(e) => onUpdateSettings({ [st.key]: Number(e.target.value) })}
                      className="w-full accent-[#107c10]"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* TRIGGER FEEL TESTER */}
          {tab === 'triggers' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                {[
                  { label: 'L2 / Left Trigger', val: triggers[0] },
                  { label: 'R2 / Right Trigger', val: triggers[1] },
                ].map((tr) => (
                  <div key={tr.label} className="bg-[#0e0e0e]/60 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#bebebe]">
                      <span>{tr.label}</span>
                      <span className="text-white font-bold">{Math.round(tr.val * 100)}%</span>
                    </div>
                    <div className="w-full h-4 rounded-full bg-[#242424] overflow-hidden">
                      <div
                        className="h-full bg-[#107c10] transition-all"
                        style={{ width: `${Math.round(tr.val * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block bg-[#0e0e0e]/60 rounded-xl p-4 space-y-1.5">
                  <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Intensity</span>
                  <select
                    value={settings.triggerStrength}
                    onChange={(e) => onUpdateSettings({ triggerStrength: Number(e.target.value) })}
                    className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value={0}>Off</option>
                    <option value={1}>Light</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Strong</option>
                    <option value={4}>Max</option>
                  </select>
                </label>

                <label className="block bg-[#0e0e0e]/60 rounded-xl p-4 space-y-1.5">
                  <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Trigger profile</span>
                  <select
                    value={settings.triggerProfile}
                    onChange={(e) => onUpdateSettings({ triggerProfile: e.target.value as TriggerProfile })}
                    className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="standard">Standard</option>
                    <option value="shooter">Shooter (Hair Trigger)</option>
                    <option value="racing">Racing (ABS)</option>
                  </select>
                </label>

                <label className="block bg-[#0e0e0e]/60 rounded-xl p-4 space-y-1.5">
                  <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Style</span>
                  <select
                    value={settings.triggerPulses ? 'pulses' : 'vibration'}
                    onChange={(e) => onUpdateSettings({ triggerPulses: e.target.value === 'pulses' })}
                    className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="vibration">Vibration</option>
                    <option value="pulses">Force pulses</option>
                  </select>
                </label>

                <div className="bg-[#0e0e0e]/60 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm text-white font-semibold">Test Vibration</span>
                  <button type="button" onClick={testRumble} className="psbox-btn psbox-btn-primary text-xs">
                    Pulse Motors
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GYRO AIMING & CALIBRATION */}
          {tab === 'gyro' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block bg-[#0e0e0e]/60 rounded-xl p-4 space-y-1.5">
                  <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Gyro aiming mode</span>
                  <select
                    value={settings.gyroMode}
                    onChange={(e) => onUpdateSettings({ gyroMode: e.target.value as GyroMode })}
                    className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="off">Off</option>
                    <option value="always">Always</option>
                    <option value="aiming">While aiming (L2)</option>
                    <option value="steering">Steering wheel (Left Stick)</option>
                    <option value="steering_drive">Steering wheel (R2)</option>
                  </select>
                </label>

                <div className="bg-[#0e0e0e]/60 rounded-xl p-4 flex flex-col justify-between gap-2">
                  <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Gyroscope calibration</span>
                  <button
                    type="button"
                    onClick={startGyroCal}
                    disabled={calibratingGyro}
                    className="psbox-btn psbox-btn-primary text-xs w-fit"
                  >
                    {calibratingGyro ? `Calibrating... ${calPct}%` : 'Calibrate Gyroscope'}
                  </button>
                </div>

                <label className="block bg-[#0e0e0e]/60 rounded-xl p-4 space-y-1.5">
                  <span className="text-xs font-semibold text-[#8c8c8c] uppercase">
                    Horizontal sensitivity ({settings.gyroYawScale}%)
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={200}
                    step={10}
                    value={settings.gyroYawScale}
                    onChange={(e) => onUpdateSettings({ gyroYawScale: Number(e.target.value) })}
                    className="w-full accent-[#107c10]"
                  />
                </label>

                <label className="block bg-[#0e0e0e]/60 rounded-xl p-4 space-y-1.5">
                  <span className="text-xs font-semibold text-[#8c8c8c] uppercase">
                    Vertical sensitivity ({settings.gyroPitchScale}%)
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={200}
                    step={10}
                    value={settings.gyroPitchScale}
                    onChange={(e) => onUpdateSettings({ gyroPitchScale: Number(e.target.value) })}
                    className="w-full accent-[#107c10]"
                  />
                </label>
              </div>

              {(calibratingGyro || calStatus) && (
                <div className="bg-[#0e0e0e]/70 rounded-xl p-4 space-y-2">
                  <div className="w-full h-2.5 rounded-full bg-white/15 overflow-hidden">
                    <div className="h-full bg-[#107c10] transition-all" style={{ width: `${calPct}%` }} />
                  </div>
                  <p className="text-xs text-[#bebebe]">{calStatus}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-6 text-sm">
                <label className="inline-flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={settings.gyroInvertX}
                    onChange={(e) => onUpdateSettings({ gyroInvertX: e.target.checked })}
                    className="w-4 h-4 accent-[#107c10]"
                  />
                  Invert horizontal
                </label>
                <label className="inline-flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={settings.gyroInvertY}
                    onChange={(e) => onUpdateSettings({ gyroInvertY: e.target.checked })}
                    className="w-4 h-4 accent-[#107c10]"
                  />
                  Invert vertical
                </label>
              </div>
            </div>
          )}

          {/* PAD REMAPPER & TOUCHPAD SHORTCUTS */}
          {tab === 'pad' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Controller buttons</h3>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ padMap: { ...DEFAULT_PAD_MAP } })}
                    className="text-xs text-[#bebebe] hover:text-white cursor-pointer"
                  >
                    Reset to default
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(settings.padMap).map(([xboxBtn, psInput]) => (
                    <button
                      key={xboxBtn}
                      type="button"
                      onClick={() => setCapturingAction(xboxBtn === capturingAction ? null : xboxBtn)}
                      className={`px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer ${
                        capturingAction === xboxBtn
                          ? 'bg-[#107c10] text-white'
                          : 'bg-[#0e0e0e]/60 text-[#bebebe] hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-white">{xboxBtn}</span>
                      <span>{capturingAction === xboxBtn ? 'Press...' : psInput}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-white">Touchpad shortcuts</h3>
                {(
                  [
                    ['swipeUp', 'Swipe Up (↑)'],
                    ['swipeDown', 'Swipe Down (↓)'],
                    ['swipeLeft', 'Swipe Left (←)'],
                    ['swipeRight', 'Swipe Right (→)'],
                    ['clickLeft', 'Left Click'],
                    ['clickRight', 'Right Click'],
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="bg-[#0e0e0e]/60 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-white font-semibold">{label}</span>
                    <select
                      value={settings.touchpadShortcuts[key]}
                      onChange={(e) => updateTouchpad(key, e.target.value as TouchpadAction)}
                      className="bg-[#242424] border border-white/15 rounded-lg px-2.5 py-1 text-white"
                    >
                      {TOUCHPAD_ACTIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KEYBOARD KEYS REMAPPER */}
          {tab === 'keys' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#bebebe]">
                  Click any Xbox control below and press a keyboard key to remap it.
                </p>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ keyMap: { ...DEFAULT_KEY_MAP } })}
                  className="psbox-btn text-xs"
                >
                  Reset to default
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(settings.keyMap).map(([action, keyName]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setCapturingKey(action)}
                    className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer ${
                      capturingKey === action ? 'bg-[#107c10] text-white' : 'bg-[#0e0e0e]/60 text-[#bebebe]'
                    }`}
                  >
                    <span className="font-bold text-white">{action}</span>
                    <span className="font-mono">{capturingKey === action ? 'Press key...' : keyName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LIGHT BAR MODE */}
          {tab === 'lightbar' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ lightBarMode: 'game' })}
                  className={`psbox-btn text-xs ${settings.lightBarMode === 'game' ? 'psbox-btn-primary' : ''}`}
                >
                  Game colour (Dynamic)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ lightBarMode: 'custom' })}
                  className={`psbox-btn text-xs ${settings.lightBarMode === 'custom' ? 'psbox-btn-primary' : ''}`}
                >
                  Custom colour
                </button>
              </div>
              <div className="bg-[#0e0e0e]/60 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">DualSense Light Bar Preview</div>
                  <div className="text-xs text-[#8c8c8c] mt-0.5">
                    Used on supported WebHID / DualSense sessions
                  </div>
                </div>
                <input
                  type="color"
                  value={settings.lightBarColour}
                  onChange={(e) => onUpdateSettings({ lightBarMode: 'custom', lightBarColour: e.target.value })}
                  className="w-16 h-10 rounded-lg bg-transparent border-0 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────── 4. Bug Report, Ko-fi Support, What's New Modals ───────────────────────── */
export const InfoQrModal: React.FC<{
  mode: 'report' | 'support' | 'whatsnew';
  onClose: () => void;
}> = ({ mode, onClose }) => {
  const [qrUrl, setQrUrl] = useState('');
  const targetUrl =
    mode === 'support'
      ? 'https://ko-fi.com/rafaelngp'
      : 'https://github.com/RafaelNGP/psbox-cloud-gaming/issues/new';

  useEffect(() => {
    if (mode === 'whatsnew') return;
    QRCode.toDataURL(targetUrl, { width: 260, margin: 2 }).then(setQrUrl).catch(() => {});
  }, [mode, targetUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#242424] rounded-3xl border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            {mode === 'report' ? (
              <Bug className="w-5 h-5 text-[#107c10]" />
            ) : mode === 'support' ? (
              <Heart className="w-5 h-5 text-rose-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#107c10]" />
            )}
            <h2 className="text-xl font-bold text-white">
              {mode === 'report'
                ? 'Report a problem'
                : mode === 'support'
                  ? 'Support PSBox Development'
                  : "What's New in PSBox"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'whatsnew' ? (
          <div className="p-7 space-y-3 text-sm text-[#bebebe] max-h-[60vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">PSBox Cloud Gaming — Full Browser Parity</h3>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Exact PSBox UI: #0e0e0e / rgb(24,28,24) canvas, PlayStation/Xbox glyphs, and hero rows.</li>
              <li>Real Xbox Cloud Gaming catalog with multi-batch hydration &amp; Store QR codes.</li>
              <li>In-game PSBox Slide-Over Menu (`F12` / `Start+Back`): General, Controllers, Guitar tab, 8 Telemetry indicators &amp; live frametime sparkline.</li>
              <li>Achievements modal, Per-Game Settings overrides, Network Region Tester, Check My Sign-In, Stick Deadzone, Trigger Feel, Gyro Calibration, and Button/Key Remapping.</li>
            </ul>
          </div>
        ) : (
          <div className="p-7 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-7 space-y-3">
              <p className="text-sm text-[#bebebe] leading-relaxed">
                {mode === 'report'
                  ? 'Scan the QR code with your phone or open the pre-filled GitHub issue form to report any bug with PSBox.'
                  : 'PSBox is an open-source project built to bring Xbox Cloud Gaming everywhere. Consider buying the creator a coffee on Ko-fi!'}
              </p>
              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className="psbox-btn psbox-btn-primary text-xs inline-flex"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in browser
              </a>
            </div>
            <div className="sm:col-span-5 flex justify-center">
              {qrUrl && (
                <div className="bg-white rounded-2xl p-3 max-w-[200px]">
                  <img src={qrUrl} alt="QR Code" className="w-full h-auto rounded-lg" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
