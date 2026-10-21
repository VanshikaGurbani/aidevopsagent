import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFakeDb, fakeSupabase, type FakeDb } from "./helpers/fake-supabase"

const state = vi.hoisted(() => ({ db: null as unknown as FakeDb }))
vi.mock("@/lib/supabase/server", async () => {
  const { fakeSupabase } = await import("./helpers/fake-supabase")
  return { createClient: async () => fakeSupabase(state.db) }
})

import { GET } from "@/app/api/monitor/route"

const PROJECT = { id: "p1", vercel_project_id: "prj_1", name: "demo-app", url: "https://demo-app.vercel.app", status: "active" }
const slackBodies: string[] = []

function stubNetwork(opts: { liveStatus: number; deployments: Array<{ uid: string; state: string }> }) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith("https://api.vercel.com/v6/deployments")) {
      return Response.json({ deployments: opts.deployments.map((d) => ({ ...d, name: "demo-app", url: "demo.vercel.app", target: "production" })) })
    }
    if (url.startsWith("https://hooks.slack.test")) {
      slackBodies.push(String(init?.body))
      return new Response("ok")
    }
    if (url === PROJECT.url) return new Response(null, { status: opts.liveStatus })
    throw new Error(`unexpected request: ${url}`)
  }))
}

const authed = () => new Request("https://x.test/api/monitor", { headers: { Authorization: "Bearer test-secret" } })

beforeEach(() => {
  state.db = createFakeDb({ monitored_projects: [PROJECT] })
  slackBodies.length = 0
  process.env.CRON_SECRET = "test-secret"
  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/services/T/B/X"
})
afterEach(() => vi.unstubAllGlobals())

describe("GET /api/monitor", () => {
  it("rejects requests without the cron secret", async () => {
    stubNetwork({ liveStatus: 200, deployments: [] })
    const res = await GET(new Request("https://x.test/api/monitor"))
    expect(res.status).toBe(401)
  })

  it("stores an availability incident when the project URL is down", async () => {
    stubNetwork({ liveStatus: 503, deployments: [] })
    const res = await GET(authed())
    expect(res.status).toBe(200)
    // Regression: category "uptime" violated the incidents CHECK constraint, so nothing was stored.
    expect(state.db.errors).toEqual([])
    const incidents = state.db.tables.incidents ?? []
    expect(incidents).toHaveLength(1)
    expect(incidents[0]).toMatchObject({ category: "availability", severity: "critical", vercel_project_id: "prj_1" })
    expect(slackBodies.some((b) => b.includes("DOWN"))).toBe(true)
  })

  it("does not create a second uptime incident while one is open", async () => {
    stubNetwork({ liveStatus: 503, deployments: [] })
    await GET(authed())
    await GET(authed())
    expect(state.db.tables.incidents).toHaveLength(1)
  })

  it("records one incident per failed deployment and dedupes across runs", async () => {
    stubNetwork({ liveStatus: 200, deployments: [{ uid: "dpl_bad", state: "ERROR" }, { uid: "dpl_ok", state: "READY" }] })
    await GET(authed())
    await GET(authed())
    const incidents = state.db.tables.incidents ?? []
    expect(incidents).toHaveLength(1)
    expect(incidents[0]).toMatchObject({ category: "deployment", severity: "high" })
    expect(String(incidents[0].description)).toContain("dpl_bad")
  })

  it("stays quiet when everything is healthy", async () => {
    stubNetwork({ liveStatus: 200, deployments: [{ uid: "dpl_ok", state: "READY" }] })
    await GET(authed())
    expect(state.db.tables.incidents ?? []).toHaveLength(0)
    expect(slackBodies).toHaveLength(0)
  })
})
