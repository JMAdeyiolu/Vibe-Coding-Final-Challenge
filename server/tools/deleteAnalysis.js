/**
 * deleteAnalysis.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Removes a single analysis record from storage by its UUID.
 */

import { readAll, writeAll } from "../utils/storage.js";

/**
 * @param {string} id  UUID of the record to delete
 * @returns {{ success: boolean, message: string }}
 */
export function deleteAnalysis(id) {
  const all = readAll();
  const index = all.findIndex((r) => r.id === id);

  if (index === -1) {
    return { success: false, message: `No record found with id "${id}".` };
  }

  all.splice(index, 1);
  writeAll(all);

  return { success: true, message: `Record "${id}" deleted successfully.` };
}
