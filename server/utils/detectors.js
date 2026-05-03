/**
 * detectors.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All phishing pattern-matching detectors for PhishGuard AI.
 *
 * CONTRACT — every exported detector function:
 *   Input:  (text: string) — the full raw email (headers + body)
 *   Output: DetectedFlag | null
 *
 * DetectedFlag shape:
 *   {
 *     id:               string   — stable machine-readable key
 *     category:         string   — human-readable group label
 *     description:      string   — what was found (factual)
 *     explanation:      string   — why it matters (educational, shown to user)
 *     severity:         "low" | "medium" | "high" | "critical"
 *     match_count:      number   — how many distinct patterns triggered
 *     matched_examples: string[] — up to 3 example snippets that triggered (optional)
 *   }
 *
 * Adding a new detector:
 *   1. Write and export a detectXxx() function below following this contract.
 *   2. Add it to the ALL_DETECTORS array in analyzeEmail.js.
 *   3. Add a SCORING_CONFIG entry in analyzeEmail.js.
 *   Done — no other changes needed.
 */

// ── Shared helper ─────────────────────────────────────────────────────────────

/**
 * Run an array of regexes against text. Returns the array of matched patterns.
 * @param {RegExp[]} patterns
 * @param {string}   text
 * @returns {RegExp[]}
 */
function matchAll(patterns, text) {
  return patterns.filter((p) => p.test(text));
}

/**
 * Extract up to `limit` short example snippets for matched patterns.
 * Pulls the first capturing group (or full match) from the text.
 * @param {RegExp[]} patterns
 * @param {string}   text
 * @param {number}   [limit=3]
 * @returns {string[]}
 */
