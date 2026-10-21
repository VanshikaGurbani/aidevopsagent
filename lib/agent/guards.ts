/**
 * Safety guards for actions the agent takes with real side effects (committing to GitHub,
 * rolling back or redeploying on Vercel). Everything here is a pure function of its inputs and
 * environment so it can be unit tested; the tools call these before touching any API.
 *
 * Environment:
 *   AGENT_DRY_RUN=true          report what would be done instead of doing it
 *   AGENT_ALLOWED_PATHS=a,b     only allow edits under these comma-separated paths/globs
 *   AGENT_PR_READY=true         open PRs ready for review instead of as drafts
 */

export interface GuardBlock {
  success: false
  blocked: true
  error: string
}

export interface DryRunResult {
  success: false
  dryRun: true
  wouldDo: string
  input: unknown
}

type Env = Record<string, string | undefined>

export function isDryRun(env: Env = process.env): boolean {
  return /^(1|true|yes)$/i.test(env.AGENT_DRY_RUN ?? "")
}

export function dryRunResult(action: string, input: unknown): DryRunResult {
  return { success: false, dryRun: true, wouldDo: action, input }
}

export function blocked(reason: string): GuardBlock {
  return { success: false, blocked: true, error: `Blocked by safety guard: ${reason}` }
}

export function prsAreDrafts(env: Env = process.env): boolean {
  return !/^(1|true|yes)$/i.test(env.AGENT_PR_READY ?? "")
}

// ── branches ────────────────────────────────────────────────────

const PROTECTED_BRANCHES = new Set(["main", "master", "production", "prod", "release"])

/** The agent proposes changes on its own branch; it never writes straight to a long-lived branch. */
export function checkBranch(branch: string): GuardBlock | null {
  if (PROTECTED_BRANCHES.has(branch.toLowerCase())) {
    return blocked(`refusing to commit directly to "${branch}"; create a fix branch and open a PR`)
  }
  return null
}

// ── paths ───────────────────────────────────────────────────────

/** Files an automated fix must never touch: CI/deploy config, credentials, local tooling. */
const DENIED_PATHS: RegExp[] = [
  /(^|\/)\.git\//,
  /(^|\/)\.github\//,
  /(^|\/)\.env($|\.)/,
  /(^|\/)\.claude\//,
  /(^|\/)deploy\.sh$/,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_(rsa|ed25519)(\.pub)?$/,
]

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")
  return new RegExp(`^${escaped}$`)
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.?\//, "")
}

export function checkPath(path: string, env: Env = process.env): GuardBlock | null {
  const p = normalizePath(path)
  if (!p || /^[\\/]/.test(path) || /^[A-Za-z]:/.test(path) || p.split("/").includes("..")) return blocked(`invalid path "${path}"`)
  if (DENIED_PATHS.some((re) => re.test(p))) return blocked(`"${p}" is not editable by the agent (CI, deploy, credential or tooling file)`)

  const allowed = (env.AGENT_ALLOWED_PATHS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  if (allowed.length > 0 && !allowed.some((entry) => globToRegExp(normalizePath(entry).replace(/\/$/, "/**")).test(p))) {
    return blocked(`"${p}" is outside AGENT_ALLOWED_PATHS (${allowed.join(", ")})`)
  }
  return null
}

// ── content ─────────────────────────────────────────────────────

export const MAX_FILE_BYTES = 200_000

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["Slack webhook URL", /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Stripe key", /\b[sr]k_(live|test)_[0-9A-Za-z]{16,}\b/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JSON web token", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["hardcoded credential", /\b(api[_-]?key|secret|token|password|passwd)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-/+=.]{20,}["']/i],
]

/** Names of secret types found in text (never the secret itself, so results are safe to log). */
export function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name)
}

export function checkContent(content: string): GuardBlock | null {
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    return blocked(`file is larger than ${MAX_FILE_BYTES} bytes; the agent only makes small edits`)
  }
  const found = findSecrets(content)
  if (found.length > 0) {
    return blocked(`the change contains what looks like a secret (${found.join(", ")}); use an environment variable instead`)
  }
  return null
}

/** Free text that goes into a PR title/body or a commit message must not leak secrets either. */
export function checkText(text: string, what: string): GuardBlock | null {
  const found = findSecrets(text)
  return found.length > 0 ? blocked(`${what} contains what looks like a secret (${found.join(", ")})`) : null
}
