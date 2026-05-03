/**
 * main.js
 * ─────────────────────────────────────────────────────────────────────────────
 * App entry point. Handles view routing, the analyze form, and wires up
 * all event listeners. Imports from api.js, ui.js, and history.js.
 */

import { analyzeEmail, saveAnalysis } from "./api.js";
import { renderResults, showToast, setLoadingState } from "./ui.js";
import { loadHistory } from "./history.js";

// ── State ─────────────────────────────────────────────────────────────────────
let lastResult = null;   // most recent analysis result (for save)
let lastEmail  = null;   // most recent email text (for save)

// ── View Routing ──────────────────────────────────────────────────────────────
const VIEWS = ["analyze", "history", "about"];

function showView(name) {
  VIEWS.forEach((v) => {
    const section = document.getElementById(`view-${v}`);
    const btn = document.getElementById(`nav-${v}`);
    const isActive = v === name;
    section.hidden = !isActive;
    section.classList.toggle("active", isActive);
    btn.classList.toggle("active", isActive);
  });

  if (name === "history") loadHistory();
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// ── Analyze Form ──────────────────────────────────────────────────────────────
const form       = document.getElementById("analyze-form");
const textarea   = document.getElementById("email-input");
const charCount  = document.getElementById("char-count");
const clearBtn   = document.getElementById("btn-clear");

textarea.addEventListener("input", () => {
  const n = textarea.value.length;
  charCount.textContent = `${n.toLocaleString()} character${n !== 1 ? "s" : ""}`;
});

clearBtn.addEventListener("click", () => {
  textarea.value = "";
  charCount.textContent = "0 characters";
  textarea.focus();
  document.getElementById("results-panel").hidden = true;
  lastResult = null;
  lastEmail  = null;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const emailText = textarea.value.trim();
  if (!emailText) {
    showToast("Please paste an email before analyzing.");
    textarea.focus();
    return;
  }

  setLoadingState(true);
  document.getElementById("results-panel").hidden = true;

  try {
    const result = await analyzeEmail(emailText);
    lastResult = result;
    lastEmail  = emailText;
    renderResults(result);
  } catch (err) {
    showToast("Analysis failed. Is the MCP server running?");
    console.error(err);
  } finally {
    setLoadingState(false);
  }
});

// ── Save Result ───────────────────────────────────────────────────────────────
document.getElementById("btn-save").addEventListener("click", async () => {
  if (!lastResult || !lastEmail) return;

  const btn = document.getElementById("btn-save");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    await saveAnalysis(lastEmail, lastResult);
    showToast("Result saved to history.");
    btn.textContent = "Saved ✓";
  } catch (err) {
    showToast("Failed to save result.");
    console.error(err);
    btn.disabled = false;
    btn.textContent = "Save Result";
  }
});

// ── Copy Report ───────────────────────────────────────────────────────────────
document.getElementById("btn-copy").addEventListener("click", async () => {
  if (!lastResult) return;

  const flagLines = lastResult.flags.length
    ? lastResult.flags.map((f) => `  • [${f.severity.toUpperCase()}] ${f.description}`).join("\n")
    : "  None detected.";

  const recLines = lastResult.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join("\n");

  const report = [
    "═══════════════════════════════════════",
    "  PhishGuard AI — Analysis Report",
    "═══════════════════════════════════════",
    `Risk Level:  ${lastResult.risk_level}`,
    `Confidence:  ${Math.round(lastResult.confidence * 100)}%`,
    "",
    "Summary:",
    `  ${lastResult.summary}`,
    "",
    "Red Flags:",
    flagLines,
    "",
    "Recommendations:",
    recLines,
    "═══════════════════════════════════════",
  ].join("\n");

  try {
    await navigator.clipboard.writeText(report);
    showToast("Report copied to clipboard.");
  } catch {
    showToast("Copy failed — clipboard access denied.");
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
showView("analyze");
