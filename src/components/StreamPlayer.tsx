import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Gamepad2,
  Keyboard,
  LogOut,
  Maximize,
  Minimize,
  MousePointerClick,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { GamepadButton } from '../stream/inputPacket';
import {
  XCloudWebRtcClient,
  type StreamTelemetry,
  type VirtualKeyboardRequest,
} from '../stream/xcloudWebRtc';
import type { AppSettings, ResolutionMode, SharpnessLevel } from '../types';
import { t } from '../i18n/translations';
import { BrandMark } from './BrandMark';

interface StreamPlayerProps {
  title: string;
  targetId: string;
  isHome: boolean;
  demoMode: boolean;
  regionName: string;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onExit: (elapsedSec: number) => void;
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

export const StreamPlayer: React.FC<StreamPlayerProps> = ({
  title,
  targetId,
  isHome,
  demoMode,
  regionName,
  settings,
  onUpdateSettings,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const demoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const clientRef = useRef<XCloudWebRtcClient | null>(null);
  const startTimeRef = useRef(Date.now());

  const [statusMsg, setStatusMsg] = useState(demoMode ? 'Launching demo cloud stream...' : 'Starting session...');
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showVirtualPad, setShowVirtualPad] = useState(false);
  const [mouseCapture, setMouseCapture] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kbReq, setKbReq] = useState<VirtualKeyboardRequest | null>(null);
  const [kbText, setKbText] = useState('');
  const [nexusToast, setNexusToast] = useState(false);

  const [telemetry, setTelemetry] = useState<StreamTelemetry>({
    rttMs: demoMode ? 18 : 0,
    bitrateMbps: demoMode ? 16.4 : 0,
    fps: demoMode ? 60 : 0,
    packetLossPct: 0,
    width: settings.resolution === '720p' ? 1280 : settings.resolution === '1440p' ? 2560 : 1920,
    height: settings.resolution === '720p' ? 720 : settings.resolution === '1440p' ? 1440 : 1080,
    codec: 'H.264 High',
  });

