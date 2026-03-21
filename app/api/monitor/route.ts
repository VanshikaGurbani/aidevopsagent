import { NextResponse } from "next/server"
import { deploymentTools } from "@/lib/agent/tools/deployment-tools"
import { securityTools } from "@/lib/agent/tools/security-tools"
import { slackTools } from "@/lib/agent/tools/slack-tools"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

async function checkUptime(project: { name: string; vercel_project_id: string; url?: string | null }) {
  const url = project.url ?? `https://${project.name}.vercel.app`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" })
    clearTimeout(timeout)
    return { up: res.ok || res.status < 500, status: res.status, url }
  } catch {
    return { up: false, status: 0, url }
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const supabase = await createClient()

    const { data: projects } = await supabase
      .from("monitored_projects")
      .select("*")
      .eq("status", "active")
      .limit(10)

    if (!projects?.length) {
      return NextResponse.json({ message: "No active projects to monitor" })
    }

    const results: Array<{ project: string; status: string; issues: number }> = []

    for (const project of projects) {
      let issuesFound = 0

      // ── 1. Deployment failure check ──────────────────────────
      const depResult = await deploymentTools.listDeployments.execute({
        projectId: project.vercel_project_id,
        limit: 5,
        status: null,
      }, { toolCallId: "monitor", messages: [], abortSignal: new AbortController().signal })

      if ("deployments" in depResult && Array.isArray(depResult.deployments)) {
        const failedDeps = depResult.deployments.filter((d: Record<string, unknown>) => d.state === "ERROR")
        for (const failed of failedDeps) {
          const { data: existing } = await supabase
            .from("incidents")
            .select("id")
            .eq("category", "deployment")
            .ilike("description", `%${failed.id}%`)
            .maybeSingle()

          if (!existing) {
            issuesFound++
            await securityTools.createIncident.execute({
              title: `Deployment failure: ${project.name}`,
              description: `Deployment ${failed.id} failed for project ${project.name}.`,
              severity: "high",
              category: "deployment",
              vercelProjectId: project.vercel_project_id,
              rootCause: null,
              agentAnalysis: "Detected via automated monitoring scan.",
              relatedDeploymentId: null,
            }, { toolCallId: "monitor-incident", messages: [], abortSignal: new AbortController().signal })

            await slackTools.sendDeploymentNotification.execute({
              projectName: project.name,
              deploymentUrl: failed.url ?? null,
              status: "error",
              target: failed.target ?? null,
              commitMessage: null,
              errorSummary: "Deployment failed — check logs",
            }, { toolCallId: "monitor-slack", messages: [], abortSignal: new AbortController().signal })
          }
        }
      }

      // ── 2. Uptime check ──────────────────────────────────────
      const uptime = await checkUptime(project)
      if (!uptime.up) {
        const { data: existingDown } = await supabase
          .from("incidents")
          .select("id")
          .eq("category", "uptime")
          .ilike("title", `%${project.name}%`)
          .eq("status", "open")
          .maybeSingle()

        if (!existingDown) {
          issuesFound++
          await securityTools.createIncident.execute({
            title: `Uptime alert: ${project.name} is down`,
            description: `${uptime.url} returned status ${uptime.status || "timeout"}. Project appears to be unreachable.`,
            severity: "critical",
            category: "uptime",
            vercelProjectId: project.vercel_project_id,
            rootCause: "Service unreachable",
            agentAnalysis: "Detected via automated uptime check.",
            relatedDeploymentId: null,
          }, { toolCallId: "monitor-uptime", messages: [], abortSignal: new AbortController().signal })

          await slackTools.sendCustomAlert.execute({
            message: `🔴 *Uptime Alert* — \`${project.name}\` is *DOWN*\n• URL: ${uptime.url}\n• Status: ${uptime.status || "timeout"}\nCheck the dashboard for details.`,
            channel: null,
          }, { toolCallId: "monitor-uptime-slack", messages: [], abortSignal: new AbortController().signal })
        }
      }

      results.push({ project: project.name, status: uptime.up ? "up" : "down", issues: issuesFound })
    }

    return NextResponse.json({
      success: true,
      scannedProjects: results.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[monitor] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
