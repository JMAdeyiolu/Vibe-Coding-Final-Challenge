/**
 * getHistory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Retrieves saved analysis records with optional filtering.
 */

import { readAll } from "../utils/storage.js";

/**
 * @param {{ limit?: number, risk_level?: string, search?: string }} opts
 * @returns {object[]}
 */
export function getHistory({ limit = 20, risk_level, search } = {}) {
  let records = readAll();

  if (risk_level) {
    records = records.filter((r) => r.risk_level === risk_level);
  }

  if (search) {
    const query = search.toLowerCase();
    records = records.filter((r) => {
      const inSnippet = r.email_snippet?.toLowerCase().includes(query);
      const inFlags = r.flags?.some((f) => f.description.toLowerCase().includes(query));
      const inSummary = r.summary?.toLowerCase().includes(query);
      return inSnippet || inFlags || inSummary;
    });
  }

  return records.slice(0, limit);
}
