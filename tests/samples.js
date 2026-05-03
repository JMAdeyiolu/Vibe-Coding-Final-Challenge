/**
 * samples.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Realistic test email samples for PhishGuard AI.
 *
 * Each sample has:
 *   name           — descriptive label
 *   category       — "phishing" | "clean"
 *   expected_risk  — expected risk level from the analyzer
 *   description    — what makes this sample interesting
 *   email          — the raw email text (headers + body)
 *
 * Usage:  import { SAMPLES } from "./samples.js"
 */

export const SAMPLES = [

  // ═══════════════════════════════════════════════════════════════════════════
  // PHISHING SAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name:          "PayPal Account Suspension",
    category:      "phishing",
    expected_risk: "Critical",
    description:   "Classic brand impersonation — urgency + credential harvesting + suspicious URL. All top-weight flags should trigger.",
    email: `From: PayPal Security <security@paypa1-secure.net>
To: customer@example.com
Reply-To: paypal-support@secure-paypa1.xyz
Subject: URGENT: Your PayPal Account Has Been Suspended

Dear Customer,

We have detected unusual activity on your PayPal account. Your account has been suspended immediately due to a security breach.

ACTION REQUIRED: You must verify your account within 24 hours or your account will be permanently closed.

To restore access, please enter your password and confirm your billing details at the link below:

http://paypa1-secure.net/restore?token=aHR0cHM6Ly9ldmlsLmNvbS9zdGVhbA==

Do not ignore this message. Failure to verify your account will result in permanent suspension and legal action may be taken.

PayPal Security Team
© PayPal Inc.`,
  },

  {
    name:          "IRS Tax Refund Phishing",
    category:      "phishing",
    expected_risk: "Critical",
    description:   "Government impersonation with credential harvesting, threats, and urgency. Reply-To header mismatch.",
    email: `From: IRS Tax Refund Department <refund@irs-gov-refund.top>
Reply-To: irs.refunds@gmail.com
To: taxpayer@example.com
Subject: Final Notice: Your $3,847.00 Tax Refund Is Pending

Dear Taxpayer,

The Internal Revenue Service has processed your 2025 tax return and determined that you are owed a refund of $3,847.00.

ACTION REQUIRED — You must claim your refund within 48 hours or it will be forfeited.

To receive your refund, you must provide your Social Security Number, bank account number, and routing number by logging in here:

http://irs-refund-portal.click/claim?id=TX-2025-REF

WARNING: Failure to respond within the deadline will result in your refund being redirected to the U.S. Treasury. If we suspect fraudulent inactivity, we will report your account to law enforcement and criminal charges may be filed.

Do not delay. Act now.

IRS Refund Processing Department
U.S. Department of the Treasury`,
  },

  {
    name:          "Lottery Prize Scam",
    category:      "phishing",
    expected_risk: "High",
    description:   "Advance-fee / prize fraud with reward bait, generic greeting, urgency. No explicit credential request but links to a data-harvesting form.",
    email: `From: Global Lottery Commission <awards@globallottery.gq>
To: winner@example.com
Subject: CONGRATULATIONS!! You Have Won $2,500,000.00!!!

Dear Member,

CONGRATULATIONS! You have been selected as a WINNER in the Global International Lottery! You have won TWO MILLION FIVE HUNDRED THOUSAND DOLLARS ($2,500,000.00 USD).

Your email was chosen from millions of entries in our annual sweepstakes. You must claim your prize within 7 days or it will be forfeited and awarded to another winner.

To claim your prize, click the link below and provide your full name and contact details:

http://bit.ly/GlobalLotteryWinner2026

This offer is time-sensitive. Act immediately.

Yours sincerely,
Mr. James Williams
Awards Director, Global Lottery Commission`,
  },

  {
    name:          "IT Help Desk Credential Phish",
    category:      "phishing",
    expected_risk: "High",
    description:   "Internal IT impersonation with credential harvesting and urgency. Common in corporate environments.",
    email: `From: IT Help Desk <helpdesk@company-it-support.online>
To: employee@company.com
Subject: Action Required: Reset Your Corporate Password Now

Dear User,

Your corporate Microsoft account password is set to expire within 24 hours. Failure to reset it immediately will lock you out of all company systems.

Please sign in to verify your identity and update your credentials:

https://company-it-portal.online/reset-password

You will need to enter your current username and password to confirm your identity before setting a new password.

If you believe you received this message in error, do not ignore it — contact IT immediately or your access will be terminated.

IT Support Desk
Company IT Department`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAN SAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name:          "Legitimate Amazon Order Confirmation",
    category:      "clean",
    expected_risk: "Low",
    description:   "Real-looking transactional email from Amazon. Should score very low — no pressure tactics, legitimate domain, personalized.",
    email: `From: Amazon.com <auto-confirm@amazon.com>
To: jane.smith@example.com
Subject: Your Amazon.com order of "Wireless Noise-Cancelling Headphones" has shipped

Hello Jane,

Your order has shipped!

Order #114-7294826-0193847
Estimated delivery: Wednesday, May 7

Item: Sony WH-1000XM5 Wireless Noise-Cancelling Headphones
Quantity: 1
Shipped via: UPS Ground

You can track your package here:
https://www.amazon.com/progress-tracker/package/?orderId=114-7294826-0193847

If you have any questions about your order, visit our Help Center at:
https://www.amazon.com/hz/contact-us

Thank you for shopping with us.

Amazon.com
© 2026 Amazon.com, Inc. 410 Terry Ave N, Seattle, WA 98109`,
  },

  {
    name:          "GitHub Pull Request Notification",
    category:      "clean",
    expected_risk: "Low",
    description:   "Standard developer notification. Should score zero — no phishing signals whatsoever.",
    email: `From: GitHub <notifications@github.com>
To: dev@example.com
Subject: [octocat/hello-world] Fix null pointer exception in user auth flow (PR #142)

octocat opened a pull request.

Repository: octocat/hello-world
Branch: fix/null-pointer-auth → main
Title: Fix null pointer exception in user auth flow

Changes:
  src/auth/UserService.java  |  12 ++++----
  tests/auth/UserServiceTest |   8 ++++++

Description:
  This PR addresses the NullPointerException that occurs when a user
  attempts to log in with a cached but expired session token. Added
  a null check before session validation and updated unit tests.

Review this pull request at:
https://github.com/octocat/hello-world/pull/142

You are receiving this because you are subscribed to this repository.
To unsubscribe, visit: https://github.com/notifications/unsubscribe-auth/AABC123`,
  },

  {
    name:          "Team Meeting Invite",
    category:      "clean",
    expected_risk: "Low",
    description:   "Plain calendar invite forwarded as email. Mentions urgency-adjacent words ('tomorrow', 'confirm') but in a completely normal context.",
    email: `From: Sarah Johnson <sarah.johnson@mycompany.com>
To: team@mycompany.com
Subject: Team Sync - Tomorrow 2pm EST

Hi team,

Just a reminder that we have our weekly team sync tomorrow (Friday) at 2:00 PM EST.

Agenda:
  1. Sprint review — Q2 progress update
  2. Blockers and open issues
  3. Planning for next week

Please confirm your attendance by replying to this email. If you can't make it, let me know in advance so we can reschedule.

Zoom link: https://zoom.us/j/94123456789
Meeting ID: 941 2345 6789

See you tomorrow!
Sarah

Sarah Johnson | Product Manager
MyCompany Inc. | sarah.johnson@mycompany.com`,
  },

];
