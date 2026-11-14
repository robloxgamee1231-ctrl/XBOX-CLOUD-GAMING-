// SPDX-License-Identifier: GPL-3.0-or-later
// Exact binary implementation of PSBox Cloud Gaming's src/stream/input_packet.cpp

export const ReportType = {
  Metadata: 1,
  Gamepad: 2,
  ClientMetadata: 8,
  ServerMetadata: 16,
  Mouse: 32,
  Keyboard: 64,
  Vibration: 128,
} as const;

export const GamepadButton = {
  Nexus: 1 << 1,
  Menu: 1 << 2,
  View: 1 << 3,
  A: 1 << 4,
  B: 1 << 5,
  X: 1 << 6,
  Y: 1 << 7,
  DPadUp: 1 << 8,
  DPadDown: 1 << 9,
  DPadLeft: 1 << 10,
  DPadRight: 1 << 11,
  LeftShoulder: 1 << 12,
  RightShoulder: 1 << 13,
  LeftThumb: 1 << 14,
  RightThumb: 1 << 15,
} as const;

export interface GamepadFrame {
  index: number;
  buttons: number;
  leftX: number; // [-1, 1]
  leftY: number; // [-1, 1], +Y pointing UP
  rightX: number;
  rightY: number;
  leftTrigger: number; // [0, 1]
  rightTrigger: number; // [0, 1]
}

export interface VibrationEvent {
  gamepadIndex: number;
  leftMotor: number; // 0..100
  rightMotor: number;
  leftTrigger: number;
  rightTrigger: number;
  durationMs: number;
  delayMs: number;
  repeat: number;
}

const HEADER_SIZE = 14;

function writeHeader(view: DataView, type: number, sequence: number, timestampMs: number) {
  view.setUint16(0, type, true);
  view.setUint32(2, sequence >>> 0, true);
  view.setFloat64(6, timestampMs, true);
}

function clampAxis(v: number): number {
  return Math.round(Math.max(-1, Math.min(1, v)) * 32767);
}

function clampTrigger(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 65535);
}

export function clientMetadataReport(sequence: number, timestampMs: number, maxTouchPoints = 1): ArrayBuffer {
  const buf = new ArrayBuffer(HEADER_SIZE + 1);
  const view = new DataView(buf);
  writeHeader(view, ReportType.ClientMetadata, sequence, timestampMs);
  view.setUint8(HEADER_SIZE, maxTouchPoints);
  return buf;
}

export function gamepadPhysicality(f: GamepadFrame): number {
  let p = 0;
  if (f.buttons & GamepadButton.DPadUp) p |= 1 << 0;
  if (f.buttons & GamepadButton.DPadDown) p |= 1 << 1;
  if (f.buttons & GamepadButton.DPadLeft) p |= 1 << 2;
  if (f.buttons & GamepadButton.DPadRight) p |= 1 << 3;
  if (f.buttons & GamepadButton.Menu) p |= 1 << 4;
  if (f.buttons & GamepadButton.View) p |= 1 << 5;
  if (f.buttons & GamepadButton.LeftThumb) p |= 1 << 6;
  if (f.buttons & GamepadButton.RightThumb) p |= 1 << 7;
  if (f.buttons & GamepadButton.LeftShoulder) p |= 1 << 8;
  if (f.buttons & GamepadButton.RightShoulder) p |= 1 << 9;
  if (f.buttons & GamepadButton.Nexus) p |= 1 << 10;
  if (f.buttons & GamepadButton.A) p |= 1 << 12;
  if (f.buttons & GamepadButton.B) p |= 1 << 13;
  if (f.buttons & GamepadButton.X) p |= 1 << 14;
  if (f.buttons & GamepadButton.Y) p |= 1 << 15;
  if (clampTrigger(f.leftTrigger) !== 0) p |= 1 << 16;
  if (clampTrigger(f.rightTrigger) !== 0) p |= 1 << 17;
  if (clampAxis(f.leftX) !== 0) p |= 1 << 18;
  if (clampAxis(f.leftY) !== 0) p |= 1 << 19;
  if (clampAxis(f.rightX) !== 0) p |= 1 << 20;
  if (clampAxis(f.rightY) !== 0) p |= 1 << 21;
  return p >>> 0;
}

export function gamepadReport(sequence: number, timestampMs: number, f: GamepadFrame): ArrayBuffer {
  const buf = new ArrayBuffer(38);
  const view = new DataView(buf);
  writeHeader(view, ReportType.Gamepad, sequence, timestampMs);
  let o = HEADER_SIZE;
  view.setUint8(o++, 1); // frame count
  view.setUint8(o++, f.index);
  view.setUint16(o, f.buttons, true);
  view.setInt16(o + 2, clampAxis(f.leftX), true);
  view.setInt16(o + 4, clampAxis(f.leftY), true);
  view.setInt16(o + 6, clampAxis(f.rightX), true);
  view.setInt16(o + 8, clampAxis(f.rightY), true);
  view.setUint16(o + 10, clampTrigger(f.leftTrigger), true);
  view.setUint16(o + 12, clampTrigger(f.rightTrigger), true);
  view.setUint32(o + 14, gamepadPhysicality(f), true);
  view.setUint32(o + 18, 0, true);
  return buf;
}

export function mouseReport(
  sequence: number,
  timestampMs: number,
  dx: number,
  dy: number,
  wheelX: number,
  wheelY: number,
  buttons: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(HEADER_SIZE + 1 + 18);
  const view = new DataView(buf);
  writeHeader(view, ReportType.Mouse, sequence, timestampMs);
  let o = HEADER_SIZE;
  view.setUint8(o++, 1);
  view.setInt32(o, dx, true);
  view.setInt32(o + 4, dy, true);
  view.setInt32(o + 8, wheelX, true);
  view.setInt32(o + 12, wheelY, true);
  view.setUint8(o + 16, buttons);
  view.setUint8(o + 17, 0); // relative
  return buf;
}

export function keyboardReport(sequence: number, timestampMs: number, vk: number, pressed: boolean): ArrayBuffer {
  const buf = new ArrayBuffer(HEADER_SIZE + 1 + 3);
  const view = new DataView(buf);
  writeHeader(view, ReportType.Keyboard, sequence, timestampMs);
  let o = HEADER_SIZE;
  view.setUint8(o++, 1);
  view.setUint8(o, 2); // VKey
  view.setUint8(o + 1, pressed ? 1 : 0);
  view.setUint8(o + 2, vk & 0xff);
  return buf;
}

export function parseVibration(data: Uint8Array): VibrationEvent | null {
  if (data.byteLength < 13 || data[0] !== ReportType.Vibration) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    gamepadIndex: data[3],
    leftMotor: data[4],
    rightMotor: data[5],
    leftTrigger: data[6],
    rightTrigger: data[7],
    durationMs: view.getUint16(8, true),
    delayMs: view.getUint16(10, true),
    repeat: data[12],
  };
}
