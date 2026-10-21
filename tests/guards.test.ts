import { describe, expect, it } from "vitest"
import { checkBranch, checkContent, checkPath, checkText, findSecrets, isDryRun, prsAreDrafts } from "@/lib/agent/guards"

// Secret-shaped fixtures are assembled at runtime so no real-looking token sits in the repo.
const fake = {
  aws: "AKIA" + "IOSFODNN7EXAMPLE",
  github: "ghp_" + "a".repeat(36),
  slack: "xoxb-" + "123456789012-abcdefghijkl",
  google: "AIza" + "Sy" + "A".repeat(33),
  stripe: "sk_" + "live_" + "abcdefghijklmnop1234",
  privateKey: "-----BEGIN RSA " + "PRIVATE KEY-----",
  jwt: ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "abcdefghijklmnop"].join("."),
}

describe("findSecrets", () => {
  it.each(Object.entries(fake))("detects %s", (_name, value) => {
    expect(findSecrets(`const x = "${value}"`).length).toBeGreaterThan(0)
  })

  it("detects a hardcoded credential assignment", () => {
    expect(findSecrets(`const API_KEY = "abcdefghijklmnopqrstuvwxyz123456"`)).toContain("hardcoded credential")
  })

  it("does not flag environment variable reads or ordinary code", () => {
    expect(findSecrets(`const key = process.env.PAYMENTS_API_KEY ?? ""`)).toEqual([])
    expect(findSecrets(`export function total(items: number[]) { return items.reduce((a, b) => a + b, 0) }`)).toEqual([])
    expect(findSecrets(`token: "short"`)).toEqual([])
  })

  it("reports secret types, never the secret itself", () => {
    const result = checkContent(`const k = "${fake.github}"`)
    expect(result?.error).toContain("GitHub token")
    expect(result?.error).not.toContain(fake.github)
  })
})

describe("checkPath", () => {
  it.each([".github/workflows/ci.yml", ".env", ".env.production", "deploy.sh", ".claude/settings.local.json", "keys/server.pem", "a/../../etc/passwd", "/etc/passwd"])(
    "blocks %s",
    (p) => expect(checkPath(p, {})?.blocked).toBe(true),
  )

  it.each(["app/api/monitor/route.ts", "vercel.json", "package.json", "lib/utils.ts", "./README.md"])("allows %s by default", (p) => {
    expect(checkPath(p, {})).toBeNull()
  })

  it("restricts edits to AGENT_ALLOWED_PATHS when set", () => {
    const env = { AGENT_ALLOWED_PATHS: "app/, vercel.json, lib/*.ts" }
    expect(checkPath("app/api/monitor/route.ts", env)).toBeNull()
    expect(checkPath("vercel.json", env)).toBeNull()
    expect(checkPath("lib/utils.ts", env)).toBeNull()
    expect(checkPath("lib/agent/guards.ts", env)?.blocked).toBe(true)
    expect(checkPath("package.json", env)?.blocked).toBe(true)
  })

  it("still applies the deny list inside an allowed directory", () => {
    expect(checkPath(".github/workflows/ci.yml", { AGENT_ALLOWED_PATHS: ".github/" })?.blocked).toBe(true)
  })
})

describe("checkBranch", () => {
  it.each(["main", "master", "Production", "release"])("blocks direct commits to %s", (b) => expect(checkBranch(b)?.blocked).toBe(true))
  it("allows a fix branch", () => expect(checkBranch("fix/vercel-json-trailing-comma")).toBeNull())
})

describe("checkContent / checkText", () => {
  it("blocks oversized files", () => expect(checkContent("x".repeat(250_000))?.blocked).toBe(true))
  it("blocks secrets in PR text", () => expect(checkText(`rotated ${fake.slack}`, "PR description")?.blocked).toBe(true))
  it("passes clean text", () => expect(checkText("fix: correct the cron expression", "commit message")).toBeNull())
})

describe("env switches", () => {
  it("dry run is off unless enabled", () => {
    expect(isDryRun({})).toBe(false)
    expect(isDryRun({ AGENT_DRY_RUN: "false" })).toBe(false)
    expect(isDryRun({ AGENT_DRY_RUN: "true" })).toBe(true)
    expect(isDryRun({ AGENT_DRY_RUN: "1" })).toBe(true)
  })

  it("PRs are drafts unless AGENT_PR_READY is set", () => {
    expect(prsAreDrafts({})).toBe(true)
    expect(prsAreDrafts({ AGENT_PR_READY: "true" })).toBe(false)
  })
})
