/**
 * api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communication layer between the frontend and the AI/MCP host.
 *
 * In a full integration this module would call the Gemini API (or another
 * MCP-compatible host) which in turn calls the MCP server tools.
 * For development, it falls back to calling the tool logic directly via a
 * local HTTP shim or mock responses.
 *
 * All public functions return a Promise that resolves to a typed result object.
 */

// ── Config ────────────────────────────────────────────────────────────────────
// When running with a real MCP host, point this at the host's HTTP endpoint.
const API_BASE = window.PHISHGUARD_API_BASE ?? "http://localhost:3001";

/**
 * Internal helper — POST to the local shim server.
 * @param {string} tool   Tool name to invoke
 * @param {object} params Tool parameters
 */
async function callTool(tool, params) {
  const res = await fetch(`${API_BASE}/tool/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tool "${tool}" failed (${res.status}): ${err}`);
  }

  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyze an email for phishing indicators.
 * @param {string} emailText
 * @returns {Promise<{risk_level, confidence, flags, summary, recommendations}>}
 */
export async function analyzeEmail(emailText) {
  return callTool("analyze_email", { email_text: emailText });
}

/**
 * Save an analysis result to storage.
 * @param {string} emailText
 * @param {object} result
 * @returns {Promise<object>} The saved record
 */
export async function saveAnalysis(emailText, result) {
  return callTool("save_analysis", { email_text: emailText, result });
}

/**
 * Retrieve history records.
 * @param {{ limit?: number, risk_level?: string, search?: string }} opts
 * @returns {Promise<object[]>}
 */
export async function getHistory(opts = {}) {
  return callTool("get_history", opts);
}

/**
 * Delete a history record by ID.
 * @param {string} id
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function deleteAnalysis(id) {
  return callTool("delete_analysis", { id });
}
