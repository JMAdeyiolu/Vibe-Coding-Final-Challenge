/**
 * index.js — PhishGuard AI MCP Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point. Creates the MCP server, registers the three tools, and
 * connects via StdioServerTransport (standard MCP transport over stdin/stdout).
 *
 * Tools exposed:
 *   analyze_email        — detect phishing indicators in raw email text
 *   save_analysis        — persist an analysis result to analyses.json
 *   get_analysis_history — retrieve stored results with optional filtering
 *
 * Logging:
 *   All log output goes to stderr (stdout is reserved for MCP protocol).
 *   Control verbosity with:  LOG_LEVEL=debug node server/index.js
 *
 * Running:
 *   node server/index.js          (production)
 *   node --watch server/index.js  (development, auto-restarts on file change)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { analyzeEmail }       from "./tools/analyzeEmail.js";
import { saveAnalysis }       from "./tools/saveAnalysis.js";
import { getAnalysisHistory } from "./tools/getAnalysisHistory.js";
import { logger }             from "./utils/logger.js";

// ── withLogging ───────────────────────────────────────────────────────────────
/**
 * Wraps a tool handler function to add automatic call/response logging and
 * timing. Preserves error handling — errors are logged and re-thrown so the
 * tool's own try/catch still controls the MCP response shape.
 *
 * @param {string}   toolName  Name used in log output
 * @param {Function} handler   The async tool handler `(params) => result`
 * @returns {Function}         Wrapped handler with identical signature
 */
function withLogging(toolName, handler) {
  return async (params) => {
    logger.divider();
    logger.toolCall(toolName, params);
    const start = Date.now();
    let response;

    try {
      response = await handler(params);
    } catch (err) {
      const ms = Date.now() - start;
      logger.error(toolName, `Unhandled error after ${ms}ms: ${err.message}`);
      throw err;
    }

    const ms      = Date.now() - start;
    const isError = response?.isError === true;

    // Parse the JSON text from the MCP content block to extract summary fields
    let resultData;
    try {
      resultData = JSON.parse(response?.content?.[0]?.text ?? "{}");
    } catch {
      resultData = {};
    }

    logger.toolResult(toolName, resultData, ms, isError);
    return response;
  };
}

// ── Server instance ───────────────────────────────────────────────────────────
const server = new McpServer({
  name:    "phishguard-ai",
  version: "1.0.0",
});

// ── Tool: analyze_email ───────────────────────────────────────────────────────
server.tool(
  "analyze_email",

  "Analyzes raw email text for phishing indicators using a weighted multi-factor scoring system. " +
  "Returns: score (0–100), risk_level (Low/Medium/High/Critical), flags array with id/category/" +
  "description/explanation/severity/match_count/matched_examples per flag, score_breakdown showing " +
  "each flag's point contribution, a plain-English summary, and tailored recommendations. " +
  "Does NOT persist the result — call save_analysis if you want to store it.",

  {
    email_text: z
      .string()
      .min(10, "email_text must be at least 10 characters")
      .describe("The full raw email content to analyze. Include headers and body for best results."),
  },

  withLogging("analyze_email", async ({ email_text }) => {
    try {
      const result = analyzeEmail(email_text);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      logger.error("analyze_email", `Analysis failed: ${err.message}`);
      return {
        content: [{ type: "text", text: `Error during analysis: ${err.message}` }],
        isError: true,
      };
    }
  })
);

// ── Tool: save_analysis ───────────────────────────────────────────────────────
server.tool(
  "save_analysis",

  "Persists an analysis result to local JSON storage (data/analyses.json). " +
  "Stores a 200-character email snippet (not the full text), the risk level, " +
  "score, flags, summary, and recommendations. " +
  "Returns the saved record including its generated UUID and timestamps.",

  {
    email_text: z
      .string()
      .min(1)
      .describe("The original email that was analyzed. Only a short snippet is stored."),

    result: z
      .object({
        score:           z.number().int().min(0).max(100),
        max_score:       z.number().optional(),
        risk_level:      z.enum(["Low", "Medium", "High", "Critical"]),
        flags_count:     z.number().int().min(0).optional(),
        flags: z.array(
          z.object({
            id:               z.string(),
            category:         z.string().optional(),
            description:      z.string(),
            explanation:      z.string().optional(),
            severity:         z.enum(["low", "medium", "high", "critical"]),
            match_count:      z.number().int().optional(),
            matched_examples: z.array(z.string()).optional(),
          })
        ),
        score_breakdown: z.array(z.object({
          flag_id:        z.string(),
          category:       z.string().optional(),
          severity:       z.string().optional(),
          points_awarded: z.number(),
          points_cap:     z.number().optional(),
          weight_label:   z.string().optional(),
        })).optional(),
        summary:         z.string(),
        recommendations: z.array(z.string()),
        analyzed_at:     z.string().optional(),
      })
      .describe("The full result object returned by the analyze_email tool."),
  },

  withLogging("save_analysis", async ({ email_text, result }) => {
    try {
      const saved = saveAnalysis(email_text, result);
      return { content: [{ type: "text", text: JSON.stringify(saved, null, 2) }] };
    } catch (err) {
      logger.error("save_analysis", `Save failed: ${err.message}`);
      return {
        content: [{ type: "text", text: `Error saving analysis: ${err.message}` }],
        isError: true,
      };
    }
  })
);

// ── Tool: get_analysis_history ────────────────────────────────────────────────
server.tool(
  "get_analysis_history",

  "Retrieves saved analysis records from local storage, newest first. " +
  "Supports optional filtering by risk level, keyword search (matched against " +
  "the email snippet, summary, and flag descriptions), and a 'since' date cutoff. " +
  "Returns a result envelope with the records array plus metadata (total stored, " +
  "count returned, and the filters that were applied).",

  {
    limit: z
      .number().int().min(1).max(100).optional()
      .describe("Maximum number of records to return. Default: 20, max: 100."),

    risk_level: z
      .enum(["Low", "Medium", "High", "Critical"]).optional()
      .describe("Return only records with this exact risk level."),

    search: z
      .string().optional()
      .describe("Case-insensitive keyword to match against the stored email snippet, summary, or flag descriptions."),

    since: z
      .string().optional()
      .describe("ISO 8601 date/time string. Only return records saved after this point. Example: '2026-01-01T00:00:00Z'"),
  },

  withLogging("get_analysis_history", async ({ limit, risk_level, search, since }) => {
    try {
      const result = getAnalysisHistory({ limit, risk_level, search, since });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      logger.error("get_analysis_history", `History retrieval failed: ${err.message}`);
      return {
        content: [{ type: "text", text: `Error retrieving history: ${err.message}` }],
        isError: true,
      };
    }
  })
);

// ── Connect and start ─────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error("server", `Uncaught exception: ${err.message}`, err.stack);
});
process.on("unhandledRejection", (reason) => {
  logger.error("server", "Unhandled promise rejection", reason);
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Startup banner — goes to stderr so it doesn't corrupt MCP stdout
logger.divider();
logger.info("server", "PhishGuard AI MCP server started");
logger.info("server", "Transport: StdioServerTransport (stdin/stdout)");
logger.info("server", "Tools registered: analyze_email · save_analysis · get_analysis_history");
logger.info("server", `Log level: ${process.env.LOG_LEVEL ?? "info"}  |  Node ${process.version}`);
logger.divider();
