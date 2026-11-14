// SPDX-License-Identifier: GPL-3.0-or-later
import {
  clientMetadataReport,
  GamepadButton,
  gamepadReport,
  keyboardReport,
  mouseReport,
  parseVibration,
  type GamepadFrame,
} from './inputPacket';
import type { ResolutionMode } from '../types';
import { psboxApi } from '../services/psboxApi';

const CONTROL_ACCESS_KEY = '4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E';
const HANDSHAKE_ID = 'be0bfc6d-1e83-4c8a-90ed-fa8601c5a179';
const CLIENT_APP_INSTALL_ID = 'c97d7ee0-73b2-4239-bf1d-9d805a338429';

export interface StreamTelemetry {
  rttMs: number;
  bitrateMbps: number;
  fps: number;
  packetLossPct: number;
  width: number;
  height: number;
  codec: string;
}

export interface VirtualKeyboardRequest {
  id: string;
  title: string;
  description: string;
  defaultText: string;
  maxLength: number;
}

export interface XCloudSessionCallbacks {
  onStatus: (msg: string) => void;
  onMediaStream: (stream: MediaStream) => void;
  onTelemetry: (stats: StreamTelemetry) => void;
  onVirtualKeyboard: (req: VirtualKeyboardRequest) => void;
  onClosed: (reason: string) => void;
}

export class XCloudWebRtcClient {
  private pc: RTCPeerConnection | null = null;
  private chatCh: RTCDataChannel | null = null;
  private controlCh: RTCDataChannel | null = null;
  private inputCh: RTCDataChannel | null = null;
  private messageCh: RTCDataChannel | null = null;

  private seq = 1;
  private stopped = false;
  private keepaliveTimer: number | null = null;
  private statsTimer: number | null = null;
  private inputRaf: number | null = null;
  private lastBytes = 0;
  private lastStatsTime = 0;
  private mediaStream = new MediaStream();

  private virtualState: GamepadFrame = {
    index: 0,
    buttons: 0,
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
  };
  private keyboardButtons = 0;
  private deadzone = 0.08;
  private triggerRumble = true;

  constructor(private cb: XCloudSessionCallbacks) {}

  setDeadzone(dz: number) {
    this.deadzone = dz;
  }

  setTriggerRumble(enabled: boolean) {
    this.triggerRumble = enabled;
  }

  setVirtualButton(bit: number, pressed: boolean) {
    if (pressed) this.virtualState.buttons |= bit;
    else this.virtualState.buttons &= ~bit;
  }

  setVirtualStick(which: 'left' | 'right', x: number, y: number) {
    if (which === 'left') {
      this.virtualState.leftX = x;
      this.virtualState.leftY = y;
    } else {
      this.virtualState.rightX = x;
      this.virtualState.rightY = y;
    }
  }

  setVirtualTrigger(which: 'left' | 'right', val: number) {
    if (which === 'left') this.virtualState.leftTrigger = val;
    else this.virtualState.rightTrigger = val;
  }

  setKeyboardGamepadBit(bit: number, pressed: boolean) {
    if (pressed) this.keyboardButtons |= bit;
    else this.keyboardButtons &= ~bit;
  }

  sendRawKey(vk: number, pressed: boolean) {
    if (this.inputCh?.readyState === 'open') {
      this.inputCh.send(keyboardReport(this.seq++, performance.now(), vk, pressed));
    }
  }

  sendMouseMove(dx: number, dy: number, wheelX: number, wheelY: number, buttons: number) {
    if (this.inputCh?.readyState === 'open') {
      this.inputCh.send(mouseReport(this.seq++, performance.now(), dx * 2, dy * 2, wheelX, wheelY, buttons));
    }
  }

  pressNexusButton() {
    this.setVirtualButton(GamepadButton.Nexus, true);
    setTimeout(() => this.setVirtualButton(GamepadButton.Nexus, false), 140);
  }

  requestResolution(alias: string) {
    if (this.controlCh?.readyState === 'open') {
      this.controlCh.send(
        JSON.stringify({
          message: 'userRequestedResolutionUpdate',
          resolutionAlias: alias,
        }),
      );
    }
  }

