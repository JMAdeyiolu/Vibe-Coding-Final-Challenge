/**
 * logger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Structured logger for the PhishGuard AI MCP server.
 *
 * IMPORTANT: All output is written to stderr, never stdout.
 * The MCP stdio transport uses stdout exclusively for protocol messages.
 * Writing anything to stdout will corrupt the MCP connection.
 *
 * Log levels (in order of severity):
 *   debug  — verbose internal detail, off by default
 *   info   — normal operational events (startup, tool calls)
 *   warn   — unexpected but recoverable situations
 *   error  — failures that need attention
 *
 * Set the LOG_LEVEL environment variable to control verbosity:
 *   LOG_LEVEL=debug node server/index.js
 */

// ── ANSI color codes ──────────────────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  // Foreground
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
};

// Disable colors when not writing to a terminal (e.g., log file redirect)
const USE_COLOR = process.stderr.isTTY ?? false;
const paint = (code, str) => USE_COLOR ? `${code}${str}${C.reset}` : str;

// ── Log level control ─────────────────────────────────────────────────────────
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function shouldLog(level) {
  return (LEVELS[level] ?? 1) >= MIN_LEVEL;
}

// ── Timestamp ─────────────────────────────────────────────────────────────────
function ts() {
  return paint(C.gray, new Date().toISOString());
}

// ── Tag formatting ────────────────────────────────────────────────────────────
function fmtTag(tag) {
  return paint(C.cyan + C.bold, `[${tag}]`);
}

// ── Core write ────────────────────────────────────────────────────────────────
function write(level, tag, message, data) {
  if (!shouldLog(level)) return;

  const levelColors = {
    debug: C.gray,
    info:  C.blue,
    warn:  C.yellow,
    error: C.red,
  };
  const levelStr = paint(levelColors[level] ?? C.white, level.toUpperCase().padEnd(5));
  const line     = `${ts()} ${levelStr} ${fmtTag(tag)} ${message}`;

  process.stderr.write(line + "\n");

  if (data !== undefined) {
    const formatted = typeof data === "string"
      ? data
      : JSON.stringify(data, null, 2);
    // Indent the data block for readability
    const indented = formatted.split("\n").map((l) => "       " + l).join("\n");
    process.stderr.write(paint(C.gray, indented) + "\n");
  }
}

// ── Public logger API ─────────────────────────────────────────────────────────
export const logger = {
  debug: (tag, msg, data) => write("debug", tag, msg, data),
  info:  (tag, msg, data) => write("info",  tag, msg, data),
  warn:  (tag, msg, data) => write("warn",  tag, msg, data),
  error: (tag, msg, data) => write("error", tag, msg, data),

  /**
   * Log a tool invocation. Automatically truncates large params for readability.
   * @param {string} toolName
   * @param {object} params
   */
  toolCall(toolName, params) {
    if (!shouldLog("info")) return;

    // Sanitise: truncate email_text so we don't flood the terminal
    const sanitised = { ...params };
    if (typeof sanitised.email_text === "string") {
      const preview = sanitised.email_text.slice(0, 120).replace(/\s+/g, " ").trim();
      sanitised.email_text = `${preview}… (${sanitised.email_text.length} chars total)`;
    }
    if (sanitised.result) {
      sanitised.result = "[result object — see output]";
    }

    const label = paint(C.magenta + C.bold, `→ CALL`);
    process.stderr.write(
      `${ts()} ${label}  ${paint(C.bold, toolName)}\n` +
      paint(C.gray, "       " + JSON.stringify(sanitised, null, 2).split("\n").join("\n       ")) + "\n"
    );
  },

  /**
   * Log a tool result with timing and a summary of key fields.
   * @param {string} toolName
   * @param {object} result   The value returned by the tool function
   * @param {number} ms       Elapsed milliseconds
   * @param {boolean} isError Whether the result is an error
   */
  toolResult(toolName, result, ms, isError = false) {
    if (!shouldLog("info")) return;

    const label  = isError
      ? paint(C.red   + C.bold, `← ERR `)
      : paint(C.green + C.bold, `← OK  `);
    const timing = paint(C.gray, `(${ms}ms)`);

    // Extract a short summary from common result shapes
    let summary = "";
    if (result?.risk_level)  summary += `risk=${result.risk_level}  score=${result.score ?? "?"}  flags=${result.flags_count ?? result.flags?.length ?? "?"}`;
    if (result?.saved_at)    summary += `saved id=${result.id}`;
    if (result?.returned !== undefined) summary += `returned=${result.returned}/${result.total_stored}`;
    if (result?.message)     summary += result.message;
    if (!summary)            summary = "OK";

    process.stderr.write(
      `${ts()} ${label}  ${paint(C.bold, toolName)}  ${timing}  ${paint(C.cyan, summary)}\n`
    );
  },

  /** Divider line for visual separation */
  divider() {
    if (USE_COLOR) {
      process.stderr.write(paint(C.gray, "─".repeat(72)) + "\n");
    }
  },
};
