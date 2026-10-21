import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isAuthorizedCron } from "@/lib/auth/cron"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {}
      for (const m of ["select", "eq", "gte", "limit", "ilike", "order", "in"]) q[m] = () => q
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
      return q
    },
  }),
}))

import { GET as digest } from "@/app/api/digest/route"
import { GET as monitor } from "@/app/api/monitor/route"

const req = (auth?: string) => new Request("https://x.test/cron", { headers: auth ? { Authorization: auth } : {} })

describe("isAuthorizedCron", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCron(req("Bearer s3cret"), "s3cret")).toBe(true)
  })

  it.each([undefined, "Bearer wrong", "s3cret", "bearer s3cret"])("rejects %s", (header) => {
    expect(isAuthorizedCron(req(header), "s3cret")).toBe(false)
  })

  it("fails closed when CRON_SECRET is not configured", () => {
    expect(isAuthorizedCron(req("Bearer undefined"), undefined)).toBe(false)
    expect(isAuthorizedCron(req("Bearer "), "")).toBe(false)
    expect(isAuthorizedCron(req(), undefined)).toBe(false)
  })
})

describe("cron routes without CRON_SECRET", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")))
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ["monitor", monitor],
    ["digest", digest],
  ])("%s rejects the literal 'Bearer undefined' header", async (_n, handler) => {
    expect((await handler(req("Bearer undefined"))).status).toBe(401)
  })
})
