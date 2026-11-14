// SPDX-License-Identifier: GPL-3.0-or-later
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MsaTokens } from './auth/msa.ts';
import type { XblToken } from './auth/xboxLive.ts';
import type { GssvSessionLogin, ResolutionMode } from './xcloud/gssv.ts';

export interface UserProfile {
  gamertag: string;
  xuid: string;
  gamerpicUrl: string;
  gamerscore: string;
  subscription: string;
  playtimeRemainingSec: number;
  playtimeMaxSec: number;
  playtimeUnlimited: boolean;
}

export interface StoredSession {
  id: string;
  demoMode: boolean;
  msaTokens?: MsaTokens;
  xblUser?: XblToken;
  xblProfileXsts?: XblToken;
  gssvXsts?: XblToken;
  gssvCloud?: GssvSessionLogin;
  gssvHome?: GssvSessionLogin;
  profile?: UserProfile;
  loginCountry: string;
  activeSessionPath?: string;
  activeSessionIsHome?: boolean;
  activeResolution: ResolutionMode;
  createdAt: number;
  updatedAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.psbox-data');
const STORE_FILE = path.join(DATA_DIR, 'sessions.enc');
const SECRET_FILE = path.join(DATA_DIR, 'machine.key');

function getKey(): Buffer {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let secret = '';
  if (fs.existsSync(SECRET_FILE)) {
    secret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } else {
    secret = randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  }
  return scryptSync(secret, 'psbox-cloud-gaming-salt', 32);
}

const sessions = new Map<string, StoredSession>();

function loadFromDisk() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const [ivHex, tagHex, dataHex] = raw.split(':');
    if (!ivHex || !tagHex || !dataHex) return;
    const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    const parsed = JSON.parse(dec.toString('utf8')) as Record<string, StoredSession>;
    for (const [k, v] of Object.entries(parsed)) sessions.set(k, v);
  } catch {
    // Start fresh if unreadable
  }
}

export function saveSessionsToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj: Record<string, StoredSession> = {};
    for (const [k, v] of sessions.entries()) obj[k] = v;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    fs.writeFileSync(
      STORE_FILE,
      `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`,
      { mode: 0o600 },
    );
  } catch {
    // Non-fatal
  }
}

loadFromDisk();

export function getOrCreateSession(id?: string): StoredSession {
  if (id && sessions.has(id)) {
    return sessions.get(id)!;
  }
  const newId = id || randomBytes(16).toString('hex');
  const s: StoredSession = {
    id: newId,
    demoMode: false,
    loginCountry: '',
    activeResolution: '1080p',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(newId, s);
  return s;
}

export function getSession(id?: string): StoredSession | undefined {
  return id ? sessions.get(id) : undefined;
}

export function deleteSession(id: string) {
  sessions.delete(id);
  saveSessionsToDisk();
}
