/**
 * run.js — PhishGuard AI Test Runner
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every sample in samples.js directly through analyzeEmail() and prints
 * a formatted report. No MCP server or network connection needed.
 *
 * Usage:
 *   node tests/run.js              — run all samples
 *   node tests/run.js phishing     — run only phishing samples
 *   node tests/run.js clean        — run only clean samples
 *   node tests/run.js "PayPal"     — run samples whose name includes "PayPal"
 *   LOG_LEVEL=debug node tests/run.js  — verbose output
 *
 * Exit code: 0 if all expected risk levels matched, 1 if any mismatched.
 */

import { analyzeEmail } from "../server/tools/analyzeEmail.js";
import { SAMPLES }      from "./samples.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const USE_COLOR = process.stdout.isTTY ?? false;
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", gray: "\x1b[90m",
};
const p = (code, str) => USE_COLOR ? `${code}${str}${C.reset}` : str;

const RISK_COLOR = {
  Low:      C.green,
  Medium:   C.yellow,
  High:     C.magenta,
  Critical: C.red,
};

function riskBadge(level) {
  return p((RISK_COLOR[level] ?? "") + C.bold, `[${(level ?? "?").padEnd(8)}]`);
}

function bar(score, max = 100, width = 30) {
  const filled = Math.round((score / max) * width);
  const empty  = width - filled;
  const color  = score >= 75 ? C.red : score >= 50 ? C.magenta : score >= 25 ? C.yellow : C.green;
  return USE_COLOR
    ? `${C.gray}[${ p(color, "█".repeat(filled)) }${" ".repeat(empty)}${C.gray}]${C.reset}`
    : `[${"█".repeat(filled)}${" ".repeat(empty)}]`;
}

function hr(char = "─", len = 72) {
  return p(C.gray, char.repeat(len));
}

// ── Filter samples from CLI arg ───────────────────────────────────────────────
const filter = process.argv[2]?.toLowerCase() ?? "all";
const samples = filter === "all"
  ? SAMPLES
  : SAMPLES.filter((s) =>
      s.category === filter || s.name.toLowerCase().includes(filter)
    );

if (samples.length === 0) {
  console.log(`No samples matched filter: "${filter}"`);
  process.exit(0);
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log("\n" + p(C.bold + C.cyan, "  PhishGuard AI — Test Runner"));
console.log(p(C.gray, `  Samples: ${samples.length} / ${SAMPLES.length}   Filter: ${filter}`));
console.log(hr("═") + "\n");

const results = [];

for (const sample of samples) {
  const start  = Date.now();
  let result, err;

  try {
    result = analyzeEmail(sample.email);
  } catch (e) {
    err = e;
  }

  const ms      = Date.now() - start;
  const matched = result?.risk_level === sample.expected_risk;
  const status  = err     ? p(C.red, "ERROR")
                : matched ? p(C.green + C.bold, "PASS ")
                :            p(C.yellow + C.bold, "WARN ");

  results.push({ sample, result, err, matched, ms });

  // ── Sample header ──────────────────────────────────────────────────────────
  console.log(p(C.bold, `${status}  ${sample.name}`));
  console.log(p(C.gray, `       ${sample.category.toUpperCase()} · ${sample.description}`));

  if (err) {
    console.log(p(C.red, `       ERROR: ${err.message}`));
    console.log(hr() + "\n");
    continue;
  }

  // ── Score bar ──────────────────────────────────────────────────────────────
  const scoreStr = String(result.score).padStart(3);
  console.log(
    `       Score: ${p(C.bold, scoreStr)} / ${result.max_score}  ` +
    bar(result.score) +
    `  Risk: ${riskBadge(result.risk_level)}` +
    (matched ? "" : p(C.yellow, `  (expected: ${sample.expected_risk})`)  )
  );

  // ── Flags table ────────────────────────────────────────────────────────────
  if (result.flags.length === 0) {
    console.log(p(C.green, "       ✓ No phishing indicators detected"));
  } else {
    console.log(`       ${p(C.bold, "Flags:")} (${result.flags.length} triggered)`);
    for (const entry of result.score_breakdown) {
      const sev = entry.severity ?? "";
      const sevColor = { low: C.green, medium: C.yellow, high: C.magenta, critical: C.red }[sev] ?? "";
      const pts = String(entry.points_awarded).padStart(2);
      console.log(
        `         ${p(sevColor, "●")} ${p(C.bold, entry.flag_id.padEnd(26))}` +
        `${p(C.cyan, `+${pts}pts`)}  ${p(C.gray, entry.weight_label)}`
      );
    }
  }

  // ── Matched examples (if any) ─────────────────────────────────────────────
  const withExamples = result.flags.filter(
    (f) => f.matched_examples && f.matched_examples.length > 0
  );
  if (withExamples.length > 0) {
    console.log(`       ${p(C.bold, "Evidence:")}`);
    for (const flag of withExamples) {
      for (const ex of flag.matched_examples.slice(0, 2)) {
        console.log(`         ${p(C.gray, `"${ex.slice(0, 70)}"`)}  ${p(C.dim, `(${flag.id})`)}`);
      }
    }
  }

  // ── Timing ────────────────────────────────────────────────────────────────
  console.log(p(C.gray, `       ⏱  ${ms}ms`));
  console.log(hr() + "\n");
}

// ── Summary table ─────────────────────────────────────────────────────────────
console.log(p(C.bold, "  Summary\n"));

const passCount  = results.filter((r) => r.matched && !r.err).length;
const warnCount  = results.filter((r) => !r.matched && !r.err).length;
const errCount   = results.filter((r) => r.err).length;
const totalMs    = results.reduce((s, r) => s + r.ms, 0);

// Table header
console.log(
  p(C.bold,
    "  " + "Name".padEnd(36) +
    "Category".padEnd(10) +
    "Expected".padEnd(10) +
    "Got".padEnd(10) +
    "Score".padEnd(7) +
    "Result"
  )
);
console.log("  " + hr("─", 70));

for (const { sample, result, err, matched } of results) {
  const got      = err ? "ERROR" : (result?.risk_level ?? "?");
  const status   = err ? p(C.red, "ERR") : matched ? p(C.green, "PASS") : p(C.yellow, "WARN");
  const score    = err ? "—" : String(result?.score ?? "?");
  console.log(
    "  " +
    sample.name.slice(0, 34).padEnd(36) +
    sample.category.padEnd(10) +
    sample.expected_risk.padEnd(10) +
    got.padEnd(10) +
    score.padEnd(7) +
    status
  );
}

console.log("\n  " + hr("─", 70));
console.log(
  "  " +
  p(C.bold, `${results.length} total`) + "  " +
  p(C.green + C.bold, `${passCount} passed`) + "  " +
  (warnCount > 0 ? p(C.yellow + C.bold, `${warnCount} unexpected`) + "  " : "") +
  (errCount  > 0 ? p(C.red    + C.bold, `${errCount} errors`) + "  " : "") +
  p(C.gray, `${totalMs}ms total`)
);
console.log();

// Exit 1 if any result didn't match expected
process.exit(warnCount > 0 || errCount > 0 ? 1 : 0);
