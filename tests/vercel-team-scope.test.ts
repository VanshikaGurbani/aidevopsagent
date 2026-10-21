import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }))

import { deploymentTools } from "@/lib/agent/tools/deployment-tools"
import { securityTools } from "@/lib/agent/tools/security-tools"

const CTX = { toolCallId: "t", messages: [], abortSignal: new AbortController().signal }

function recordVercelCalls() {
  const urls: string[] = []
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    if (url.includes("/events")) return Response.json([])
    if (url.includes("/v6/deployments")) {
      return Response.json({
        deployments: [
          { uid: "dpl_new", state: "READY", target: "production" },
          { uid: "dpl_old", state: "READY", target: "production" },
        ],
      })
    }
    if (url.includes("/v9/projects?")) return Response.json({ projects: [{ id: "prj_1", name: "demo" }] })
    return Response.json({ envs: [], name: "demo" })
  }))
  return urls
}

afterEach(() => vi.unstubAllGlobals())

describe("Vercel API calls carry the team scope", () => {
  const cases: Array<[string, () => unknown]> = [
    ["listProjects", () => deploymentTools.listProjects.execute!({ limit: 5 }, CTX)],
    ["listDeployments", () => deploymentTools.listDeployments.execute!({ projectId: "prj_1", limit: 5, status: null }, CTX)],
    ["getDeploymentDetails", () => deploymentTools.getDeploymentDetails.execute!({ deploymentId: "dpl_1" }, CTX)],
    ["getProjectEnvironmentVariables", () => deploymentTools.getProjectEnvironmentVariables.execute!({ projectId: "prj_1" }, CTX)],
    ["rollbackDeployment", () => deploymentTools.rollbackDeployment.execute!({ projectId: "prj_1", deploymentId: "dpl_1" }, CTX)],
    ["rollbackToLastGoodDeployment", () => deploymentTools.rollbackToLastGoodDeployment.execute!({ projectName: "demo" }, CTX)],
    ["checkEnvVarDrift", () => deploymentTools.checkEnvVarDrift.execute!({ projectId: "prj_1", compareToProjectId: "prj_2" }, CTX)],
    ["checkDeploymentSecurity", () => securityTools.checkDeploymentSecurity.execute!({ deploymentId: "dpl_1", projectId: "prj_1" }, CTX)],
    ["scanProjectConfiguration", () => securityTools.scanProjectConfiguration.execute!({ projectId: "prj_1" }, CTX)],
  ]

  it.each(cases)("%s", async (_name, run) => {
    const urls = recordVercelCalls()
    await run()
    const vercel = urls.filter((u) => u.startsWith("https://api.vercel.com"))
    expect(vercel.length).toBeGreaterThan(0)
    for (const url of vercel) expect(url, url).toMatch(/[?&]teamId=/)
  })
})
