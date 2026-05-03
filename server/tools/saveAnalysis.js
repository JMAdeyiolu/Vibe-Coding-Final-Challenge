/**
 * saveAnalysis.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MCP tool handler: save_analysis
 *
 * Responsibility:
 *   Accept an email + its analysis result, build a storage record, persist it
 *   to analyses.json, and return the saved record (including generated id and
 *   timestamp) so the caller knows exactly what was stored.
 *
 * What gets stored vs. what doesn't:
 *   - Stored:   a 200-character snippet of the email (for history preview)
 *   - Not stored: the full email text (keeps the file size manageable and
 *                 avoids retaining sensitive content longer than needed)
 */

import { v4 as uuidv4 } from "uuid";
import { readAll, writeAll } from "../utils/storage.js";

// Only the first N characters of the email are stored in the record.
const SNIPPET_LENGTH = 200;

/**
 * Save an analysis result to the JSON store.
 *
 * @param {string} emailText   The original raw email that was analyzed
 * @param {object} result      The result object returned by analyzeEmail()
 * @returns {object}           The full saved record (id, timestamp, …)
 * @throws {Error}             If storage write fails
 */
export function saveAnalysis(emailText, result) {
  // Validate inputs before touching disk
  if (typeof emailText !== "string" || emailText.trim().length === 0) {
    throw new Error("saveAnalysis: email_text must be a non-empty string");
  }
  if (!result || typeof result !== "object") {
    throw new Error("saveAnalysis: result must be an object");
  }

  const record = {
    id:              uuidv4(),
    saved_at:        new Date().toISOString(),
    analyzed_at:     result.analyzed_at ?? new Date().toISOString(),
    email_snippet:   emailText.slice(0, SNIPPET_LENGTH).replace(/\s+/g, " ").trim(),
    risk_level:      result.risk_level,
    confidence:      result.confidence,
    score:           result.score ?? null,
    flags_count:     result.flags_count ?? result.flags?.length ?? 0,
    flags:           result.flags ?? [],
    summary:         result.summary,
    recommendations: result.recommendations ?? [],
  };

  const all = readAll();
  all.unshift(record);   // newest record at index 0 → no sort needed on retrieval
  writeAll(all);

  return record;
}
