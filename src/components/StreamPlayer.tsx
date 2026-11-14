import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Gamepad2,
  Keyboard,
  LogOut,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  MousePointerClick,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { PSBOX_LAUNCH_TIPS } from '../data/psboxDefaults';
import { GamepadButton } from '../stream/inputPacket';
import {
  XCloudWebRtcClient,
  type StreamTelemetry,
  type VirtualKeyboardRequest,
} from '../stream/xcloudWebRtc';
import type {
  AppSettings,
  DebandLevel,
  GyroMode,
  ResolutionMode,
  SharpnessLevel,
  TelemetryMask,
  UpscalerMode,
} from '../types';
import { t } from '../i18n/translations';
import { ButtonGlyph } from './PlayStationGlyphs';

interface StreamPlayerProps {
  title: string;
  heroUrl?: string;
  targetId: string;
  isHome: boolean;
  regionName: string;
  cloudTimeRemainingSec?: number;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onExit: (elapsedSec: number) => void;
}

function playQueueReadyChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.35);
    });
  } catch {
    // ignore audio autoplay restrictions
  }
}

const VK_MAP: Record<string, { bit?: number; vk: number }> = {
  ArrowUp: { bit: GamepadButton.DPadUp, vk: 0x26 },
  ArrowDown: { bit: GamepadButton.DPadDown, vk: 0x28 },
  ArrowLeft: { bit: GamepadButton.DPadLeft, vk: 0x25 },
  ArrowRight: { bit: GamepadButton.DPadRight, vk: 0x27 },
  Enter: { bit: GamepadButton.A, vk: 0x0d },
  Space: { bit: GamepadButton.A, vk: 0x20 },
  Backspace: { bit: GamepadButton.B, vk: 0x08 },
  KeyE: { bit: GamepadButton.X, vk: 0x45 },
  KeyR: { bit: GamepadButton.Y, vk: 0x52 },
  KeyQ: { bit: GamepadButton.LeftShoulder, vk: 0x51 },
  KeyF: { bit: GamepadButton.RightShoulder, vk: 0x46 },
  KeyM: { bit: GamepadButton.Menu, vk: 0x4d },
  Tab: { bit: GamepadButton.View, vk: 0x09 },
};

const TouchThumbstick: React.FC<{
  label: string;
  onMove: (x: number, y: number) => void;
}> = ({ label, onMove }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activePtr = useRef<number | null>(null);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 14;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / maxR, -dy / maxR);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        activePtr.current = e.pointerId;
        updateFromPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePtr.current === e.pointerId) updateFromPointer(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePtr.current === e.pointerId) {
          activePtr.current = null;
          setKnob({ x: 0, y: 0 });
          onMove(0, 0);
        }
      }}
      onPointerCancel={() => {
        activePtr.current = null;
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }}
      className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-black/55 backdrop-blur-md border-2 border-white/20 flex items-center justify-center touch-none select-none"
    >
      <span className="text-[10px] font-bold text-white/35 uppercase pointer-events-none">{label}</span>
      <div
        className="absolute w-12 h-12 rounded-full bg-white/25 border-2 border-white/70 shadow-lg pointer-events-none transition-transform duration-75"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
};

