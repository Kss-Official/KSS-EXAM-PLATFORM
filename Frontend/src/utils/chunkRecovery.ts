import { lazy, type ComponentType } from "react";

const CHUNK_RELOAD_KEY = "examsecure_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 15000;

export function isChunkLoadError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === "string"
        ? err
        : String(err ?? "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("ChunkLoadError")
  );
}

/**
 * Triggers a single hard reload when a stale deployment chunk is requested.
 * Returns true if a reload was initiated, false if within the cooldown window.
 */
export function reloadOnceForChunkError(): boolean {
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
    const now = Date.now();
    if (now - lastReload < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Ignore sessionStorage restrictions; still attempt a reload once
  }
  window.location.reload();
  return true;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (err) {
      if (isChunkLoadError(err) && reloadOnceForChunkError()) {
        // Keep Suspense fallback visible while the browser reloads fresh assets
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