  completeVirtualKeyboard(id: string, text: string | null) {
    if (this.messageCh?.readyState !== 'open') return;
    if (text === null) {
      this.messageCh.send(JSON.stringify({ type: 'ReceiverCancel', id, cv: '' }));
    } else {
      this.messageCh.send(
        JSON.stringify({
          type: 'TransactionComplete',
          id,
          content: JSON.stringify({ Text: text }),
          cv: '',
        }),
      );
    }
  }

  async connect(titleId: string, resolution: ResolutionMode, locale: string, isHome: boolean) {
    this.stopped = false;
    this.cb.onStatus('Requesting cloud session...');

    await psboxApi.sessionStart(titleId, resolution, locale, isHome);

    // Wait until ReadyToConnect / Provisioned
    let ready = false;
    for (let i = 0; i < 90 && !this.stopped; i++) {
      const st = (await psboxApi.sessionState(titleId)) as {
        state: string;
        waitSeconds?: number;
        errorCode?: string;
        errorMessage?: string;
      };
      if (st.state === 'ReadyToConnect' || st.state === 'Provisioned') {
        ready = true;
        break;
      }
      if (st.state === 'Failed') {
        throw new Error(st.errorMessage || st.errorCode || 'Cloud session failed to provision');
      }
      if (st.state === 'WaitingForResources') {
        const waitStr =
          st.waitSeconds && st.waitSeconds > 0
            ? `Estimated wait: ${Math.ceil(st.waitSeconds / 60)}m`
            : 'In queue...';
        this.cb.onStatus(`Waiting for Xbox cloud blade (${waitStr})`);
      } else {
        this.cb.onStatus('Getting your game ready...');
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!ready || this.stopped) return;

    this.cb.onStatus('Authorizing console transfer...');
    await psboxApi.sessionConnect();

    this.cb.onStatus('Establishing WebRTC video & input...');
    await this.setupWebRtc(resolution);
  }

  private async setupWebRtc(resolution: ResolutionMode) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.pc = pc;

    const gatheredCandidates: Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number }> = [];
    pc.onicecandidate = (ev) => {
      if (ev.candidate && ev.candidate.candidate) {
        gatheredCandidates.push({
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid ?? '0',
          sdpMLineIndex: ev.candidate.sdpMLineIndex ?? 0,
        });
      }
    };

