/**
 * MeMyMate by ARCT — 30-day account lifecycle & one-tap JSON backups.
 *
 * Guests get a device-local "account" (creation date + distinct active days,
 * stored in localStorage). Signed-in users get their Firebase creation date.
 * Either way, the dashboard banner and Settings can export every deck as a
 * single JSON file with one tap.
 */

import type { Knight } from '@/types';

export const ACCOUNT_CYCLE_DAYS = 30;

const ACCOUNT_KEY = 'memy-mate-account-v1';
const ACTIVE_DAYS_KEY = 'memy-mate-active-days-v1';
const ACTIVE_DAYS_LIMIT = 400;

export type AccountInfo = {
  createdAt: string; // ISO timestamp of account creation
  daysActive: number; // distinct days the app was opened
  daysSinceCreation: number;
  dayOfCycle: number; // 1..30
  daysRemaining: number; // 0..29
};

export type BackupMode = 'guest' | 'cloud';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — lifecycle info stays for this session only.
  }
}

/** Get (or lazily create) the on-device guest account. */
export function ensureLocalAccount(): { createdAt: string } {
  const account = readJson<{ createdAt?: string }>(ACCOUNT_KEY, {});
  if (account.createdAt) return { createdAt: account.createdAt };
  const fresh = { createdAt: new Date().toISOString() };
  writeJson(ACCOUNT_KEY, fresh);
  return fresh;
}

/** Record today as an active day; returns the distinct active-day count. */
export function recordActiveDay(now: Date = new Date()): number {
  const today = now.toISOString().slice(0, 10);
  const days = readJson<string[]>(ACTIVE_DAYS_KEY, []);
  if (!days.includes(today)) {
    days.push(today);
    days.sort();
    writeJson(ACTIVE_DAYS_KEY, days.slice(-ACTIVE_DAYS_LIMIT));
  }
  return days.length;
}

function calendarDayDiff(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / 86_400_000);
}

/**
 * Snapshot of the 30-day lifecycle. Pass a Firebase `creationTime` for
 * signed-in users; guests fall back to the on-device account.
 */
export function getAccountInfo(creationTime?: string | null, now: Date = new Date()): AccountInfo {
  const createdAt = creationTime ?? ensureLocalAccount().createdAt;
  const created = new Date(createdAt);
  const valid = !Number.isNaN(created.getTime());
  const daysSinceCreation = valid ? Math.max(0, calendarDayDiff(created, now)) : 0;
  const dayOfCycle = Math.min(ACCOUNT_CYCLE_DAYS, daysSinceCreation + 1);
  const daysActive = Math.max(1, recordActiveDay(now));
  return {
    createdAt: valid ? createdAt : now.toISOString(),
    daysActive,
    daysSinceCreation,
    dayOfCycle,
    daysRemaining: Math.max(0, ACCOUNT_CYCLE_DAYS - dayOfCycle),
  };
}

export type BackupPayload = {
  app: 'MeMyMate by ARCT';
  format: 'memy-mate-backup/1';
  exportedAt: string;
  account: {
    mode: BackupMode;
    createdAt: string;
    daysActive: number;
    dayOfCycle: number;
    daysRemaining: number;
  };
  knights: Knight[];
};

export function buildBackup(knights: Knight[], info: AccountInfo, mode: BackupMode): BackupPayload {
  return {
    app: 'MeMyMate by ARCT',
    format: 'memy-mate-backup/1',
    exportedAt: new Date().toISOString(),
    account: {
      mode,
      createdAt: info.createdAt,
      daysActive: info.daysActive,
      dayOfCycle: info.dayOfCycle,
      daysRemaining: info.daysRemaining,
    },
    knights,
  };
}

/** Download every deck as a single JSON file. Returns the filename used. */
export function downloadBackup(knights: Knight[], info: AccountInfo, mode: BackupMode): string {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `memy-mate-backup-${date}.json`;
  const blob = new Blob([JSON.stringify(buildBackup(knights, info, mode), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}