function extractExamples(patterns, text, limit = 3) {
  const examples = [];
  for (const p of patterns) {
    if (examples.length >= limit) break;
    const m = text.match(p);
    if (m) examples.push((m[1] ?? m[0]).slice(0, 60).trim());
  }
  return examples;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. URGENCY LANGUAGE
// Category: Psychological manipulation
// What: High-pressure time-based phrases designed to bypass rational thought.
// ═════════════════════════════════════════════════════════════════════════════
const URGENCY_PATTERNS = [
  /\bact now\b/i,
  /\bimmediate(ly)?\b/i,
  /\burgent(ly)?\b/i,
  /\baccount (has been |is )?(suspended|compromised|locked|disabled|blocked)\b/i,
  /\bverify (your )?account (immediately|now|today|within)\b/i,
  /\byour account will be (closed|suspended|terminated|deactivated|deleted)\b/i,
  /\blimited time (offer|only)\b/i,
  /\bexpire[sd]? (in|within)\b/i,
  /\brespond within \d+ (hour|day|minute)s?\b/i,
  /\baction required\b/i,
  /\byour (account|access) (will|has been|is about to be)\b/i,
  /\bwithin (the next )?\d+ (hours?|days?)\b/i,
  /\bfinal (notice|warning|reminder)\b/i,
  /\bimmediately or (your|the)\b/i,
  /\blast chance\b/i,
  /\bdo not (ignore|delay|wait)\b/i,
  /\btime-sensitive\b/i,
  /\bdeadline\b/i,
];

/**
 * Detect panic-inducing urgency language designed to prevent careful thought.
 */
export function detectUrgencyLanguage(text) {
  const matched = matchAll(URGENCY_PATTERNS, text);
  if (matched.length === 0) return null;

  // Severity scales with number of distinct urgency patterns hit
  let severity;
  if      (matched.length >= 5) severity = "critical";
  else if (matched.length >= 3) severity = "high";
  else if (matched.length >= 2) severity = "medium";
  else                          severity = "low";

  return {
    id:          "urgency_language",
    category:    "Psychological Manipulation",
    description: `${matched.length} urgency pattern${matched.length > 1 ? "s" : ""} detected — email applies time pressure on the recipient.`,
    explanation: "Phishing emails create artificial urgency to make you act before you think. Phrases like 'Act now', 'Your account will be suspended', or 'Final notice' are designed to trigger panic and bypass skepticism. Legitimate organizations give reasonable timelines and do not threaten immediate consequences via email.",
    severity,
    match_count:      matched.length,
    matched_examples: extractExamples(matched, text),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. SUSPICIOUS URLS / LINKS
// Category: Malicious Links
// What: Links that hide their real destination or impersonate trusted domains.
// ═════════════════════════════════════════════════════════════════════════════
const SUSPICIOUS_URL_PATTERNS = [
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,                        // raw IP
  /pay[p]a[l1][^a-z]/i,                                                       // paypal typosquats
  /amaz[o0]n[^a-z]/i,                                                          // amazon typosquats
  /g[o0]{2}gle[^a-z]/i,                                                        // google typosquats
  /micr[o0]s[o0]ft[^a-z]/i,                                                    // microsoft typosquats
  /app[l1]e[^a-z]/i,                                                            // apple typosquats
  /netfl[i1]x[^a-z]/i,                                                          // netflix typosquats
  /\.(xyz|top|click|gq|ml|tk|cf|ga|pw|cc|to|fit|link|live|online|site|website|tech|icu|cyou)\//i,  // abuse-prone TLDs
  /\b(bit\.ly|tinyurl\.com|t\.co|rb\.gy|is\.gd|ow\.ly|buff\.ly|shorturl\.at|cutt\.ly|tiny\.cc)\//i, // URL shorteners
  /\b(paypal|amazon|apple|google|microsoft|netflix|chase|wellsfargo|bankofamerica)\.com\.[a-z]{2,}\//i, // subdomain spoofing
  /https?:\/\/[^\s]+\/[A-Za-z0-9+/]{30,}={0,2}/,                             // base64 obfuscation in path
  /https?:\/\/[^\s]+@[^\s]+/,                                                  // @ trick: creds@evilsite.com
  /\bclick\s+here\b[^.]{0,30}https?/i,                                         // "click here" hiding a URL
  /\bhttp[^\s]*\s+\(.*\)/i,                                                    // mismatched display text
];

/**
 * Detect links using suspicious domains, obfuscation, or brand impersonation.
 */
export function detectSuspiciousUrls(text) {
  const matched = matchAll(SUSPICIOUS_URL_PATTERNS, text);
  if (matched.length === 0) return null;

  const severity = matched.length >= 3 ? "critical" : "high";

  return {
    id:          "suspicious_url",
    category:    "Malicious Links",
    description: `${matched.length} suspicious link pattern${matched.length > 1 ? "s" : ""} found — URL obfuscation, typosquatted domains, or shorteners detected.`,
    explanation: "Phishers hide dangerous URLs using IP addresses, URL shorteners (bit.ly, tinyurl), typosquatted brand names (paypa1.com), or subdomain tricks (paypal.com.evil.com). Always hover over links to preview the real destination before clicking, and navigate to sites directly instead of through email links.",
    severity,
    match_count:      matched.length,
    matched_examples: extractExamples(matched, text),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. CREDENTIAL REQUESTS
// Category: Credential Harvesting
// What: Explicit requests for passwords, PII, or financial information.
// ═════════════════════════════════════════════════════════════════════════════
const CREDENTIAL_PATTERNS = [
  /\benter (your )?(password|credentials|login|username|pin|passcode)\b/i,
  /\b(confirm|verify) (your )?(identity|password|details|information|account)\b/i,
  /\breset (your )?password\b/i,
  /\bupdate (your )?(billing|payment|card|bank) (info|information|details)\b/i,
  /\bprovide (your )?(ssn|social security|credit card|bank account|routing number)\b/i,
  /\bsign in (to|and) (confirm|verify|update|access)\b/i,
  /\blog in (to|and) (confirm|verify|update|access)\b/i,
  /\byour (credit card|debit card|bank) (details|information|number)\b/i,
  /\bvalidate (your )?(account|identity|payment|card)\b/i,
  /\benter (your )?(card|account) (number|details)\b/i,
  /\bsocial security number\b/i,
  /\bmother'?s? maiden name\b/i,
  /\bdate of birth\b.*\b(confirm|verify|enter|provide)\b/i,
  /\bsecurity (question|answer)\b.*\b(confirm|verify|enter)\b/i,
];

/**
 * Detect requests for passwords, PII, or financial credentials — the primary
 * objective of most phishing attacks.
 */
export function detectCredentialHarvesting(text) {
  const matched = matchAll(CREDENTIAL_PATTERNS, text);
  if (matched.length === 0) return null;

  const severity = matched.length >= 3 ? "critical" : "critical"; // always critical

  return {
    id:          "credential_harvesting",
    category:    "Credential Harvesting",
    description: `${matched.length} credential or PII request${matched.length > 1 ? "s" : ""} found — email solicits passwords, financial data, or personal identifiers.`,
    explanation: "Legitimate organizations NEVER ask for passwords, full credit card numbers, Social Security numbers, or security answers via email. Any email requesting this information is either a phishing attempt or a severe security policy violation. Do not comply — contact the organization through their official website or phone number instead.",
    severity,
    match_count:      matched.length,
    matched_examples: extractExamples(matched, text),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. MISMATCHED SENDER CONTEXT
// Category: Sender Deception
// What: Email claims to be from a trusted brand but evidence contradicts it.
// ═════════════════════════════════════════════════════════════════════════════
const BRAND_PATTERNS = [
  { brand: "PayPal",          pattern: /\bpaypal\b/i,          domain: /paypal\.com/i },
  { brand: "Amazon",          pattern: /\bamazon\b/i,           domain: /amazon\.com/i },
  { brand: "Apple",           pattern: /\bapple\b/i,            domain: /apple\.com/i },
  { brand: "Google",          pattern: /\bgoogle\b/i,           domain: /google\.com/i },
  { brand: "Microsoft",       pattern: /\bmicrosoft\b/i,        domain: /microsoft\.com/i },
  { brand: "Netflix",         pattern: /\bnetflix\b/i,          domain: /netflix\.com/i },
  { brand: "Bank of America", pattern: /\bbank of america\b/i,  domain: /bankofamerica\.com/i },
  { brand: "Chase",           pattern: /\bchase\b/i,            domain: /chase\.com/i },
  { brand: "Wells Fargo",     pattern: /\bwells fargo\b/i,      domain: /wellsfargo\.com/i },
  { brand: "IRS",             pattern: /\birs\b/i,              domain: /irs\.gov/i },
  { brand: "USPS",            pattern: /\busps\b/i,             domain: /usps\.com/i },
  { brand: "FedEx",           pattern: /\bfedex\b/i,            domain: /fedex\.com/i },
];

// FROM/REPLY-TO header patterns for sender mismatch analysis
const FROM_HEADER_RE   = /^from:\s*(.+)$/im;
const REPLY_TO_RE      = /^reply-to:\s*(.+)$/im;
const EMAIL_DOMAIN_RE  = /@([\w.-]+)/;

/**
 * Detect mismatched sender context: brand impersonation, Reply-To divergence,
 * or brand name present with no corresponding legitimate domain.
 */
export function detectSenderMismatch(text) {
  const issues = [];
  const impersonatedBrands = [];

  // Check 1: Brand mentioned without its legitimate domain present
  for (const { brand, pattern, domain } of BRAND_PATTERNS) {
    if (pattern.test(text) && !domain.test(text)) {
      impersonatedBrands.push(brand);
    }
  }
  if (impersonatedBrands.length > 0) {
    issues.push(`Brand${impersonatedBrands.length > 1 ? "s" : ""} mentioned (${impersonatedBrands.join(", ")}) but no corresponding legitimate domain found`);
  }

  // Check 2: Reply-To domain differs from From domain (only if headers are present)
  const fromMatch    = text.match(FROM_HEADER_RE);
  const replyToMatch = text.match(REPLY_TO_RE);
  if (fromMatch && replyToMatch) {
    const fromDomain    = fromMatch[1].match(EMAIL_DOMAIN_RE)?.[1]?.toLowerCase();
    const replyToDomain = replyToMatch[1].match(EMAIL_DOMAIN_RE)?.[1]?.toLowerCase();
    if (fromDomain && replyToDomain && fromDomain !== replyToDomain) {
      issues.push(`Reply-To domain (${replyToDomain}) does not match From domain (${fromDomain})`);
    }
  }

  // Check 3: Suspicious URL present alongside any brand mention
  const hasSuspiciousUrl = SUSPICIOUS_URL_PATTERNS.some((p) => p.test(text));
  const mentionsBrand    = BRAND_PATTERNS.some(({ pattern }) => pattern.test(text));
  if (hasSuspiciousUrl && mentionsBrand && !issues.some((i) => i.includes("Brand"))) {
    issues.push("Trusted brand mentioned alongside a suspicious or obfuscated URL");
  }

  if (issues.length === 0) return null;

  const severity = issues.length >= 2 ? "critical" : "high";

  return {
    id:          "sender_mismatch",
    category:    "Sender Deception",
    description: `${issues.length} sender context inconsistenc${issues.length > 1 ? "ies" : "y"}: ${issues.join("; ")}.`,
    explanation: "Brand impersonation is one of the most effective phishing techniques. Attackers claim to be from PayPal, Amazon, your bank, etc. while the actual links and sender addresses point elsewhere. Clues include: the From address not matching the brand's domain, a Reply-To address that goes to a different server, or brand logos/names paired with suspicious URLs.",
    severity,
    match_count:      issues.length,
    matched_examples: issues.slice(0, 3),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. FORMATTING ISSUES
// Category: Suspicious Formatting
// What: Visual/structural red flags — excessive caps, exclamation marks,
//       mixed scripts, or patterns consistent with mass phishing templates.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Detect formatting anomalies common in phishing emails.
 */
export function detectFormattingIssues(text) {
  const issues = [];

  // Check 1: Excessive ALL-CAPS words (≥ 5 words fully uppercase, ≥ 4 letters each)
  const capsWords = (text.match(/\b[A-Z]{4,}\b/g) ?? []);
  if (capsWords.length >= 5) {
    issues.push({
      label:   "Excessive capitalization",
      detail:  `${capsWords.length} all-caps word${capsWords.length > 1 ? "s" : ""} (e.g., ${capsWords.slice(0, 3).join(", ")})`,
      weight:  capsWords.length >= 10 ? 2 : 1,
    });
  }

  // Check 2: Excessive exclamation marks (≥ 3)
  const exclCount = (text.match(/!/g) ?? []).length;
  if (exclCount >= 3) {
    issues.push({
      label:   "Excessive exclamation marks",
      detail:  `${exclCount} exclamation mark${exclCount > 1 ? "s" : ""} found`,
      weight:  1,
    });
  }

  // Check 3: Mixed Cyrillic/Greek/lookalike Unicode characters (homoglyph attacks)
  // Detects non-ASCII characters that visually resemble Latin letters
  const homoglyphRe = /[\u0400-\u04FF\u0370-\u03FF\u0250-\u02AF]/g;
  const homoglyphs  = text.match(homoglyphRe) ?? [];
  if (homoglyphs.length > 0) {
    issues.push({
      label:   "Lookalike Unicode characters",
      detail:  `${homoglyphs.length} Cyrillic/Greek/lookalike character${homoglyphs.length > 1 ? "s" : ""} found — possible homoglyph attack`,
      weight:  3,
    });
  }

  // Check 4: Suspicious HTML-style hidden content (common in HTML phishing emails)
  if (/style\s*=\s*["'][^"']*display\s*:\s*none/i.test(text) ||
      /style\s*=\s*["'][^"']*visibility\s*:\s*hidden/i.test(text) ||
      /style\s*=\s*["'][^"']*font-size\s*:\s*0/i.test(text)) {
    issues.push({
      label:   "Hidden content detected",
      detail:  "Email contains HTML elements styled to be invisible — a known technique to hide phishing content from spam filters",
      weight:  3,
    });
  }

  // Check 5: Suspicious template language (mass-mail placeholders left in)
  if (/\[first[_ ]?name\]|\[last[_ ]?name\]|\[name\]|\{name\}|\[user\]/i.test(text)) {
    issues.push({
      label:   "Unfilled template placeholders",
      detail:  "Email contains unreplaced template tokens (e.g., [First Name]) — a sign of a mass phishing campaign",
      weight:  2,
    });
  }

  // Check 6: Suspicious grammar / misspelling signals (common phishing tells)
  const grammarRe = /\b(dear sir or madam|kindly do the needful|revert back to|please to be|we are a legitimate)\b/i;
  if (grammarRe.test(text)) {
    issues.push({
      label:   "Common phishing phrase patterns",
      detail:  "Email uses phrasing frequently associated with phishing templates (e.g., 'kindly do the needful', 'dear sir or madam')",
      weight:  1,
    });
  }

  if (issues.length === 0) return null;

  const totalWeight = issues.reduce((s, i) => s + i.weight, 0);
  const severity    = totalWeight >= 5 ? "high" : totalWeight >= 3 ? "medium" : "low";
  const descriptions = issues.map((i) => `${i.label}: ${i.detail}`);

  return {
    id:          "formatting_issues",
    category:    "Suspicious Formatting",
    description: `${issues.length} formatting anomal${issues.length > 1 ? "ies" : "y"} detected: ${descriptions.join("; ")}.`,
    explanation: "Phishing emails often have formatting tells: excessive CAPS and exclamation marks to create panic, lookalike Unicode letters to fool filters (е.g., Cyrillic 'е' instead of Latin 'e'), invisible hidden text to bypass spam detection, or unfilled template placeholders from mass-mail campaigns.",
    severity,
    match_count:      issues.length,
    matched_examples: descriptions.slice(0, 3),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. GENERIC GREETING
// Category: Impersonalization
// What: Non-personalized salutation — phishers rarely know your name.
// ═════════════════════════════════════════════════════════════════════════════
const GENERIC_GREETING_PATTERN =
  /\bdear (customer|user|account holder|member|valued (customer|client)|sir|ma'?am|recipient|subscriber|client|friend)\b/i;

/**
 * Detect impersonal greetings — legitimate services address you by name.
 */
export function detectGenericGreeting(text) {
  const m = text.match(GENERIC_GREETING_PATTERN);
  if (!m) return null;
  return {
    id:          "generic_greeting",
    category:    "Impersonalization",
    description: `Generic greeting detected: "${m[0].slice(0, 40)}" — sender does not know the recipient's name.`,
    explanation: "Legitimate companies address you by your first and/or last name because they have your account details. A generic greeting like 'Dear Customer' or 'Dear User' indicates the sender likely obtained your email from a list and does not know who you are — a hallmark of mass phishing campaigns.",
    severity:    "low",
    match_count: 1,
    matched_examples: [m[0].slice(0, 60)],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. THREATS & LEGAL INTIMIDATION
// Category: Psychological Manipulation
// What: Threats of arrest, lawsuits, or government action to force compliance.
// ═════════════════════════════════════════════════════════════════════════════
const THREAT_PATTERNS = [
  /\b(legal action|prosecute|prosecuted|arrested|penalty|fine|lawsuit)\b/i,
  /\breport (you|your account) to (the )?(authorities|police|irs|fbi|government|interpol)\b/i,
  /\bcriminal (charges?|complaint|record)\b/i,
  /\bdebt collection\b/i,
  /\bwarrant (has been|will be) issued\b/i,
  /\blaw enforcement (will|has been|is being)\b/i,
  /\byou will be (arrested|charged|prosecuted|sued)\b/i,
];

/**
 * Detect threats of legal action or authority-based coercion.
 */
export function detectThreats(text) {
  const matched = matchAll(THREAT_PATTERNS, text);
  if (matched.length === 0) return null;

  const severity = matched.length >= 2 ? "critical" : "high";

  return {
    id:          "threats",
    category:    "Psychological Manipulation",
    description: `${matched.length} threat or legal intimidation pattern${matched.length > 1 ? "s" : ""} found.`,
    explanation: "Scammers threaten legal action, government involvement, or arrest to force you to act immediately without verifying the claim. Real law enforcement does not initiate contact via email, and real companies handle disputes through formal channels — not by threatening to arrest you.",
    severity,
    match_count:      matched.length,
    matched_examples: extractExamples(matched, text),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. ATTACHMENT LURE
// Category: Malware Delivery
// What: Encouragement to open an attachment, particularly a dangerous file type.
// ═════════════════════════════════════════════════════════════════════════════
const ATTACHMENT_PATTERNS = [
  /\bopen (the )?(attached|attachment)\b/i,
  /\b(invoice|receipt|document|statement|file|report|order) (attached|is attached|has been attached|in the attachment)\b/i,
  /\bsee (the )?(attached|attachment)\b/i,
  /\bdownload (and open |the )?(attached|file|document|attachment)\b/i,
  /\b(run|execute|install) (the )?(attached|file|program|setup)\b/i,
  /\.(exe|zip|rar|7z|js|vbs|bat|cmd|msi|dmg|iso|ps1|jar)\b/i,
];

/**
 * Detect attempts to get the recipient to open a potentially malicious attachment.
 */
export function detectAttachmentLure(text) {
  const matched = matchAll(ATTACHMENT_PATTERNS, text);
  if (matched.length === 0) return null;

  // Executable extensions are worse than generic attachment language
  const hasExecutable = /\.(exe|js|vbs|bat|cmd|msi|ps1|jar)\b/i.test(text);
  const severity      = hasExecutable ? "critical" : "high";

  return {
    id:          "attachment_lure",
    category:    "Malware Delivery",
    description: `${matched.length} attachment-related pattern${matched.length > 1 ? "s" : ""} found${hasExecutable ? " — executable file type referenced" : ""}.`,
    explanation: "Malicious email attachments are one of the top malware delivery vectors. Phishers disguise payloads as invoices, receipts, shipping documents, or 'important files'. Executable file types (.exe, .js, .bat, .vbs) should never be opened from email. Even .zip files can contain malware.",
    severity,
    match_count:      matched.length,
    matched_examples: extractExamples(matched, text),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. REWARD / PRIZE BAIT
// Category: Social Engineering
// What: "Too good to be true" offers used to hook victims.
// ═════════════════════════════════════════════════════════════════════════════
const REWARD_PATTERNS = [
  /\b(you('ve| have) (won|been selected|been chosen))\b/i,
  /\b(congratulations|congrats)[^.!?]{0,80}(prize|winner|reward|gift|won)\b/i,
  /\bclaim (your )?(prize|reward|gift card|voucher|cash|winnings)\b/i,
  /\bfree (gift|prize|iphone|laptop|vacation|trip|money|cash)\b/i,
  /\blottery (winner|winning|prize)\b/i,
  /\binheritance\b/i,
  /\b(million|billion) (dollars?|pounds?|euros?|usd)\b/i,
  /\bunclaimed (funds?|prize|reward|money)\b/i,
  /\bbeneficiary\b/i,
];

/**
 * Detect "too good to be true" reward or prize lures.
 */
export function detectRewardBait(text) {
  const matched = matchAll(REWARD_PATTERNS, text);
  if (matched.length === 0) return null;

  return {
    id:          "reward_bait",
    category:    "Social Engineering",
    description: `${matched.length} prize or reward pattern${matched.length > 1 ? "s" : ""} found — email promises unexpected winnings or financial gain.`,
    explanation: "Advance-fee fraud and prize scams lure victims with promises of lottery winnings, inheritances, or free gifts. The goal is to get you excited enough to click a link, pay a 'release fee', or share personal information. If you didn't enter a contest, you didn't win one.",
    severity:    matched.length >= 2 ? "high" : "medium",
    match_count:      matched.length,
    matched_examples: extractExamples(matched, text),
  };
}
