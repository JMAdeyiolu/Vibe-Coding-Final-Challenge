/**
 * getAnalysisHistory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MCP tool handler: get_analysis_history
 *
 * Responsibility:
 *   Read saved analysis records from the JSON store and return a filtered,
 *   paginated slice. Records are always newest-first (guaranteed by the insert
 *   order in saveAnalysis.js).
 *
 * Filter order: risk_level → search → limit (applied in that sequence).
 */

import { readAll } from "../utils/storage.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

const VALID_RISK_LEVELS = new Set(["Low", "Medium", "High", "Critical"]);

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Retrieve saved analysis records with optional filtering.
 *
 * @param {object} opts
 * @param {number}  [opts.limit=20]      Max number of records to return (1–100)
 * @param {string}  [opts.risk_level]    Filter to only records with this risk level
 * @param {string}  [opts.search]        Keyword to match against snippet, summary, or flag descriptions
 * @param {string}  [opts.since]         ISO 8601 date string — only return records saved after this time
 *
 * @returns {{
 *   records:      object[],
 *   total_stored: number,
 *   returned:     number,
 *   filters_applied: object,
 * }}
 */
export function getAnalysisHistory({ limit, risk_level, search, since } = {}) {
  // ── Input sanitisation ──────────────────────────────────────────────────────
  const safeLimit = clampLimit(limit);

  if (risk_level !== undefined && !VALID_RISK_LEVELS.has(risk_level)) {
    throw new Error(`getAnalysisHistory: invalid risk_level "${risk_level}". Must be one of: ${[...VALID_RISK_LEVELS].join(", ")}`);
  }

  let sinceDate = null;
  if (since) {
    sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      throw new Error(`getAnalysisHistory: invalid "since" value "${since}". Must be a valid ISO 8601 date string.`);
    }
  }

  // ── Read & filter ───────────────────────────────────────────────────────────
  const all = readAll();
  const totalStored = all.length;

  let results = all;

  // Filter 1: risk level
  if (risk_level) {
    results = results.filter((r) => r.risk_level === risk_level);
  }

  // Filter 2: date (since)
  if (sinceDate) {
    results = results.filter((r) => {
      const savedAt = new Date(r.saved_at ?? r.timestamp);
      return !isNaN(savedAt.getTime()) && savedAt > sinceDate;
    });
  }

  // Filter 3: keyword search (case-insensitive)
  if (search && search.trim().length > 0) {
    const query = search.trim().toLowerCase();
    results = results.filter((r) => {
      const inSnippet  = r.email_snippet?.toLowerCase().includes(query);
      const inSummary  = r.summary?.toLowerCase().includes(query);
      const inFlags    = r.flags?.some((f) => f.description?.toLowerCase().includes(query) || f.id?.includes(query));
      return inSnippet || inSummary || inFlags;
    });
  }

  // Filter 4: pagination
  const paginated = results.slice(0, safeLimit);

  return {
    records:         paginated,
    total_stored:    totalStored,
    returned:        paginated.length,
    filters_applied: {
      risk_level: risk_level ?? null,
      search:     search     ?? null,
      since:      since      ?? null,
      limit:      safeLimit,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampLimit(raw) {
  if (raw === undefined || raw === null) return DEFAULT_LIMIT;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}
