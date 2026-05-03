/**
 * storage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * File-based JSON persistence layer for PhishGuard AI.
 *
 * Design decisions:
 *  - Synchronous I/O — this is a single-user local CLI tool; sync keeps the
 *    code simple and avoids async concurrency bugs.
 *  - Atomic writes — we write to a .tmp file first and then rename into place.
 *    This guarantees the store is never left in a half-written, corrupt state
 *    if the process crashes mid-write.
 *  - Auto-init — the data directory and JSON file are created on first access
 *    so the user doesn't need a setup step.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Paths ─────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = resolve(__dirname, "../../data");
const DATA_FILE = resolve(DATA_DIR, "analyses.json");
const TMP_FILE  = resolve(DATA_DIR, "analyses.json.tmp");

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Ensure the data directory and JSON file exist.
 * Called before every read or write so callers never need to worry about init.
 */
function ensureStore() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, "[]", "utf-8");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read every record from the JSON store.
 * Returns an empty array if the file is missing or corrupt.
 *
 * @returns {object[]}
 */
export function readAll() {
  ensureStore();
  try {
    const raw = readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    // Guard: ensure we always return an array even if the file is corrupt
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[storage] Failed to read store, returning empty array:", err.message);
    return [];
  }
}

/**
 * Atomically overwrite the store with a new array of records.
 * Writes to a .tmp file first, then renames into place.
 *
 * @param {object[]} records
 * @throws {Error} if the write or rename fails
 */
export function writeAll(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("[storage] writeAll expects an array");
  }
  ensureStore();
  writeFileSync(TMP_FILE, JSON.stringify(records, null, 2), "utf-8");
  renameSync(TMP_FILE, DATA_FILE);
}

/**
 * Find a single record by its UUID.
 *
 * @param {string} id
 * @returns {object|undefined}
 */
export function findById(id) {
  return readAll().find((r) => r.id === id);
}