    pc.ontrack = (ev) => {
      this.mediaStream.addTrack(ev.track);
      this.cb.onMediaStream(this.mediaStream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (!this.stopped) this.cb.onClosed(`WebRTC connection ${pc.connectionState}`);
      }
    };

    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'recvonly' });

    this.chatCh = pc.createDataChannel('chat', { protocol: 'chatV1' });
    this.controlCh = pc.createDataChannel('control', { protocol: 'controlV1' });
    this.inputCh = pc.createDataChannel('input', {
      protocol: '1.0',
      ordered: false,
      maxRetransmits: 0,
    });
    this.messageCh = pc.createDataChannel('message', { protocol: 'messageV1' });

    this.messageCh.onopen = () => {
      this.messageCh?.send(
        JSON.stringify({
          type: 'Handshake',
          version: 'messageV1',
          id: HANDSHAKE_ID,
          cv: '0',
        }),
      );
    };

    this.messageCh.onmessage = (ev) => {
      try {
        const text = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data);
        const j = JSON.parse(text) as { type?: string; target?: string; id?: string; content?: string };
        if (j.type === 'HandshakeAck') {
          this.onHandshakeAck(resolution);
        } else if (j.target === '/streaming/systemUi/messages/ShowVirtualKeyboard' && j.id) {
          const content = j.content ? (JSON.parse(j.content) as Record<string, unknown>) : {};
          this.cb.onVirtualKeyboard({
            id: j.id,
            title: String(content.TitleText ?? 'Text Input'),
            description: String(content.DescriptionText ?? ''),
            defaultText: String(content.DefaultText ?? ''),
            maxLength: Number(content.MaxLength ?? 256),
          });
        } else if (j.target === '/streaming/sessionLifetimeManagement/serverInitiatedDisconnect') {
          if (j.id) {
            this.messageCh?.send(
              JSON.stringify({ type: 'TransactionComplete', id: j.id, content: '""', cv: '' }),
            );
          }
          const content = j.content ? (JSON.parse(j.content) as { reason?: string }) : {};
          if (content.reason && content.reason !== 'WarningForBeingIdle') {
            this.cb.onClosed(`Server ended session (${content.reason})`);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    this.inputCh.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        const vib = parseVibration(new Uint8Array(ev.data));
        if (vib && this.triggerRumble) {
          const pad = navigator.getGamepads?.()?.[vib.gamepadIndex];
          const actuator = (pad as Gamepad & { vibrationActuator?: { playEffect?: (type: string, opts: unknown) => Promise<unknown> } })?.vibrationActuator;
          actuator?.playEffect?.('dual-rumble', {
            startDelay: vib.delayMs,
            duration: Math.min(2000, vib.durationMs || 180),
            weakMagnitude: vib.rightMotor / 100,
            strongMagnitude: vib.leftMotor / 100,
          }).catch(() => {});
        }
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await psboxApi.sendSdpOffer(offer.sdp ?? '');

    let answerSdp = '';
    for (let i = 0; i < 30 && !this.stopped; i++) {
      const d = await psboxApi.pollSdpAnswer();
      if (d.ready && d.sdp) {
        answerSdp = d.sdp;
        break;
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    if (!answerSdp) throw new Error('Timed out waiting for xCloud SDP answer');
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    // Exchange ICE candidates
    await new Promise((r) => setTimeout(r, 400));
    if (gatheredCandidates.length > 0) {
      await psboxApi.sendIceCandidates(gatheredCandidates);
    }
    for (let i = 0; i < 10 && !this.stopped; i++) {
      const candidates = await psboxApi.pollIceCandidates();
      for (const c of candidates) {
        await pc.addIceCandidate(c).catch(() => {});
      }
      if (candidates.length > 0) break;
      await new Promise((res) => setTimeout(res, 400));
    }

    this.startKeepalive();
    this.startStatsLoop();
    this.startInputLoop();
  }

  private onHandshakeAck(resolution: ResolutionMode) {
    this.controlCh?.send(JSON.stringify({ message: 'authorizationRequest', accessKey: CONTROL_ACCESS_KEY }));
    this.controlCh?.send(JSON.stringify({ message: 'gamepadChanged', gamepadIndex: 0, wasAdded: true }));

    const alias =
      resolution === '720p'
        ? '720'
        : resolution === '1080pHQ'
          ? '1080HQ'
          : resolution === '1440p'
            ? '1440'
            : '1080';
    this.requestResolution(alias);

    if (this.inputCh?.readyState === 'open') {
      this.inputCh.send(clientMetadataReport(0, performance.now(), 1));
    }

    const sendMsg = (target: string, content: unknown) => {
      this.messageCh?.send(
        JSON.stringify({
          type: 'Message',
          content: JSON.stringify(content),
          id: crypto.randomUUID(),
          target,
          cv: '',
        }),
      );
    };

    sendMsg('/streaming/systemUi/configuration', { version: [0, 2, 0], systemUis: [10] });
    sendMsg('/streaming/properties/clientappinstallidchanged', { clientAppInstallId: CLIENT_APP_INSTALL_ID });
    sendMsg('/streaming/characteristics/orientationchanged', { orientation: 0 });
    sendMsg('/streaming/characteristics/touchinputenabledchanged', { touchInputEnabled: false });
    sendMsg('/streaming/characteristics/clientdevicecapabilities', {});
    const w = resolution === '1440p' ? 2560 : 1920;
    const h = resolution === '1440p' ? 1440 : 1080;
    sendMsg('/streaming/characteristics/dimensionschanged', {
      horizontal: 423,
      vertical: 238,
      preferredWidth: w,
      preferredHeight: h,
      safeAreaLeft: 0,
      safeAreaTop: 0,
      safeAreaRight: w,
      safeAreaBottom: h,
      supportsCustomResolution: true,
    });
    this.messageCh?.send(
      JSON.stringify({
        type: 'TransactionStart',
        content: JSON.stringify({ constrain: false }),
        id: crypto.randomUUID(),
        target: '/streaming/title/constrain',
        cv: '',
      }),
    );
  }

  private startKeepalive() {
    this.keepaliveTimer = window.setInterval(() => {
      psboxApi.keepalive().catch(() => {});
    }, 30000);
  }

  private startStatsLoop() {
    this.statsTimer = window.setInterval(async () => {
      if (!this.pc) return;
      const stats = await this.pc.getStats();
      let rttMs = 0;
      let bitrateMbps = 0;
      let fps = 0;
      let packetLossPct = 0;
      let width = 1920;
      let height = 1080;
      let codec = 'H.264';

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          const now = performance.now();
          if (this.lastStatsTime > 0 && typeof report.bytesReceived === 'number') {
            const dt = (now - this.lastStatsTime) / 1000;
            if (dt > 0) {
              bitrateMbps = ((report.bytesReceived - this.lastBytes) * 8) / dt / 1_000_000;
            }
          }
          this.lastBytes = report.bytesReceived ?? 0;
          this.lastStatsTime = now;
          fps = report.framesPerSecond ?? 0;
          width = report.frameWidth ?? width;
          height = report.frameHeight ?? height;
          const total = (report.packetsReceived ?? 0) + (report.packetsLost ?? 0);
          if (total > 0) packetLossPct = ((report.packetsLost ?? 0) / total) * 100;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (typeof report.currentRoundTripTime === 'number') rttMs = report.currentRoundTripTime * 1000;
        }
      });

      this.cb.onTelemetry({ rttMs, bitrateMbps, fps, packetLossPct, width, height, codec });
    }, 1000);
  }

  private startInputLoop() {
    const dz = (v: number) => (Math.abs(v) < this.deadzone ? 0 : v);
    const loop = () => {
      if (this.stopped) return;
      if (this.inputCh?.readyState === 'open') {
        const pads = navigator.getGamepads?.() ?? [];
        const pad = pads[0];
        let frame: GamepadFrame = {
          ...this.virtualState,
          buttons: this.virtualState.buttons | this.keyboardButtons,
        };
        if (pad) {
          let b = frame.buttons;
          const btn = (idx: number) => pad.buttons[idx]?.pressed ?? false;
          if (btn(0)) b |= GamepadButton.A;
          if (btn(1)) b |= GamepadButton.B;
          if (btn(2)) b |= GamepadButton.X;
          if (btn(3)) b |= GamepadButton.Y;
          if (btn(4)) b |= GamepadButton.LeftShoulder;
          if (btn(5)) b |= GamepadButton.RightShoulder;
          if (btn(8)) b |= GamepadButton.View;
          if (btn(9)) b |= GamepadButton.Menu;
          if (btn(10)) b |= GamepadButton.LeftThumb;
          if (btn(11)) b |= GamepadButton.RightThumb;
          if (btn(12)) b |= GamepadButton.DPadUp;
          if (btn(13)) b |= GamepadButton.DPadDown;
          if (btn(14)) b |= GamepadButton.DPadLeft;
          if (btn(15)) b |= GamepadButton.DPadRight;
          if (btn(16)) b |= GamepadButton.Nexus;

          frame = {
            index: 0,
            buttons: b,
            leftX: dz(pad.axes[0] ?? 0) || frame.leftX,
            leftY: -dz(pad.axes[1] ?? 0) || frame.leftY,
            rightX: dz(pad.axes[2] ?? 0) || frame.rightX,
            rightY: -dz(pad.axes[3] ?? 0) || frame.rightY,
            leftTrigger: Math.max(pad.buttons[6]?.value ?? 0, frame.leftTrigger),
            rightTrigger: Math.max(pad.buttons[7]?.value ?? 0, frame.rightTrigger),
          };
        }
        this.inputCh.send(gamepadReport(this.seq++, performance.now(), frame));
      }
      this.inputRaf = requestAnimationFrame(loop);
    };
    this.inputRaf = requestAnimationFrame(loop);
  }

  async stop() {
    this.stopped = true;
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    if (this.inputRaf) cancelAnimationFrame(this.inputRaf);
    this.pc?.close();
    this.pc = null;
    await psboxApi.stopSession().catch(() => {});
  }
}
