import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DetailedReportPayload } from "./amasha-reportApi";

const KEYCHAIN_KEY = "amasha-offline-reports-key";
const LEGACY_PREFIX = "amasha-pending-reports:";
const DB_NAME = "amasha-offline-reports.db";

export const PENDING_SYNCHRONIZATION = "PENDING_SYNCHRONIZATION" as const;

export interface OfflineDraft {
  id: string;
  payload: DetailedReportPayload;
  savedAt: string;
  status: typeof PENDING_SYNCHRONIZATION;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_reports (
          id TEXT PRIMARY KEY NOT NULL,
          user_key TEXT NOT NULL,
          status TEXT NOT NULL,
          saved_at TEXT NOT NULL,
          cipher TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS pending_reports_user
          ON pending_reports (user_key, saved_at);
      `);

      return db;
    })();
  }

  return dbPromise;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function persistKey(hex: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(KEYCHAIN_KEY, hex, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return;
  }

  await AsyncStorage.setItem(KEYCHAIN_KEY, hex);
}

async function readPersistedKey(): Promise<string | null> {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(KEYCHAIN_KEY);
  }

  return AsyncStorage.getItem(KEYCHAIN_KEY);
}

async function loadOrCreateKey(): Promise<Uint8Array> {
  const stored = await readPersistedKey();

  if (stored) {
    return fromHex(stored);
  }

  const generated = await Crypto.getRandomBytesAsync(32);

  await persistKey(toHex(generated));

  return generated;
}

function xorWithKey(data: Uint8Array, key: Uint8Array): Uint8Array {
  const output = new Uint8Array(data.length);

  for (let index = 0; index < data.length; index += 1) {
    output[index] = data[index] ^ key[index % key.length];
  }

  return output;
}

async function encryptJson(value: unknown): Promise<string> {
  const key = await loadOrCreateKey();
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const subtle = globalThis.crypto?.subtle;

  if (subtle) {
    try {
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const cryptoKey = await subtle.importKey(
        "raw",
        key as BufferSource,
        "AES-GCM",
        false,
        ["encrypt"]
      );
      const cipher = new Uint8Array(
        await subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded)
      );
      const packed = new Uint8Array(1 + iv.length + cipher.length);

      packed[0] = 1;
      packed.set(iv, 1);
      packed.set(cipher, 1 + iv.length);

      return bytesToBase64(packed);
    } catch {
      // Fall through to the keystore-backed XOR envelope.
    }
  }

  const packed = new Uint8Array(1 + encoded.length);

  packed[0] = 0;
  packed.set(xorWithKey(encoded, key), 1);

  return bytesToBase64(packed);
}

async function decryptJson<T>(cipherText: string): Promise<T> {
  const key = await loadOrCreateKey();
  const packed = base64ToBytes(cipherText);
  const version = packed[0];
  const subtle = globalThis.crypto?.subtle;

  if (version === 1 && subtle) {
    const iv = packed.slice(1, 13);
    const body = packed.slice(13);
    const cryptoKey = await subtle.importKey(
      "raw",
      key as BufferSource,
      "AES-GCM",
      false,
      ["decrypt"]
    );
    const plain = await subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, body);

    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }

  const plain = xorWithKey(packed.slice(1), key);

  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

async function migrateLegacy(userKey: string): Promise<void> {
  const raw = await AsyncStorage.getItem(`${LEGACY_PREFIX}${userKey}`);

  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as OfflineDraft[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      await AsyncStorage.removeItem(`${LEGACY_PREFIX}${userKey}`);
      return;
    }

    const db = await openDb();

    for (const draft of parsed) {
      const cipher = await encryptJson(draft.payload);

      await db.runAsync(
        `INSERT OR REPLACE INTO pending_reports (id, user_key, status, saved_at, cipher)
         VALUES (?, ?, ?, ?, ?)`,
        draft.id,
        userKey,
        PENDING_SYNCHRONIZATION,
        draft.savedAt,
        cipher
      );
    }
  } finally {
    await AsyncStorage.removeItem(`${LEGACY_PREFIX}${userKey}`);
  }
}

export async function listSecureDrafts(userKey: string): Promise<OfflineDraft[]> {
  await migrateLegacy(userKey);

  const db = await openDb();
  const rows = await db.getAllAsync<{
    id: string;
    status: string;
    saved_at: string;
    cipher: string;
  }>(
    `SELECT id, status, saved_at, cipher
       FROM pending_reports
      WHERE user_key = ?
      ORDER BY saved_at DESC`,
    userKey
  );

  const drafts: OfflineDraft[] = [];

  for (const row of rows) {
    try {
      drafts.push({
        id: row.id,
        savedAt: row.saved_at,
        status: PENDING_SYNCHRONIZATION,
        payload: await decryptJson<DetailedReportPayload>(row.cipher),
      });
    } catch {
      // Skip a corrupted row rather than blocking the rest of the queue.
    }
  }

  return drafts;
}

export async function insertSecureDraft(
  userKey: string,
  payload: DetailedReportPayload
): Promise<OfflineDraft> {
  await migrateLegacy(userKey);

  const draft: OfflineDraft = {
    id: `OFFLINE-${Date.now().toString(36).toUpperCase()}`,
    payload,
    savedAt: new Date().toISOString(),
    status: PENDING_SYNCHRONIZATION,
  };
  const cipher = await encryptJson(payload);
  const db = await openDb();

  await db.runAsync(
    `INSERT INTO pending_reports (id, user_key, status, saved_at, cipher)
     VALUES (?, ?, ?, ?, ?)`,
    draft.id,
    userKey,
    draft.status,
    draft.savedAt,
    cipher
  );

  return draft;
}

export async function deleteSecureDraft(
  userKey: string,
  id: string
): Promise<void> {
  const db = await openDb();

  await db.runAsync(
    `DELETE FROM pending_reports WHERE user_key = ? AND id = ?`,
    userKey,
    id
  );
}