  // Demo simulation state ref
  const demoInputRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    b: false,
    x: false,
    y: false,
  });

  // Connect real WebRTC or Demo stream
  useEffect(() => {
    startTimeRef.current = Date.now();
    if (demoMode) {
      const timer = window.setTimeout(() => {
        setConnected(true);
      }, 900);
      return () => clearTimeout(timer);
    }

    const client = new XCloudWebRtcClient({
      onStatus: (msg) => setStatusMsg(msg),
      onMediaStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setConnected(true);
      },
      onTelemetry: (stats) => setTelemetry(stats),
      onVirtualKeyboard: (req) => {
        setKbReq(req);
        setKbText(req.defaultText || '');
      },
      onClosed: (reason) => {
        setStreamError(reason);
      },
    });
    client.setDeadzone(settings.deadzone);
    client.setTriggerRumble(settings.triggerRumble);
    clientRef.current = client;

    client
      .connect(targetId, settings.resolution, 'en-US', isHome)
      .catch((err) => {
        setStreamError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [demoMode, targetId, isHome]);

  useEffect(() => {
    clientRef.current?.setDeadzone(settings.deadzone);
    clientRef.current?.setTriggerRumble(settings.triggerRumble);
  }, [settings.deadzone, settings.triggerRumble]);

  // Interactive 60fps Demo Stream Canvas
  useEffect(() => {
    if (!demoMode || !connected) return;
    const canvas = demoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let px = 640;
    let py = 390;
    let vx = 0;
    let vy = 0;
    let frame = 0;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = [];

    const tick = () => {
      frame++;
      const pads = navigator.getGamepads?.() ?? [];
      const pad = pads[0];
      const inp = demoInputRef.current;

      let ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      let ay = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      let btnA = inp.a;
      let btnX = inp.x;

      if (pad) {
        if (Math.abs(pad.axes[0] ?? 0) > settings.deadzone) ax = pad.axes[0];
        if (Math.abs(pad.axes[1] ?? 0) > settings.deadzone) ay = pad.axes[1];
        if (pad.buttons[0]?.pressed) btnA = true;
        if (pad.buttons[2]?.pressed) btnX = true;
      }

      const speed = btnA ? 7.5 : 4.6;
      vx = vx * 0.82 + ax * speed * 0.35;
      vy = vy * 0.82 + ay * speed * 0.35;
      px = Math.max(80, Math.min(1200, px + vx));
      py = Math.max(120, Math.min(620, py + vy));

      if (btnA || btnX || frame % 4 === 0) {
        particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 3 - vx * 0.4,
          vy: (Math.random() - 0.5) * 3 - vy * 0.4,
          life: 1,
          color: btnX ? '#38bdf8' : btnA ? '#4ade80' : '#107c10',
        });
      }

      // Draw sky + cyber grid horizon
      const grad = ctx.createLinearGradient(0, 0, 0, 720);
      grad.addColorStop(0, '#07100c');
      grad.addColorStop(0.55, '#0b1e14');
      grad.addColorStop(1, '#06080c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // Perspective grid
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.16)';
      ctx.lineWidth = 1;
      for (let gx = -600; gx <= 1880; gx += 80) {
        ctx.beginPath();
        ctx.moveTo(640 + (gx - 640) * 0.18, 220);
        ctx.lineTo(gx, 720);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const tVal = ((i + (frame * 0.03) % 1) / 12);
        const yLine = 220 + tVal * tVal * 500;
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.lineTo(1280, yLine);
        ctx.stroke();
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.03;
        if (pt.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 * pt.life + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Player craft
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(vx * 0.04);
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = btnA ? 28 : 16;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(24, 18);
      ctx.lineTo(0, 10);
      ctx.lineTo(-24, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Stream banner
      ctx.fillStyle = 'rgba(12, 16, 20, 0.72)';
      ctx.fillRect(28, 24, 440, 62);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(28, 24, 440, 62);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('DEMO STREAM SIMULATOR • 60 FPS INTERACTIVE', 44, 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillText(title, 44, 73);

      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.font = '13px Inter, sans-serif';
      ctx.fillText('Use Arrow keys / Gamepad / On-Screen Pad to pilot • Space = Boost • ESC = Game Menu', 28, 694);

      if (frame % 30 === 0) {
        setTelemetry({
          rttMs: Math.round(16 + Math.random() * 5),
          bitrateMbps: Number((15.2 + Math.random() * 2.4).toFixed(1)),
          fps: 60,
          packetLossPct: 0,
          width: settings.resolution === '720p' ? 1280 : settings.resolution === '1440p' ? 2560 : 1920,
          height: settings.resolution === '720p' ? 720 : settings.resolution === '1440p' ? 1440 : 1080,
          codec: 'H.264 High (Simulated)',
        });
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [demoMode, connected, title, settings.resolution, settings.deadzone]);

  // Keyboard & Pointer Lock forwarding
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen((prev) => !prev);
        return;
      }
      if (kbReq) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') demoInputRef.current.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') demoInputRef.current.down = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') demoInputRef.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') demoInputRef.current.right = true;
      if (e.code === 'Space' || e.code === 'Enter') demoInputRef.current.a = true;
      if (e.code === 'KeyE') demoInputRef.current.x = true;

      const mapped = VK_MAP[e.code];
      if (mapped?.bit) clientRef.current?.setKeyboardGamepadBit(mapped.bit, true);
      if (mouseCapture) {
        clientRef.current?.sendRawKey(e.keyCode, true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') demoInputRef.current.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') demoInputRef.current.down = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') demoInputRef.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') demoInputRef.current.right = false;
      if (e.code === 'Space' || e.code === 'Enter') demoInputRef.current.a = false;
      if (e.code === 'KeyE') demoInputRef.current.x = false;

      const mapped = VK_MAP[e.code];
      if (mapped?.bit) clientRef.current?.setKeyboardGamepadBit(mapped.bit, false);
      if (mouseCapture) {
        clientRef.current?.sendRawKey(e.keyCode, false);
      }
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

  const bindVirtualBtn = (bit: number, demoKey?: keyof typeof demoInputRef.current) => ({
    onPointerDown: () => {
      clientRef.current?.setVirtualButton(bit, true);
      if (demoKey) demoInputRef.current[demoKey] = true;
    },
    onPointerUp: () => {
      clientRef.current?.setVirtualButton(bit, false);
      if (demoKey) demoInputRef.current[demoKey] = false;
    },
    onPointerLeave: () => {
      clientRef.current?.setVirtualButton(bit, false);
      if (demoKey) demoInputRef.current[demoKey] = false;
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
      {/* Video / Demo Canvas */}
      {demoMode ? (
        <canvas
          ref={demoCanvasRef}
          width={1280}
          height={720}
          className={`w-full h-full object-contain ${sharpClass}`}
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full object-contain ${sharpClass}`}
        />
      )}

      {/* Connecting / Error Overlay */}
      {(!connected || streamError) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md z-20"
          style={{
            backgroundImage: `linear-gradient(rgba(8,12,10,0.88), rgba(8,12,10,0.94)), url('./assets/pic1.png')`,
            backgroundSize: 'cover',
          }}
        >
          <BrandMark size={68} className="mb-5" />
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          {streamError ? (
            <div className="max-w-md space-y-4">
              <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-xl p-4">
                {streamError}
              </p>
              <button type="button" onClick={handleLeave} className="psbox-btn psbox-btn-primary">
                Return to Library
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-7 h-7 text-emerald-400 psbox-spinner" />
              <p className="text-sm text-[#b4bcc8]">{statusMsg}</p>
              <button type="button" onClick={handleLeave} className="psbox-btn text-xs mt-2">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top HUD Bar */}
      {connected && (
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-10">
          {showStats ? (
            <div className="pointer-events-auto bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2 text-xs flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Activity className="w-3.5 h-3.5" />
                {telemetry.width}x{telemetry.height}@{Math.round(telemetry.fps || 60)}
              </span>
              <span className="text-[#cbd5e1]">
                {t(settings.language, 'latency')}: <strong className="text-white">{Math.round(telemetry.rttMs)} ms</strong>
              </span>
              <span className="text-[#cbd5e1]">
                {t(settings.language, 'bitrate')}:{' '}
                <strong className="text-white">{telemetry.bitrateMbps.toFixed(1)} Mbps</strong>
              </span>
              <span className="text-[#cbd5e1]">
                {t(settings.language, 'packetLoss')}:{' '}
                <strong className="text-white">{telemetry.packetLossPct.toFixed(1)}%</strong>
              </span>
              {regionName && <span className="text-[#9aa4b8]">{regionName}</span>}
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
                  : 'bg-black/65 border-white/15 text-white/90 hover:bg-black/85'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              Pad
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="px-3.5 py-2 rounded-full bg-black/65 hover:bg-black/85 border border-white/15 text-white text-xs font-semibold backdrop-blur-md cursor-pointer flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Menu (ESC)
            </button>
          </div>
        </div>
      )}

      {nexusToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#107c10] text-white text-xs font-bold shadow-xl z-30">
          Xbox Guide Button Sent
        </div>
      )}

      {/* Virtual On-Screen Touch/Click Gamepad */}
      {connected && showVirtualPad && (
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between pointer-events-none z-10">
          {/* Left D-Pad */}
          <div className="pointer-events-auto grid grid-cols-3 gap-1.5 bg-black/55 backdrop-blur-md p-3 rounded-2xl border border-white/15">
            <div />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.DPadUp, 'up')}
              className="w-12 h-12 rounded-xl bg-white/10 active:bg-emerald-500 text-white font-bold"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.DPadLeft, 'left')}
              className="w-12 h-12 rounded-xl bg-white/10 active:bg-emerald-500 text-white font-bold"
            >
              ◀
            </button>
            <div className="w-12 h-12 rounded-xl bg-white/5" />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.DPadRight, 'right')}
              className="w-12 h-12 rounded-xl bg-white/10 active:bg-emerald-500 text-white font-bold"
            >
              ▶
            </button>
            <div />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.DPadDown, 'down')}
              className="w-12 h-12 rounded-xl bg-white/10 active:bg-emerald-500 text-white font-bold"
            >
              ▼
            </button>
            <div />
          </div>

          {/* Center Menu / View */}
          <div className="pointer-events-auto flex items-center gap-2 bg-black/55 backdrop-blur-md px-3 py-2 rounded-full border border-white/15">
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.View)}
              className="px-3 py-1.5 rounded-full bg-white/10 active:bg-white/30 text-xs font-bold"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => {
                clientRef.current?.pressNexusButton();
                setNexusToast(true);
                setTimeout(() => setNexusToast(false), 1400);
              }}
              className="w-9 h-9 rounded-full bg-[#107c10] text-white text-xs font-bold"
            >
              X
            </button>
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.Menu)}
              className="px-3 py-1.5 rounded-full bg-white/10 active:bg-white/30 text-xs font-bold"
            >
              Menu
            </button>
          </div>

          {/* Right ABXY */}
          <div className="pointer-events-auto grid grid-cols-3 gap-1.5 bg-black/55 backdrop-blur-md p-3 rounded-2xl border border-white/15">
            <div />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.Y)}
              className="w-12 h-12 rounded-full bg-amber-500/30 border border-amber-400/60 active:bg-amber-400 text-white font-bold"
            >
              Y
            </button>
            <div />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.X, 'x')}
              className="w-12 h-12 rounded-full bg-sky-500/30 border border-sky-400/60 active:bg-sky-400 text-white font-bold"
            >
              X
            </button>
            <div />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.B)}
              className="w-12 h-12 rounded-full bg-rose-500/30 border border-rose-400/60 active:bg-rose-400 text-white font-bold"
            >
              B
            </button>
            <div />
            <button
              type="button"
              {...bindVirtualBtn(GamepadButton.A, 'a')}
              className="w-12 h-12 rounded-full bg-emerald-500/30 border border-emerald-400/60 active:bg-emerald-400 text-white font-bold"
            >
              A
            </button>
            <div />
          </div>
        </div>
      )}

      {/* PSBox In-Game Overlay Menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-end"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-sm h-full bg-[#12161b] border-l border-white/15 p-6 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{t(settings.language, 'gameMenu')}</h3>
                  <p className="text-xs text-[#9aa4b8] truncate max-w-[230px]">{title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    clientRef.current?.pressNexusButton();
                    setNexusToast(true);
                    setTimeout(() => setNexusToast(false), 1400);
                  }}
                  className="psbox-btn text-xs"
                >
                  <Gamepad2 className="w-4 h-4 text-emerald-400" />
                  {t(settings.language, 'xboxButton')}
                </button>
                <button type="button" onClick={toggleFullscreen} className="psbox-btn text-xs">
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
                <button type="button" onClick={() => setMuted((m) => !m)} className="psbox-btn text-xs">
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {muted ? 'Unmute' : 'Mute'}
                </button>
                <button type="button" onClick={toggleMouseLock} className="psbox-btn text-xs">
                  <MousePointerClick className="w-4 h-4" />
                  {mouseCapture ? 'Unlock Mouse' : 'Lock Mouse'}
                </button>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="flex items-center justify-between text-sm">
                  <span>{t(settings.language, 'statistics')}</span>
                  <input
                    type="checkbox"
                    checked={showStats}
                    onChange={(e) => setShowStats(e.target.checked)}
                    className="w-4 h-4 accent-[#107c10]"
                  />
                </label>

                <label className="flex items-center justify-between text-sm">
                  <span>{t(settings.language, 'virtualGamepad')}</span>
                  <input
                    type="checkbox"
                    checked={showVirtualPad}
                    onChange={(e) => setShowVirtualPad(e.target.checked)}
                    className="w-4 h-4 accent-[#107c10]"
                  />
                </label>

                <div>
                  <div className="text-xs text-[#9aa4b8] mb-1.5">{t(settings.language, 'resolution')}</div>
                  <select
                    value={settings.resolution}
                    onChange={(e) => {
                      const res = e.target.value as ResolutionMode;
                      onUpdateSettings({ resolution: res });
                      const alias =
                        res === '720p' ? '720' : res === '1080pHQ' ? '1080HQ' : res === '1440p' ? '1440' : '1080';
                      clientRef.current?.requestResolution(alias);
                    }}
                    className="w-full bg-[#1b212c] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="720p">720p (Data Saver)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="1080pHQ">1080p HQ (High Bitrate)</option>
                    <option value="1440p">1440p (QHD Edge Profile)</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs text-[#9aa4b8] mb-1.5">{t(settings.language, 'sharpness')}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['off', 'low', 'medium', 'high'] as SharpnessLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onUpdateSettings({ sharpness: lvl })}
                        className={`py-1.5 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                          settings.sharpness === lvl
                            ? 'bg-[#107c10] border-emerald-400 text-white'
                            : 'bg-white/5 border-white/10 text-[#b4bcc8]'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLeave}
              className="psbox-btn w-full bg-rose-500/20 border-rose-400/40 text-rose-200 hover:bg-rose-500/30 mt-6"
            >
              <LogOut className="w-4 h-4" />
              {t(settings.language, 'leaveGame')}
            </button>
          </div>
        </div>
      )}

      {/* Virtual Keyboard Modal (ShowVirtualKeyboard from Xbox game) */}
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
