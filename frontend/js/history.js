/**
 * history.js
 * ─────────────────────────────────────────────────────────────────────────────
 * History view logic — loads, filters, renders, and handles deletion.
 */

import { getHistory, deleteAnalysis } from "./api.js?v=3";
import { renderHistoryCard, showToast } from "./ui.js?v=3";

let allRecords = []; // local cache

// ── Load & Render ─────────────────────────────────────────────────────────────

/**
 * Fetch all records and re-render the history list.
 */
export async function loadHistory() {
  console.log("🟡 [History] Fetching history from MCP server...");
  try {
    const response = await getHistory({ limit: 100 });
    console.log("🟢 [History] Received response:", response);
    
    // The API returns an envelope: { records: [...], total_stored: N, ... }
    allRecords = response.records || [];
    console.log(`🟢 [History] Extracted ${allRecords.length} records.`, allRecords);
  } catch (err) {
    console.error("🔴 [History] Failed to load history:", err);
    allRecords = [];
  }
  applyFilters();
}

/**
 * Apply current search/filter state and re-render the visible card list.
 */
export function applyFilters() {
  const search = document.getElementById("history-search").value.trim().toLowerCase();
  const activeChip = document.querySelector(".filter-chips .chip.active");
  const riskFilter = activeChip?.dataset.risk ?? "all";

  let filtered = allRecords;

  if (riskFilter !== "all") {
    filtered = filtered.filter((r) => r.risk_level === riskFilter);
  }
  if (search) {
    filtered = filtered.filter((r) => {
      return (
        r.email_snippet.toLowerCase().includes(search) ||
        r.summary?.toLowerCase().includes(search) ||
        r.flags?.some((f) => f.description.toLowerCase().includes(search))
      );
    });
  }

  renderList(filtered);
}

const emptyState = document.getElementById("history-empty");

/**
 * Render the filtered record array into the DOM.
 * @param {object[]} records
 */
function renderList(records) {
  const container = document.getElementById("history-list");
  container.innerHTML = "";

  if (records.length === 0) {
    container.appendChild(emptyState);
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  records.forEach((record) => {
    const card = renderHistoryCard(record);
    container.appendChild(card);
  });
}

// ── Event Delegation: Delete ──────────────────────────────────────────────────

document.getElementById("history-list").addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-delete");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!confirm("Delete this analysis record?")) return;

  try {
    const result = await deleteAnalysis(id);
    if (result.success) {
      allRecords = allRecords.filter((r) => r.id !== id);
      applyFilters();
      showToast("Record deleted.");
    } else {
      showToast(`Error: ${result.message}`);
    }
  } catch (err) {
    showToast("Failed to delete record.");
    console.error(err);
  }
});

// ── Search & Filter Controls ──────────────────────────────────────────────────

document.getElementById("history-search").addEventListener("input", applyFilters);

document.querySelector(".filter-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".filter-chips .chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  applyFilters();
});
