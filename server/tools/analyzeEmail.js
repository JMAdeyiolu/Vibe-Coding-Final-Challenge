/**
 * analyzeEmail.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MCP tool handler: analyze_email
 *
 * Scoring system overview:
 * ─────────────────────────────────────────────────────────────────────────────
 *  Each phishing indicator (flag) has an explicit point value defined in
 *  SCORING_CONFIG, keyed by flag ID. Points are NOT derived from severity —
 *  severity is a qualitative label; points reflect how strongly each category
 *  signals phishing intent based on empirical data.
 *
 *  Some indicators support variable points: the base value scales linearly
 *  with match_count up to the configured cap (e.g., more urgency phrases =
 *  more points, up to the cap).
 *
 *  Total points are summed, capped at MAX_SCORE (100), and mapped to a risk
 *  level via RISK_THRESHOLDS.
 *
 * Score → Risk Level mapping:
 *   0  – 24  →  Low
 *   25 – 49  →  Medium
 *   50 – 74  →  High
 *   75 – 100 →  Critical
 *
 * Response shape:
 *   score           — integer 0–100
 *   max_score       — always 100
 *   risk_level      — "Low" | "Medium" | "High" | "Critical"
 *   flags           — array of enriched DetectedFlag objects
 *   flags_count     — number of triggered flags
 *   score_breakdown — array showing each flag's point contribution
 *   summary         — short plain-English overview
 *   recommendations — tailored action list for the risk level
 *   analyzed_at     — ISO 8601 UTC timestamp
 */

import {
  detectUrgencyLanguage,
  detectSuspiciousUrls,
  detectCredentialHarvesting,
  detectSenderMismatch,
  detectFormattingIssues,
  detectGenericGreeting,
  detectThreats,
  detectAttachmentLure,
  detectRewardBait,
} from "../utils/detectors.js";

// ═════════════════════════════════════════════════════════════════════════════
// DETECTOR REGISTRY
// Add new detectors here. The entry order determines evaluation order.
// ═════════════════════════════════════════════════════════════════════════════
const ALL_DETECTORS = [
  detectCredentialHarvesting,   // highest-signal: always critical
  detectSenderMismatch,          // brand impersonation / header mismatch
  detectSuspiciousUrls,          // link obfuscation
  detectUrgencyLanguage,         // pressure tactics
  detectThreats,                 // legal/authority intimidation
  detectAttachmentLure,          // malware delivery
  detectFormattingIssues,        // visual/structural anomalies
  detectRewardBait,              // prize / advance-fee bait
  detectGenericGreeting,         // impersonalization (weakest signal)
];

// ═════════════════════════════════════════════════════════════════════════════
// SCORING CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
// Each entry:
//   base_points  — points awarded when the flag triggers (regardless of matches)
//   scale        — if true, points scale with match_count (base * match_count)
//   cap          — maximum points this flag can contribute to the total
//   weight_label — human-readable weight description for the breakdown
// ═════════════════════════════════════════════════════════════════════════════
const SCORING_CONFIG = {
  credential_harvesting: { base_points: 35, scale: true,  cap: 35, weight_label: "Critical — direct data theft attempt"          },
  sender_mismatch:       { base_points: 28, scale: true,  cap: 28, weight_label: "Critical — brand impersonation / header fraud"  },
  suspicious_url:        { base_points: 22, scale: true,  cap: 22, weight_label: "High — obfuscated or malicious link"            },
  urgency_language:      { base_points:  5, scale: true,  cap: 20, weight_label: "Medium/High — pressure tactic"                 },
  threats:               { base_points: 18, scale: true,  cap: 18, weight_label: "High — legal / authority coercion"             },
  attachment_lure:       { base_points: 18, scale: false, cap: 18, weight_label: "High — malware delivery vector"                },
  formatting_issues:     { base_points:  5, scale: true,  cap: 15, weight_label: "Low/Medium — structural phishing tell"         },
  reward_bait:           { base_points:  8, scale: true,  cap: 12, weight_label: "Medium — social engineering lure"              },
  generic_greeting:      { base_points:  5, scale: false, cap:  5, weight_label: "Low — impersonalization signal"                },
};

const MAX_SCORE = 100;

// ═════════════════════════════════════════════════════════════════════════════
// RISK LEVEL THRESHOLDS
// ═════════════════════════════════════════════════════════════════════════════
const RISK_THRESHOLDS = [
  { min: 75, level: "Critical" },
  { min: 50, level: "High"     },
  { min: 25, level: "Medium"   },
  { min:  0, level: "Low"      },
];

