import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

async function postToSlack(text: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = await createClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: incidents }, { data: prs }, { data: security }, { data: deployments }] =
    await Promise.all([
      supabase.from("incidents").select("severity, status, created_at").gte("created_at", since),
      supabase.from("pull_requests").select("status, created_at").gte("created_at", since),
      supabase.from("security_events").select("severity, created_at").gte("created_at", since),
      supabase.from("deployments").select("status, created_at").gte("created_at", since),
    ])

  const totalIncidents = incidents?.length ?? 0
  const resolvedIncidents = incidents?.filter((i) => i.status === "resolved").length ?? 0
  const criticalIncidents = incidents?.filter((i) => i.severity === "critical").length ?? 0

  const totalPRs = prs?.length ?? 0
  const mergedPRs = prs?.filter((p) => p.status === "merged").length ?? 0

  const totalSecurity = security?.length ?? 0
  const highSecurity = security?.filter((s) => s.severity === "high" || s.severity === "critical").length ?? 0

  const totalDeploys = deployments?.length ?? 0
  const failedDeploys = deployments?.filter((d) => d.status === "error").length ?? 0
  const successRate = totalDeploys > 0 ? Math.round(((totalDeploys - failedDeploys) / totalDeploys) * 100) : 100

  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const dateRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  const message = [
    `📊 *Weekly DevOps Digest* — ${dateRange}`,
    ``,
    `*🚀 Deployments*`,
    `• Total: ${totalDeploys}   •  Failed: ${failedDeploys}   •  Success rate: ${successRate}%`,
    ``,
    `*🚨 Incidents*`,
    `• Created: ${totalIncidents}   •  Resolved: ${resolvedIncidents}   •  Critical: ${criticalIncidents}`,
    ``,
    `*🔀 Pull Requests*`,
    `• Raised by agent: ${totalPRs}   •  Merged: ${mergedPRs}`,
    ``,
    `*🛡 Security Events*`,
    `• Detected: ${totalSecurity}   •  High/Critical: ${highSecurity}`,
    ``,
    `_View full details at https://v0-ai-dev-ops-agent.vercel.app_`,
  ].join("\n")

  await postToSlack(message)

  return NextResponse.json({ success: true, dateRange, stats: { totalIncidents, resolvedIncidents, totalPRs, mergedPRs, totalSecurity, totalDeploys, failedDeploys } })
}
