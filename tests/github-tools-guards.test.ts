import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ insert: async () => ({ error: null }), update: () => ({ eq: async () => ({ error: null }) }) }) }),
}))

import { deploymentTools } from "@/lib/agent/tools/deployment-tools"
import { githubTools } from "@/lib/agent/tools/github-tools"

const CTX = { toolCallId: "t", messages: [], abortSignal: new AbortController().signal }
const base = { owner: "o", repo: "r" }

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ commit: { sha: "abc" }, number: 7, html_url: "https://github.com/o/r/pull/7", title: "t", state: "open" }))
  vi.stubGlobal("fetch", fetchMock)
  delete process.env.AGENT_DRY_RUN
  delete process.env.AGENT_ALLOWED_PATHS
  delete process.env.AGENT_PR_READY
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.AGENT_DRY_RUN
  delete process.env.AGENT_ALLOWED_PATHS
})

const commit = async (over: Record<string, unknown> = {}) =>
  (await githubTools.commitFileChange.execute!(
    { ...base, branch: "fix/x", path: "vercel.json", content: "{}", commitMessage: "fix: json", existingFileSha: null, ...over },
    CTX,
  )) as Record<string, unknown>

describe("commitFileChange", () => {
  it("commits a normal change", async () => {
    expect(await commit()).toMatchObject({ success: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["a protected branch", { branch: "main" }],
    ["a workflow file", { path: ".github/workflows/ci.yml" }],
    ["an env file", { path: ".env.local" }],
    ["content containing a secret", { content: `const k = "${"ghp_" + "b".repeat(36)}"` }],
  ])("blocks %s without calling GitHub", async (_n, over) => {
    expect(await commit(over)).toMatchObject({ success: false, blocked: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("blocks paths outside AGENT_ALLOWED_PATHS", async () => {
    process.env.AGENT_ALLOWED_PATHS = "app/"
    expect(await commit({ path: "package.json" })).toMatchObject({ blocked: true })
    expect(await commit({ path: "app/page.tsx" })).toMatchObject({ success: true })
  })

  it("does nothing in dry-run mode but reports what it would do", async () => {
    process.env.AGENT_DRY_RUN = "true"
    expect(await commit()).toMatchObject({ dryRun: true, wouldDo: expect.stringContaining("vercel.json") })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("createPullRequest", () => {
  const open = async (over: Record<string, unknown> = {}) =>
    (await githubTools.createPullRequest.execute!(
      { ...base, title: "fix: cron", body: "explains the fix", headBranch: "fix/cron", baseBranch: "main", incidentId: null, ...over },
      CTX,
    )) as Record<string, unknown>

  it("opens the PR as a draft by default", async () => {
    await open()
    const pulls = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/pulls"))!
    expect(JSON.parse(String((pulls[1] as RequestInit).body)).draft).toBe(true)
  })

  it("opens a ready PR when AGENT_PR_READY is set", async () => {
    process.env.AGENT_PR_READY = "true"
    await open()
    const pulls = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/pulls"))!
    expect(JSON.parse(String((pulls[1] as RequestInit).body)).draft).toBe(false)
  })

  it("retries as a normal PR when the repository does not support drafts", async () => {
    let first = true
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/pulls") && first) {
        first = false
        return Response.json({ message: "Draft pull requests are not supported in this repository." }, { status: 422 })
      }
      return Response.json({ number: 8, html_url: "https://github.com/o/r/pull/8", title: "t", state: "open" })
    })
    expect(await open()).toMatchObject({ success: true, prNumber: 8 })
    const bodies = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/pulls")).map(([, init]) => JSON.parse(String((init as RequestInit).body)).draft)
    expect(bodies).toEqual([true, false])
  })

  it("refuses to put a secret in the PR description", async () => {
    expect(await open({ body: `used ${"xoxb-" + "123456789012-abcdefghijkl"}` })).toMatchObject({ blocked: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses to open a PR from a protected branch", async () => {
    expect(await open({ headBranch: "main" })).toMatchObject({ blocked: true })
  })
})

describe("dry run covers Vercel mutations", () => {
  it.each([
    ["triggerDeployment", () => deploymentTools.triggerDeployment.execute!({ projectName: "p", target: "production", gitBranch: null }, CTX)],
    ["cancelDeployment", () => deploymentTools.cancelDeployment.execute!({ deploymentId: "d" }, CTX)],
    ["rollbackDeployment", () => deploymentTools.rollbackDeployment.execute!({ projectId: "p", deploymentId: "d" }, CTX)],
  ])("%s makes no request", async (_n, run) => {
    process.env.AGENT_DRY_RUN = "true"
    expect(await (run() as Promise<unknown>)).toMatchObject({ dryRun: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