// ═════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═════════════════════════════════════════════════════════════════════════════
const RECOMMENDATIONS = {
  Low: [
    "This email appears largely safe, but automated analysis is not infallible — stay alert.",
    "Verify the sender's address matches the organization's official domain (check the full address, not just the display name).",
    "If the email asks you to take any action, confirm through the organization's official website — not through links in the email.",
  ],
  Medium: [
    "Do not click any links before checking the real URL destination (hover over links to preview them).",
    "Contact the sending organization directly via their official website or phone number — not through contact details in this email.",
    "Ask yourself: was I expecting this email? Unsolicited action requests are a major red flag.",
    "Report the email to your IT team or email provider's spam system if it feels suspicious.",
  ],
  High: [
    "Do not click any links or open any attachments in this email.",
    "Report this email to your IT or security team immediately.",
    "Verify any claimed account issues by logging into the service directly (type the URL yourself — do not use email links).",
    "If you have already clicked a link or entered any information: change affected passwords NOW and enable two-factor authentication.",
    "Mark the email as phishing/spam so your provider can improve detection for others.",
  ],
  Critical: [
    "STOP — do not click, reply, forward, or open attachments from this email.",
    "Report it immediately to your IT/security team and mark it as phishing in your email client.",
    "If you have already entered any credentials or financial information: change ALL affected passwords immediately, contact your bank, and freeze your credit if applicable.",
    "Enable two-factor authentication on every account that could be at risk.",
    "Document what you did (screenshots, timestamps) and consider reporting to the FTC (ReportFraud.ftc.gov) or the Anti-Phishing Working Group (reportphishing@apwg.org).",
    "Perform a malware scan if you opened any attachment or downloaded any file.",
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the point contribution of a single flag.
 *
 * @param {object} flag  A DetectedFlag returned by a detector
 * @returns {{ points: number, cap: number, weight_label: string }}
 */
function scoreFlag(flag) {
  const config = SCORING_CONFIG[flag.id];
  if (!config) {
    // Unknown flag — assign a conservative default
    return { points: 5, cap: 10, weight_label: "Unknown indicator" };
  }

  const matchCount = flag.match_count ?? 1;
  const raw        = config.scale
    ? config.base_points * matchCount
    : config.base_points;

  return {
    points:       Math.min(raw, config.cap),
    cap:          config.cap,
    weight_label: config.weight_label,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Analyze a raw email string for phishing indicators using a weighted
 * multi-factor scoring system.
 *
 * @param {string} emailText  Full raw email content (headers + body recommended)
 * @returns {{
 *   score:           number,    // 0–100
 *   max_score:       100,
 *   risk_level:      string,    // "Low" | "Medium" | "High" | "Critical"
 *   flags:           object[],  // DetectedFlag objects with full detail
 *   flags_count:     number,
 *   score_breakdown: object[],  // per-flag point attribution
 *   summary:         string,
 *   recommendations: string[],
 *   analyzed_at:     string,    // ISO 8601
 * }}
 */
export function analyzeEmail(emailText) {
  // ── Step 1: Run all detectors ───────────────────────────────────────────────
  const flags = ALL_DETECTORS.map((fn) => {
    try {
      return fn(emailText);
    } catch (err) {
      // Isolate detector failures — one bad regex should never crash the run
      console.error(`[analyzeEmail] Detector "${fn.name}" threw an error:`, err.message);
      return null;
    }
  }).filter(Boolean);

  // ── Step 2: Score each flag ─────────────────────────────────────────────────
  const scoredFlags = flags.map((flag) => {
    const { points, cap, weight_label } = scoreFlag(flag);
    return { flag, points, cap, weight_label };
  });

  // ── Step 3: Sum points, cap at MAX_SCORE ────────────────────────────────────
  const rawTotal = scoredFlags.reduce((sum, { points }) => sum + points, 0);
  const score    = Math.min(rawTotal, MAX_SCORE);

  // ── Step 4: Derive risk level ───────────────────────────────────────────────
  const { level: risk_level } = RISK_THRESHOLDS.find((t) => score >= t.min);

  // ── Step 5: Build score breakdown (sorted highest contribution first) ───────
  const score_breakdown = scoredFlags
    .sort((a, b) => b.points - a.points)
    .map(({ flag, points, cap, weight_label }) => ({
      flag_id:      flag.id,
      category:     flag.category,
      severity:     flag.severity,
      points_awarded: points,
      points_cap:   cap,
      weight_label,
    }));

  // ── Step 6: Build summary ───────────────────────────────────────────────────
  let summary;
  if (flags.length === 0) {
    summary = "No phishing indicators were detected. The email appears safe, but automated detection is not foolproof — always verify unexpected messages manually.";
  } else {
    const topFlag   = score_breakdown[0];
    const topLabel  = topFlag ? ` The strongest signal: ${topFlag.category} (${topFlag.points_awarded} pts).` : "";
    summary = `${flags.length} phishing indicator${flags.length !== 1 ? "s" : ""} detected. ` +
              `Total risk score: ${score}/${MAX_SCORE} — Risk level: ${risk_level}.${topLabel}`;
  }

  return {
    score,
    max_score:       MAX_SCORE,
    risk_level,
    flags,
    flags_count:     flags.length,
    score_breakdown,
    summary,
    recommendations: RECOMMENDATIONS[risk_level],
    analyzed_at:     new Date().toISOString(),
  };
}
