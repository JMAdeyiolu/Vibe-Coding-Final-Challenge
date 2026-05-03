/**
 * ui.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DOM rendering helpers. All functions take data in, return or mutate DOM out.
 * Nothing in here fetches data or owns state.
 */

// ── Risk / Severity helpers ───────────────────────────────────────────────────

const RISK_ICONS = { Low: "🟢", Medium: "🟡", High: "🟠", Critical: "🔴" };
const SEV_ICONS  = { low: "ℹ️",  medium: "⚠️",  high: "🚨", critical: "🛑" };

/**
 * Render the results panel with analysis data.
 * @param {object} result  Return value of analyzeEmail()
 */
export function renderResults(result) {
  const panel = document.getElementById("results-panel");

  // Risk badge
  const badge = document.getElementById("result-risk-badge");
  badge.textContent = `${RISK_ICONS[result.risk_level] ?? ""} ${result.risk_level}`;
  badge.setAttribute("data-risk", result.risk_level);

  // Summary
  document.getElementById("result-summary").textContent = result.summary;

  // Confidence bar
  const pct = Math.round(result.confidence * 100);
  document.getElementById("confidence-fill").style.width = `${pct}%`;
  document.getElementById("confidence-pct").textContent = `${pct}%`;
  const bar = document.getElementById("confidence-bar");
  bar.setAttribute("aria-valuenow", pct);

  // Flags
  const flagsList = document.getElementById("flags-list");
  const flagsCount = document.getElementById("flags-count");
  flagsList.innerHTML = "";
  flagsCount.textContent = result.flags.length;

  if (result.flags.length === 0) {
    flagsList.innerHTML = `<li class="flag-item"><span class="flag-icon">✅</span><span class="flag-text">No phishing indicators detected.</span></li>`;
  } else {
    result.flags.forEach((flag) => {
      const li = document.createElement("li");
      li.className = "flag-item";
      li.innerHTML = `
        <span class="flag-icon" aria-hidden="true">${SEV_ICONS[flag.severity] ?? "⚠️"}</span>
        <span class="flag-text">${escapeHtml(flag.description)}</span>
        <span class="severity-chip" data-sev="${flag.severity}">${flag.severity}</span>
      `;
      flagsList.appendChild(li);
    });
  }

  // Recommendations
  const recsList = document.getElementById("recs-list");
  recsList.innerHTML = "";
  result.recommendations.forEach((rec) => {
    const li = document.createElement("li");
    li.textContent = rec;
    recsList.appendChild(li);
  });

  // Show panel
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Render a single history card element.
 * @param {object} record  A saved analysis record
 * @returns {HTMLElement}
 */
export function renderHistoryCard(record) {
  const card = document.createElement("div");
  card.className = "history-card";
  card.dataset.id = record.id;
  card.dataset.risk = record.risk_level;

  const ts = new Date(record.saved_at).toLocaleString(undefined, {
    dateStyle: "medium", timeStyle: "short",
  });

  const flagsHtml = record.flags.length
    ? record.flags.map((f) => `
        <li class="flag-item">
          <span class="flag-icon" aria-hidden="true">${SEV_ICONS[f.severity] ?? "⚠️"}</span>
          <span class="flag-text">${escapeHtml(f.description)}</span>
          <span class="severity-chip" data-sev="${f.severity}">${f.severity}</span>
        </li>`).join("")
    : `<li class="flag-item"><span class="flag-text">No flags.</span></li>`;

  const recsHtml = record.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("");

  card.innerHTML = `
    <div class="history-card-header" role="button" aria-expanded="false" tabindex="0">
      <span class="card-risk-badge" data-risk="${record.risk_level}">${RISK_ICONS[record.risk_level] ?? ""} ${record.risk_level}</span>
      <span class="card-snippet">${escapeHtml(record.email_snippet)}</span>
      <span class="card-timestamp">${ts}</span>
      <span class="card-chevron" aria-hidden="true">▾</span>
    </div>
    <div class="history-card-body">
      <ul class="card-body-flags flags-list">${flagsHtml}</ul>
      <ol class="card-recs">${recsHtml}</ol>
      <div class="card-footer">
        <button class="btn btn-ghost btn-sm btn-delete" data-id="${record.id}" aria-label="Delete this record">Delete</button>
      </div>
    </div>
  `;

  // Toggle expand/collapse
  const header = card.querySelector(".history-card-header");
  header.addEventListener("click", () => {
    const expanded = card.classList.toggle("expanded");
    header.setAttribute("aria-expanded", expanded);
  });
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); header.click(); }
  });

  return card;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;

/**
 * Show a brief toast notification.
 * @param {string} message
 * @param {number} [duration=3000]
 */
export function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, duration);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Set the analyze button into a loading state.
 * @param {boolean} loading
 */
export function setLoadingState(loading) {
  const btn = document.getElementById("btn-analyze");
  const label = btn.querySelector(".btn-label");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = loading;
  label.textContent = loading ? "Analyzing…" : "Analyze Email";
  spinner.hidden = !loading;
}