export const StreamPlayer: React.FC<StreamPlayerProps> = ({
  title,
  heroUrl,
  targetId,
  isHome,
  regionName,
  cloudTimeRemainingSec = -1,
  settings,
  onUpdateSettings,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clientRef = useRef<XCloudWebRtcClient | null>(null);
  const startTimeRef = useRef(Date.now());

  const [statusMsg, setStatusMsg] = useState('Starting Xbox Cloud Gaming session...');
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<'general' | 'controls' | 'guitar'>('general');
  const [statsCustomizing, setStatsCustomizing] = useState(false);
  const [menuHoverDesc, setMenuHoverDesc] = useState(
    'Opens the Xbox Guide menu or sends the Xbox button to the game.'
  );
  const [guitarStrum, setGuitarStrum] = useState(true);
  const [guitarTilt, setGuitarTilt] = useState(true);
  const [guitarLanes, setGuitarLanes] = useState(['A', 'B', 'Y', 'X', 'LB', 'Back']);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * PSBOX_LAUNCH_TIPS.length));
  const [frametimes, setFrametimes] = useState<number[]>(() => Array(30).fill(7));
  const [micMuted, setMicMuted] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [connectedPads, setConnectedPads] = useState<string[]>([]);
  const [showStats, setShowStats] = useState(settings.statsEnabled ?? true);
  const [showVirtualPad, setShowVirtualPad] = useState(() =>
    typeof window !== 'undefined' ? 'ontouchstart' in window || navigator.maxTouchPoints > 0 : false,
  );
  const [mouseCapture, setMouseCapture] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kbReq, setKbReq] = useState<VirtualKeyboardRequest | null>(null);
  const [kbText, setKbText] = useState('');
  const [nexusToast, setNexusToast] = useState(false);

  const [telemetry, setTelemetry] = useState<StreamTelemetry>({
    rttMs: 0,
    bitrateMbps: 0,
    fps: 0,
    packetLossPct: 0,
    width: settings.resolution === '720p' ? 1280 : settings.resolution === '1440p' ? 2560 : 1920,
    height: settings.resolution === '720p' ? 720 : settings.resolution === '1440p' ? 1440 : 1080,
    codec: 'H.264 High',
  });

  // Rotate PSBox tips every 7 seconds while launching
  useEffect(() => {
    if (connected) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % PSBOX_LAUNCH_TIPS.length);
    }, 7000);
    return () => clearInterval(id);
  }, [connected]);

  // Watch connected pads for StreamMenu controller slot strip
  useEffect(() => {
    const syncPads = () => {
      const pads = Array.from(navigator.getGamepads?.() ?? []).filter(Boolean) as Gamepad[];
      setConnectedPads(pads.map((p) => p.id.split('(')[0].trim()));
    };
    syncPads();
    window.addEventListener('gamepadconnected', syncPads);
    window.addEventListener('gamepaddisconnected', syncPads);
    const id = window.setInterval(syncPads, 2000);
    return () => {
      window.removeEventListener('gamepadconnected', syncPads);
      window.removeEventListener('gamepaddisconnected', syncPads);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setConnected(false);
    setStreamError(null);

    const client = new XCloudWebRtcClient({
      onStatus: (msg) => setStatusMsg(msg),
      onMediaStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.volume = Math.max(0, Math.min(1, settings.gameVolume / 100));
          videoRef.current.play().catch(() => {});
        }
        setConnected(true);
        if (settings.queueReadyAlert) playQueueReadyChime();
      },
      onTelemetry: (stats) => {
        setTelemetry(stats);
        const ft = stats.fps > 0 ? Math.max(4, Math.min(40, Math.round(1000 / stats.fps))) : 16;
        setFrametimes((prev) => [...prev.slice(-39), ft]);
      },
      onVirtualKeyboard: (req) => {
        setKbReq(req);
        setKbText(req.defaultText || '');
      },
      onClosed: (reason) => setStreamError(reason),
    });
    client.setDeadzone(settings.deadzone);
    client.setTriggerRumble(settings.triggerRumble);
    clientRef.current = client;

    client
      .connect(targetId, settings.resolution, 'en-US', isHome)
      .catch((err) => setStreamError(err instanceof Error ? err.message : String(err)));

    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [targetId, isHome, reloadNonce]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, settings.gameVolume / 100));
    }
  }, [settings.gameVolume]);

  useEffect(() => {
    clientRef.current?.setDeadzone(settings.deadzone);
    clientRef.current?.setTriggerRumble(settings.triggerRumble);
  }, [settings.deadzone, settings.triggerRumble]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'F12') {
        e.preventDefault();
        setMenuOpen((prev) => !prev);
        return;
      }
      if (e.code === 'Home') {
        e.preventDefault();
        clientRef.current?.pressNexusButton();
        setNexusToast(true);
        setTimeout(() => setNexusToast(false), 1400);
        return;
      }
      if (kbReq) return;

      const mapped = VK_MAP[e.code];
      if (mapped?.bit) clientRef.current?.setKeyboardGamepadBit(mapped.bit, true);
      if (mouseCapture) clientRef.current?.sendRawKey(e.keyCode, true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = VK_MAP[e.code];
      if (mapped?.bit) clientRef.current?.setKeyboardGamepadBit(mapped.bit, false);
      if (mouseCapture) clientRef.current?.sendRawKey(e.keyCode, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [kbReq, mouseCapture]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  const toggleMouseLock = () => {
    if (!mouseCapture) {
      containerRef.current?.requestPointerLock?.();
      setMouseCapture(true);
    } else {
      document.exitPointerLock?.();
      setMouseCapture(false);
    }
  };

  const handleLeave = async () => {
    await clientRef.current?.stop();
    const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    onExit(elapsedSec);
  };

  const sharpClass =
    settings.sharpness === 'low'
      ? 'stream-sharp-low'
      : settings.sharpness === 'medium'
        ? 'stream-sharp-medium'
        : settings.sharpness === 'high'
          ? 'stream-sharp-high'
          : '';

  const bindVirtualBtn = (bit: number) => ({
    onPointerDown: () => {
      navigator.vibrate?.(12);
      clientRef.current?.setVirtualButton(bit, true);
    },
    onPointerUp: () => {
      clientRef.current?.setVirtualButton(bit, false);
    },
    onPointerLeave: () => {
      clientRef.current?.setVirtualButton(bit, false);
    },
  });

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => {
        if (mouseCapture && document.pointerLockElement) {
          clientRef.current?.sendMouseMove(e.movementX, e.movementY, 0, 0, e.buttons);
        }
      }}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-contain ${sharpClass}`}
      />

      {(!connected || streamError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-between p-6 sm:p-12 text-center bg-[#0e0e0e] z-20">
          {/* Hero Backdrop matching PSBox drawLaunching */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-35"
            style={{ backgroundImage: `url('${heroUrl || './assets/pic1.png'}')` }}
          />
          <div className="absolute inset-0 bg-black/60" />

          <div className="relative z-10" />

          <div className="relative z-10 flex flex-col items-center max-w-xl">
            <RefreshCw className="w-12 h-12 text-white psbox-spinner mb-6" />
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mb-3">{title}</h2>
            {streamError ? (
              <div className="max-w-md space-y-4 mt-2">
                <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-xl p-4">
                  {streamError}
                </p>
                <button type="button" onClick={handleLeave} className="psbox-btn psbox-btn-primary">
                  Return to Library
                </button>
              </div>
            ) : (
              <>
                <p className="text-xl font-semibold text-[#bebebe]">Getting your game ready</p>
                <p className="text-base text-[#8c8c8c] mt-2">{statusMsg}</p>
              </>
            )}
          </div>

          <div className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-6">
            {!streamError && (
              <p className="text-sm sm:text-base text-[#8c8c8c] max-w-2xl leading-relaxed">
                {PSBOX_LAUNCH_TIPS[tipIndex]}
              </p>
            )}
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleLeave}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#bebebe] hover:text-white cursor-pointer"
              >
                <ButtonGlyph icon="circle" style={settings.glyphStyle} size={22} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {connected && (
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none z-10">
          {showStats ? (
            <div className="pointer-events-auto bg-[#181818]/90 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2 text-xs space-y-1.5 shadow-xl">
              <div className="flex flex-wrap items-center gap-3 font-semibold text-white">
                {settings.telemetryMask.fps && (
                  <span>
                    {telemetry.height}p {Math.round(telemetry.fps || 60)} fps
                  </span>
                )}
                {settings.telemetryMask.bitrate && (
                  <span>{telemetry.bitrateMbps.toFixed(1)} Mbps</span>
                )}
                {settings.telemetryMask.latency && (
                  <span>{Math.round(telemetry.rttMs)} ms</span>
                )}
                {settings.telemetryMask.loss && (
                  <span>{telemetry.packetLossPct.toFixed(1)}%</span>
                )}
                {settings.telemetryMask.qp && <span>QP 24</span>}
                {settings.telemetryMask.delay && <span>Dec 4.2 ms HW</span>}
                {settings.telemetryMask.mic && !micMuted && (
                  <span className="text-[#1ed760]">MIC</span>
                )}
                {(telemetry.packetLossPct > 2 || telemetry.rttMs > 160) && (
                  <span className="inline-flex items-center gap-1 text-[#ffb020]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Unstable connection
                  </span>
                )}
              </div>
              {settings.telemetryMask.graph && (
                <div className="flex items-end gap-[2px] h-5 pt-0.5">
                  {frametimes.map((ft, idx) => (
                    <span
                      key={idx}
                      className="w-1 rounded-t-[1px]"
                      style={{
                        height: `${Math.min(100, Math.max(18, (ft / 30) * 100))}%`,
                        backgroundColor: ft <= 8 ? '#28d250' : ft <= 20 ? '#ffbe28' : '#ff3c3c',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVirtualPad((v) => !v)}
              className={`px-3 py-2 rounded-full text-xs font-semibold border backdrop-blur-md cursor-pointer flex items-center gap-1.5 ${
                showVirtualPad
                  ? 'bg-[#107c10] border-emerald-400 text-white'
                  : 'bg-[#181818]/85 border-white/15 text-white/90 hover:bg-black'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              Pad
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="px-3.5 py-2 rounded-full bg-[#181818]/85 hover:bg-black border border-white/15 text-white text-xs font-semibold backdrop-blur-md cursor-pointer flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Menu (F12)
            </button>
          </div>
        </div>
      )}

      {nexusToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#107c10] text-white text-xs font-bold shadow-xl z-30">
          Xbox Guide Button Sent
        </div>
      )}

      {/* Analog Virtual Controller Overlay */}
      {connected && showVirtualPad && (
        <div className="absolute inset-x-3 sm:inset-x-6 bottom-3 sm:bottom-5 flex flex-col gap-3 pointer-events-none z-10">
          {/* Shoulder & Trigger Row */}
          <div className="flex items-center justify-between px-2">
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                onPointerDown={() => clientRef.current?.setVirtualTrigger('left', 1)}
                onPointerUp={() => clientRef.current?.setVirtualTrigger('left', 0)}
                onPointerLeave={() => clientRef.current?.setVirtualTrigger('left', 0)}
                className="px-4 py-1.5 rounded-xl bg-black/60 active:bg-emerald-500 border border-white/20 text-xs font-bold"
              >
                L2 / LT
              </button>
              <button
                type="button"
                {...bindVirtualBtn(GamepadButton.LeftShoulder)}
                className="px-4 py-1.5 rounded-xl bg-black/60 active:bg-emerald-500 border border-white/20 text-xs font-bold"
              >
                L1 / LB
              </button>
            </div>
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                {...bindVirtualBtn(GamepadButton.RightShoulder)}
                className="px-4 py-1.5 rounded-xl bg-black/60 active:bg-emerald-500 border border-white/20 text-xs font-bold"
              >
                R1 / RB
              </button>
              <button
                type="button"
                onPointerDown={() => clientRef.current?.setVirtualTrigger('right', 1)}
                onPointerUp={() => clientRef.current?.setVirtualTrigger('right', 0)}
                onPointerLeave={() => clientRef.current?.setVirtualTrigger('right', 0)}
                className="px-4 py-1.5 rounded-xl bg-black/60 active:bg-emerald-500 border border-white/20 text-xs font-bold"
              >
                R2 / RT
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between gap-2">
            {/* Left Analog Stick */}
            <div className="pointer-events-auto flex items-end gap-3">
              <TouchThumbstick
                label="LS"
                onMove={(x, y) => {
                  clientRef.current?.setVirtualStick('left', x, y);
                }}
              />
            </div>

            {/* Center View / Xbox / Menu */}
            <div className="pointer-events-auto flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
              <button
                type="button"
                {...bindVirtualBtn(GamepadButton.View)}
                className="px-2.5 py-1 rounded-full bg-white/10 active:bg-white/30 text-[11px] font-bold"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(18);
                  clientRef.current?.pressNexusButton();
                  setNexusToast(true);
                  setTimeout(() => setNexusToast(false), 1400);
                }}
                className="w-8 h-8 rounded-full bg-[#107c10] text-white text-xs font-bold"
              >
                X
              </button>
              <button
                type="button"
                {...bindVirtualBtn(GamepadButton.Menu)}
                className="px-2.5 py-1 rounded-full bg-white/10 active:bg-white/30 text-[11px] font-bold"
              >
                Menu
              </button>
            </div>

            {/* Right Stick + ABXY */}
            <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
              <div className="hidden sm:block">
                <TouchThumbstick
                  label="RS"
                  onMove={(x, y) => clientRef.current?.setVirtualStick('right', x, y)}
                />
              </div>
              <div className="grid grid-cols-3 gap-1 bg-black/55 backdrop-blur-md p-2.5 rounded-2xl border border-white/15">
                <div />
                <button
                  type="button"
                  {...bindVirtualBtn(GamepadButton.Y)}
                  className="w-11 h-11 rounded-full bg-amber-500/30 border border-amber-400/60 active:bg-amber-400 text-white font-bold"
                >
                  Y
                </button>
                <div />
                <button
                  type="button"
                  {...bindVirtualBtn(GamepadButton.X)}
                  className="w-11 h-11 rounded-full bg-sky-500/30 border border-sky-400/60 active:bg-sky-400 text-white font-bold"
                >
                  X
                </button>
                <div />
                <button
                  type="button"
                  {...bindVirtualBtn(GamepadButton.B)}
                  className="w-11 h-11 rounded-full bg-rose-500/30 border border-rose-400/60 active:bg-rose-400 text-white font-bold"
                >
                  B
                </button>
                <div />
                <button
                  type="button"
                  {...bindVirtualBtn(GamepadButton.A)}
                  className="w-11 h-11 rounded-full bg-emerald-500/30 border border-emerald-400/60 active:bg-emerald-400 text-white font-bold"
                >
                  A
                </button>
                <div />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PSBox Left-Side Slide-Over StreamMenu (matching stream_menu.cpp) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm flex items-stretch justify-start gap-4"
          onClick={() => {
            setStatsCustomizing(false);
            setMenuOpen(false);
          }}
        >
          <div
            className="w-full max-w-[460px] h-full bg-[#141414] border-t-[6px] border-t-[#107c10] flex flex-col justify-between overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + Tabs */}
            <div className="px-6 pt-5 pb-3 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {statsCustomizing ? 'Customize indicators' : t(settings.language, 'gameMenu')}
                </h3>
                <div className="flex items-center gap-3">
                  {cloudTimeRemainingSec >= 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#bebebe]">
                      <Clock className="w-3.5 h-3.5" />
                      {Math.floor(cloudTimeRemainingSec / 3600)}h {Math.floor((cloudTimeRemainingSec % 3600) / 60)}m left
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStatsCustomizing(false);
                      setMenuOpen(false);
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {!statsCustomizing && (
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="px-2 py-0.5 rounded bg-white/15 text-white">L1</span>
                  {(
                    [
                      ['general', 'General'],
                      ['controls', 'Controllers'],
                      ['guitar', 'Guitar'],
                    ] as const
                  ).map(([id, lbl]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMenuTab(id)}
                      className={`px-3 py-1 rounded-md cursor-pointer transition-colors border-b-2 ${
                        menuTab === id
                          ? 'bg-white/15 text-white border-[#107c10]'
                          : 'text-[#8c8c8c] border-transparent hover:text-white'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                  <span className="px-2 py-0.5 rounded bg-white/15 text-white">R1</span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 text-sm">
              {statsCustomizing ? (
                <div className="space-y-1.5">
                  {(
                    [
                      ['fps', 'FPS & Resolution'],
                      ['bitrate', 'Bitrate'],
                      ['latency', 'Latency (RTT)'],
                      ['loss', 'Packet loss'],
                      ['graph', 'Network jitter graph'],
                      ['delay', 'Decode & display latency'],
                      ['qp', 'Video quality (QP)'],
                      ['mic', 'Microphone status'],
                    ] as Array<[keyof TelemetryMask, string]>
                  ).map(([k, lbl]) => {
                    const active = settings.telemetryMask[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            telemetryMask: { ...settings.telemetryMask, [k]: !active },
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white hover:text-[#141414] flex items-center justify-between cursor-pointer group"
                      >
                        <span className="flex items-center gap-3 font-semibold">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center ${
                              active ? 'bg-[#107c10] text-white' : 'border border-[#8c8c8c]'
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5" />}
                          </span>
                          {lbl}
                        </span>
                        <span className="text-xs opacity-75">{active ? 'On' : 'Off'}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setStatsCustomizing(false)}
                    className="mt-3 psbox-btn psbox-btn-primary text-xs w-full"
                  >
                    Done
                  </button>
                </div>
              ) : menuTab === 'general' ? (
                <>
                  <button
                    type="button"
                    onMouseEnter={() => setMenuHoverDesc('Opens the Xbox Guide menu or sends the Xbox button to the game.')}
                    onClick={() => {
                      clientRef.current?.pressNexusButton();
                      setNexusToast(true);
                      setTimeout(() => setNexusToast(false), 1400);
                    }}
                    className="w-full px-3.5 py-2 rounded-lg hover:bg-white hover:text-[#141414] flex items-center justify-between font-semibold cursor-pointer"
                  >
                    <span>{t(settings.language, 'xboxButton')}</span>
                    <Gamepad2 className="w-4 h-4 opacity-75" />
                  </button>

                  <div
                    onMouseEnter={() => setMenuHoverDesc('Configures and displays performance, network, and latency overlay on screen.')}
                    className="px-3.5 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showStats;
                        setShowStats(next);
                        onUpdateSettings({ statsEnabled: next });
                      }}
                      className="flex-1 text-left font-semibold cursor-pointer"
                    >
                      Statistics: <span className="text-[#bebebe]">{showStats ? 'On' : 'Off'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowStats(true);
                        setStatsCustomizing(true);
                      }}
                      className="px-2.5 py-1 rounded bg-[#181c20] border border-[#16a34a] text-[11px] font-bold text-[#4ade80] cursor-pointer"
                    >
                      Customize &gt;
                    </button>
                  </div>

                  <div
                    onMouseEnter={() => setMenuHoverDesc('Applies image upscaling and reconstruction filters such as AMD FSR and Anime4K.')}
                    className="px-3.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold">Upscaling</span>
                    <select
                      value={settings.upscaler}
                      onChange={(e) => onUpdateSettings({ upscaler: e.target.value as UpscalerMode })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="fsr">FSR</option>
                      <option value="fsr_clean">FSR + clean-up</option>
                      <option value="ai">AI (Anime4K)</option>
                      <option value="ai_clean">AI + clean-up</option>
                    </select>
                  </div>

                  <div
                    onMouseEnter={() => setMenuHoverDesc('Adjusts the intensity of the sharpening filter applied to the video stream.')}
                    className="px-3.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold">{t(settings.language, 'sharpness')}</span>
                    <select
                      value={settings.sharpness}
                      onChange={(e) => onUpdateSettings({ sharpness: e.target.value as SharpnessLevel })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="off">Off</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div
                    onMouseEnter={() => setMenuHoverDesc('Reduces banding artifacts and color gradients in dark game scenes.')}
                    className="px-3.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold">Block smoothing</span>
                    <select
                      value={settings.deband}
                      onChange={(e) => onUpdateSettings({ deband: e.target.value as DebandLevel })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="auto">Auto</option>
                      <option value="off">Off</option>
                      <option value="low">Low</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div
                    onMouseEnter={() => setMenuHoverDesc('Sets the maximum streaming video resolution.')}
                    className="px-3.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold">{t(settings.language, 'resolution')}</span>
                    <select
                      value={settings.resolution}
                      onChange={(e) => {
                        const res = e.target.value as ResolutionMode;
                        onUpdateSettings({ resolution: res });
                        const alias =
                          res === '720p' ? '720' : res === '1080pHQ' ? '1080HQ' : res === '1440p' ? '1440' : '1080';
                        clientRef.current?.requestResolution(alias);
                      }}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                      <option value="1080pHQ">1080p HQ</option>
                      <option value="1440p">Best (1440p)</option>
                    </select>
                  </div>

                  <div
                    onMouseEnter={() => setMenuHoverDesc('Limits the stream presentation framerate to maintain smooth frame pacing.')}
                    className="px-3.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold">FPS Limiter</span>
                    <select
                      value={settings.fpsLimit}
                      onChange={(e) => onUpdateSettings({ fpsLimit: Number(e.target.value) as 0 | 30 | 60 | 120 })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value={0}>Unlimited</option>
                      <option value={30}>30 fps</option>
                      <option value={60}>60 fps</option>
                      <option value={120}>120 fps</option>
                    </select>
                  </div>

                  <div
                    onMouseEnter={() => setMenuHoverDesc('Automatic uses Xbox profile cap; Unlimited removes the app ceiling.')}
                    className="px-3.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold">Maximum bitrate</span>
                    <select
                      value={settings.maxBitrateMbps}
                      onChange={(e) => onUpdateSettings({ maxBitrateMbps: Number(e.target.value) })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value={0}>Automatic</option>
                      <option value={15}>15 Mbps</option>
                      <option value={25}>25 Mbps (experimental)</option>
                      <option value={35}>35 Mbps (experimental)</option>
                      <option value={50}>50 Mbps (experimental)</option>
                      <option value={-1}>Unlimited</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button type="button" onClick={toggleFullscreen} className="psbox-btn text-xs">
                      {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                      {isFullscreen ? 'Window' : 'Fullscreen'}
                    </button>
                    <button type="button" onClick={() => setMuted((m) => !m)} className="psbox-btn text-xs">
                      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      {muted ? 'Unmute' : 'Mute'}
                    </button>
                    <button type="button" onClick={toggleMouseLock} className="psbox-btn text-xs">
                      <MousePointerClick className="w-3.5 h-3.5" />
                      {mouseCapture ? 'Unlock Mouse' : 'Lock Mouse'}
                    </button>
                    <button
                      type="button"
                      onMouseEnter={() => setMenuHoverDesc('Re-establishes the WebRTC stream connection without closing your cloud session.')}
                      onClick={() => setReloadNonce((n) => n + 1)}
                      className="psbox-btn text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reload Stream
                    </button>
                  </div>
                </>
              ) : menuTab === 'controls' ? (
                <>
                  <label className="flex items-center justify-between px-3.5 py-2 rounded-lg hover:bg-white/5">
                    <span className="font-semibold">Virtual Touch Gamepad</span>
                    <input
                      type="checkbox"
                      checked={showVirtualPad}
                      onChange={(e) => setShowVirtualPad(e.target.checked)}
                      className="w-4 h-4 accent-[#107c10]"
                    />
                  </label>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Confirm button</span>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ circleConfirms: !settings.circleConfirms })}
                      className="px-3 py-1 rounded bg-[#242424] text-xs font-bold cursor-pointer"
                    >
                      {settings.circleConfirms ? '○' : '×'}
                    </button>
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Trigger vibration</span>
                    <select
                      value={settings.triggerStrength}
                      onChange={(e) => onUpdateSettings({ triggerStrength: Number(e.target.value), triggerRumble: Number(e.target.value) > 0 })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value={0}>Off</option>
                      <option value={1}>Light</option>
                      <option value={2}>Medium</option>
                      <option value={3}>Strong</option>
                      <option value={4}>Max</option>
                    </select>
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Audio-to-Haptics</span>
                    <select
                      value={settings.audioHaptics}
                      onChange={(e) => onUpdateSettings({ audioHaptics: Number(e.target.value) as 0 | 1 | 2 | 3 })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value={0}>Off</option>
                      <option value={1}>Low</option>
                      <option value={2}>Medium</option>
                      <option value={3}>High</option>
                    </select>
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Stick dead zone ({Math.round(settings.deadzone * 100)}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={0.35}
                      step={0.01}
                      value={settings.deadzone}
                      onChange={(e) => onUpdateSettings({ deadzone: Number(e.target.value) })}
                      className="w-28 accent-[#107c10]"
                    />
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Controller speaker</span>
                    <span className="text-xs text-[#bebebe]">
                      {settings.padSpeakerVolume === 0 ? 'Mute' : `${settings.padSpeakerVolume} %`}
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Gyro aiming</span>
                    <select
                      value={settings.gyroMode}
                      onChange={(e) => onUpdateSettings({ gyroMode: e.target.value as GyroMode })}
                      className="bg-[#242424] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="off">Off</option>
                      <option value="always">Always</option>
                      <option value="aiming">While aiming (L2)</option>
                      <option value="steering">Steering wheel</option>
                    </select>
                  </div>
                </>
              ) : (
                /* Guitar Mode Tab (Fortnite Festival) */
                <div className="space-y-2.5">
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Strum mode</span>
                    <button
                      type="button"
                      onClick={() => setGuitarStrum((v) => !v)}
                      className="px-3 py-1 rounded bg-[#242424] text-xs font-bold cursor-pointer"
                    >
                      {guitarStrum ? 'On' : 'Off'}
                    </button>
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="font-semibold">Star power by raising</span>
                    <button
                      type="button"
                      onClick={() => setGuitarTilt((v) => !v)}
                      className="px-3 py-1 rounded bg-[#242424] text-xs font-bold cursor-pointer"
                    >
                      {guitarTilt ? 'Normal' : 'Off'}
                    </button>
                  </div>
                  <div className="border-t border-white/10 pt-2 text-[11px] text-[#8c8c8c] px-3.5">
                    Bind these in Fortnite: Settings &gt; Controller &gt; Fortnite Festival
                  </div>
                  {[
                    { lbl: 'Lane 1 (Green)', color: '#28b446' },
                    { lbl: 'Lane 2 (Red)', color: '#dc3232' },
                    { lbl: 'Lane 3 (Yellow)', color: '#ebc828' },
                    { lbl: 'Lane 4 (Blue)', color: '#286ee6' },
                    { lbl: 'Lane 5 (Orange)', color: '#f0821e' },
                    { lbl: 'Overdrive', color: '#50c8e6' },
                  ].map((lane, idx) => (
                    <div
                      key={lane.lbl}
                      className="px-3.5 py-1.5 flex items-center justify-between rounded-lg bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-semibold">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: lane.color }} />
                        {lane.lbl}
                      </span>
                      <select
                        value={guitarLanes[idx]}
                        onChange={(e) =>
                          setGuitarLanes((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                        className="bg-[#242424] rounded px-2 py-0.5 text-xs font-bold text-white"
                      >
                        {['A', 'B', 'X', 'Y', 'LB', 'RB', 'Back'].map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom 2-Column Live Telemetry + Mic VU + Controller Slots + Leave */}
            <div className="px-5 py-3 border-t border-white/10 bg-[#141414] space-y-3">
              {/* 2-Column Connection Stats matching TelemetryOverlay::drawTwoColumnStats */}
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">Region</span>
                  <span className="font-semibold text-white">{regionName || 'Auto'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">Packet loss</span>
                  <span className="font-semibold text-white">{telemetry.packetLossPct.toFixed(1)} %</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">Latency</span>
                  <span className="font-semibold text-white">{telemetry.rttMs || '-'} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">Decoding</span>
                  <span className="font-semibold text-white">{settings.videoDecoder === 'hw' ? 'HW' : 'SW'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">Bitrate</span>
                  <span className="font-semibold text-white">{telemetry.bitrateMbps.toFixed(1)} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">Frame rate</span>
                  <span className="font-semibold text-white">{telemetry.height}p {Math.round(telemetry.fps || 60)} fps</span>
                </div>
              </div>

              {/* Microphone + Controller Slots 1..4 */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {[0, 1, 2, 3].map((slot) => {
                    const active = slot < connectedPads.length || (slot === 0 && showVirtualPad);
                    return (
                      <div
                        key={slot}
                        className={`w-9 h-7 rounded-md flex items-center justify-center text-[10px] font-bold border ${
                          active
                            ? 'bg-[#242424] border-[#107c10] text-white'
                            : 'bg-white/[0.03] border-white/10 text-[#666]'
                        }`}
                        title={connectedPads[slot] || `Player ${slot + 1}`}
                      >
                        P{slot + 1}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setMicMuted((m) => !m)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                    micMuted ? 'bg-amber-500/20 text-amber-300' : 'bg-[#107c10]/30 text-emerald-300'
                  }`}
                >
                  {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {micMuted ? 'Muted' : 'Active'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleLeave}
                className="psbox-btn w-full bg-rose-500/20 border-rose-400/40 text-rose-200 hover:bg-rose-500/30 text-xs"
              >
                <LogOut className="w-4 h-4" />
                {isHome ? 'End the stream' : t(settings.language, 'leaveGame')}
              </button>
            </div>
          </div>

          {/* Right-Side Floating Description Card matching stream_menu.cpp kCombinedW */}
          {!statsCustomizing && (
            <div
              className="hidden lg:block w-72 h-fit mt-10 bg-[#181818]/95 border border-white/10 rounded-2xl p-4 text-xs text-[#bebebe] leading-relaxed shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-white font-bold mb-1">Tip</div>
              {menuHoverDesc}
            </div>
          )}
        </div>
      )}

      {kbReq && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              clientRef.current?.completeVirtualKeyboard(kbReq.id, kbText);
              setKbReq(null);
            }}
            className="max-w-md w-full bg-[#12161b] border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Keyboard className="w-4 h-4" />
              {kbReq.title}
            </div>
            {kbReq.description && <p className="text-xs text-[#9aa4b8]">{kbReq.description}</p>}
            <input
              autoFocus
              maxLength={kbReq.maxLength}
              value={kbText}
              onChange={(e) => setKbText(e.target.value)}
              className="w-full bg-[#0b0e14] border border-white/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  clientRef.current?.completeVirtualKeyboard(kbReq.id, null);
                  setKbReq(null);
                }}
                className="psbox-btn text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="psbox-btn psbox-btn-primary text-xs">
                Send Text
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
