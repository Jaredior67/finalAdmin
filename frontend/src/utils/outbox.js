/* ============================================================================
   Offline outbox.

   A request filed while the network was down used to be rejected and lost, and
   the banner told the user it would sync later — it never did, because nothing
   queued it. This is the queue that promise referred to.

   Design notes
   - Each entry carries an idempotency key minted once, when the form was
     filled in. A retry sends the same key, so if the first attempt actually
     reached the server and the response was lost, the retry returns the
     original ticket instead of creating a second one. The server has a unique
     index on the column to make that true even under concurrent retries.
   - The key is minted per submission attempt, not per render, so a user who
     files three requests gets three keys.
   - Entries are only removed once the server has confirmed them.
   - The queue is bounded. Past MAX_ENTRIES the oldest unsent entry is dropped
     with a warning rather than growing localStorage without limit.
   ========================================================================== */
import { apiCreateJobRequest } from '../backend/api';

const STORAGE_KEY = 'fixit_pdas_outbox_v1';
const MAX_ENTRIES = 20;

/** A short, URL-safe, collision-resistant key. */
export const newIdempotencyKey = () => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const readOutbox = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOutbox = (entries) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* storage full or unavailable — the request is lost, and the caller has
       already been told the submission failed. */
  }
};

export const outboxSize = () => readOutbox().length;

/**
 * Record a submission that could not reach the server.
 * @returns {boolean} false when the entry could not be stored, meaning the
 *          submission is genuinely lost and the caller must say so.
 */
export function enqueue(payload) {
  const entries = readOutbox();
  const entry = {
    idempotencyKey: payload.idempotencyKey || newIdempotencyKey(),
    payload: { ...payload },
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null
  };
  const next = [...entries, entry];
  if (next.length > MAX_ENTRIES) {
    // Keep the newest, but say so rather than pretending nothing was lost.
    console.warn(
      `[outbox] ${next.length - MAX_ENTRIES} queued request(s) dropped: the limit is ${MAX_ENTRIES}.`
    );
  }
  writeOutbox(next);
  return next.length <= MAX_ENTRIES;
}

export function discard(idempotencyKey) {
  writeOutbox(readOutbox().filter((e) => e.idempotencyKey !== idempotencyKey));
}

/**
 * Try to send everything that is waiting.
 * @returns {Promise<{sent:number, failed:number, duplicates:number}>}
 */
export async function flushOutbox() {
  const entries = readOutbox();
  if (entries.length === 0) return { sent: 0, failed: 0, duplicates: 0 };

  const remaining = [];
  let sent = 0;
  let failed = 0;
  let duplicates = 0;

  for (const entry of entries) {
    try {
      const res = await apiCreateJobRequest({
        ...entry.payload,
        idempotencyKey: entry.idempotencyKey
      });
      if (res?.duplicate) duplicates += 1;
      else sent += 1;
      // Confirmed by the server, so it leaves the queue.
    } catch (err) {
      // Still not going through. Keep it, but stop after a few attempts so a
      // permanently bad payload does not retry forever.
      const attempts = (entry.attempts || 0) + 1;
      failed += 1;
      if (attempts >= 5) {
        console.warn(
          `[outbox] giving up on ${entry.idempotencyKey} after ${attempts} attempts: ${err?.message}`
        );
        continue;
      }
      remaining.push({ ...entry, attempts, lastError: err?.message || String(err) });
    }
  }

  writeOutbox(remaining);
  return { sent, failed, duplicates };
}

/** True when the browser believes it has no connection. */
export const isOffline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Submit, or queue if that is not possible.
 *
 * The idempotency key is minted here and travels with the payload, so the same
 * key is used for the first attempt and every retry of it.
 */
export async function submitOrQueue(payload) {
  const withKey = { ...payload, idempotencyKey: payload.idempotencyKey || newIdempotencyKey() };

  if (isOffline()) {
    const stored = enqueue(withKey);
    return {
      queued: true,
      stored,
      idempotencyKey: withKey.idempotencyKey,
      result: null
    };
  }

  try {
    const result = await apiCreateJobRequest(withKey);
    return { queued: false, stored: true, idempotencyKey: withKey.idempotencyKey, result };
  } catch (err) {
    /* A rejected request is not retried; a fault or a network failure is.
       0 means fetch never got a response, 5xx means the server failed. Both are
       worth another attempt. A 4xx means the request itself is wrong, and
       sending it again would only be refused again. */
    const status = Number(err?.status ?? 0);
    const worthRetrying = status === 0 || status >= 500;
    if (worthRetrying) {
      const stored = enqueue(withKey);
      return { queued: true, stored, idempotencyKey: withKey.idempotencyKey, result: null, error: err };
    }
    return { queued: false, stored: false, idempotencyKey: withKey.idempotencyKey, result: null, error: err };
  }
}
