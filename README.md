# PhishGuard AI

> A lightweight web application that uses an AI-powered MCP server to analyze email text for phishing indicators, score risk levels, and maintain a searchable history of past analyses.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [How the MCP Server Works](#how-the-mcp-server-works)
5. [MCP Tools](#mcp-tools)
6. [Data Storage](#data-storage)
7. [Frontend Breakdown](#frontend-breakdown)
8. [Project Structure](#project-structure)

---

## Project Overview

PhishGuard AI lets users paste a raw email (headers, body, or both) into a web interface and instantly receive:

- A **risk score** (Low / Medium / High / Critical)
- A list of **specific red flags** detected in the text
- **Actionable safety recommendations** tailored to the findings
- A **persistent history** of all previous analyses for review

The analysis is handled entirely by a Model Context Protocol (MCP) server running locally in Node.js. The frontend communicates with the server through MCP tool calls, keeping the AI reasoning and the UI cleanly separated.

---

## Features

### Core Analysis
- **Risk scoring** — Classify emails as Low, Medium, High, or Critical based on a weighted indicator system.
- **Red flag detection** — Identify specific phishing patterns: urgency language, suspicious sender domains, mismatched URLs, credential-harvesting keywords, spoofed branding, etc.
- **Recommendations** — Return plain-English next steps based on the risk level and flags found (e.g., "Do not click any links," "Verify the sender through an official channel").
- **Confidence indicator** — Report how confident the analysis is based on the number and severity of indicators matched.

### History & Lookup
- **Save analyses** — Every analysis result is written to persistent storage with a timestamp and unique ID.
- **View history** — Browse all past analyses in reverse-chronological order.
- **Search history** — Filter past results by keyword, date range, or risk level.
- **Delete entries** — Remove individual history records.

### UX
- **Instant feedback** — Results render without a page reload.
- **Copy-to-clipboard** — One-click copy of the full analysis report.
- **Responsive layout** — Works on desktop and mobile screen sizes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| MCP Server | Node.js (≥ 18) |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Data Storage | Local JSON file (`data/analyses.json`) |
| AI Model | Gemini (via MCP host / Gemini API) |

---

## How the MCP Server Works

The MCP server is a Node.js process that exposes a set of **tools** to an AI model (Gemini). When the user submits an email in the frontend, the AI model receives the email text and decides which MCP tools to call to fulfill the request.

```
User (Browser)
     │  submits email text
     ▼
Frontend (HTML/JS)
     │  sends message to AI model (Gemini)
     ▼
Gemini (MCP Host)
     │  issues tool calls based on user intent
     ▼
MCP Server (Node.js)
     │  executes tools: analyze, score, save, retrieve
     ▼
Response bubbles back up to the frontend
```

### Server Lifecycle

1. **Startup** — The server registers all tools and connects via `StdioServerTransport` (standard MCP transport over stdin/stdout).
2. **Tool Registration** — Each tool is declared with a name, description, and a JSON Schema defining its input parameters.
3. **Tool Execution** — When the AI calls a tool, the server validates inputs, runs the logic, and returns a structured result.
4. **Shutdown** — The server closes gracefully when the host disconnects.

The server does **not** call external APIs — all phishing detection logic runs locally using pattern matching and heuristics defined in the tool implementations.

---

## MCP Tools

The server exposes the following tools to the AI model:

### `analyze_email`
Performs the core phishing analysis on raw email text.

| Parameter | Type | Description |
|---|---|---|
| `email_text` | `string` | The full raw email content to analyze |

**Returns:**
```json
{
  "risk_level": "High",
  "confidence": 0.87,
  "flags": [
    { "id": "urgency_language", "description": "Email uses urgent action language ('Act now', 'Immediate action required')", "severity": "medium" },
    { "id": "mismatched_url", "description": "Display text says 'PayPal' but link points to 'paypa1-secure.net'", "severity": "high" }
  ],
  "summary": "This email exhibits several high-confidence phishing indicators.",
  "recommendations": [
    "Do not click any links in this email.",
    "Report this email to your IT/security team.",
    "Verify the sender by contacting the organization directly through their official website."
  ]
}
```

---

### `save_analysis`
Persists an analysis result to the local JSON store.

| Parameter | Type | Description |
|---|---|---|
| `email_text` | `string` | The original email that was analyzed |
| `result` | `object` | The full result object returned by `analyze_email` |

**Returns:** The saved record including a generated `id` and `timestamp`.

---

### `get_history`
Retrieves past analysis records, with optional filtering.

| Parameter | Type | Description |
|---|---|---|
| `limit` | `number` (optional) | Max number of records to return (default: 20) |
| `risk_level` | `string` (optional) | Filter by risk level: `"Low"`, `"Medium"`, `"High"`, `"Critical"` |
| `search` | `string` (optional) | Keyword to match against the original email text or flags |

**Returns:** An array of saved analysis records, newest first.

---

### `delete_analysis`
Removes a single analysis record from storage.

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The unique ID of the record to delete |

**Returns:** Confirmation of deletion or an error if the ID was not found.

---

## Data Storage

All data is stored in a single JSON file on the local filesystem at `data/analyses.json`. There is no database dependency.

### Schema

Each entry in the array follows this shape:

```json
{
  "id": "a3f8c2d1-...",
  "timestamp": "2026-05-02T18:00:00.000Z",
  "email_snippet": "Dear customer, your account has been suspended...",
  "risk_level": "High",
  "confidence": 0.87,
  "flags": [ ... ],
  "recommendations": [ ... ]
}
```

| Field | Description |
|---|---|
| `id` | UUID v4, generated at save time |
| `timestamp` | ISO 8601 UTC timestamp |
| `email_snippet` | First 200 characters of the email (for history previews) |
| `risk_level` | One of: `Low`, `Medium`, `High`, `Critical` |
| `confidence` | Float 0–1 representing analysis confidence |
| `flags` | Array of flag objects (id, description, severity) |
| `recommendations` | Array of plain-English recommendation strings |

### File Handling

- The file is created automatically on first run if it doesn't exist.
- All reads and writes are synchronous to avoid race conditions in the simple single-user context.
- The full `email_text` is **not** stored — only a short snippet — to keep the file size manageable.

---

## Frontend Breakdown

The frontend is a single-page application built with plain HTML, CSS, and JavaScript. No framework is used.

### Pages / Views

The app has one HTML file (`index.html`) with three logical views toggled via JavaScript:

#### 1. Analyze View (default)
- Large textarea for pasting email text
- "Analyze" submit button
- Loading spinner shown during AI processing
- Results panel that slides in with:
  - Risk badge (color-coded: green / yellow / orange / red)
  - Confidence percentage bar
  - Collapsible list of red flags (each with severity chip)
  - Numbered recommendations list
  - "Save Result" and "Copy Report" action buttons

#### 2. History View
- Triggered by a nav link
- Renders a card list of past analyses (snippet + risk badge + timestamp)
- Search bar filters cards in real time
- Risk level filter chips (All / Low / Medium / High / Critical)
- Each card expands inline to show full flag and recommendation details
- Delete button per card

#### 3. About / Help View
- Brief explanation of how the tool works
- Glossary of phishing indicators and what they mean
- Tips for email safety

### Key JavaScript Modules (planned)

| File | Responsibility |
|---|---|
| `js/main.js` | App init, view routing, event listeners |
| `js/api.js` | Communication layer with the AI/MCP host |
| `js/ui.js` | DOM rendering helpers (risk badge, flag cards, etc.) |
| `js/history.js` | History view logic (filter, expand, delete) |

### Styling Approach

- CSS custom properties (variables) for the color system and spacing scale
- Dark mode by default; light mode via `prefers-color-scheme` media query
- Risk levels map to a consistent color palette used across badges, borders, and backgrounds
- Smooth CSS transitions for view changes and result panel entry

---

## Project Structure

```
PhishGuard AI/
├── README.md
├── package.json
├── server/
│   ├── index.js          # MCP server entry point
│   ├── tools/
│   │   ├── analyzeEmail.js
│   │   ├── saveAnalysis.js
│   │   ├── getHistory.js
│   │   └── deleteAnalysis.js
│   └── utils/
│       ├── detectors.js  # Phishing pattern matching logic
│       └── storage.js    # JSON file read/write helpers
├── data/
│   └── analyses.json     # Auto-created on first run
└── frontend/
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        ├── main.js
        ├── api.js
        ├── ui.js
        └── history.js
```