import { NextResponse } from "next/server"
import { deploymentTools } from "@/lib/agent/tools/deployment-tools"
import { securityTools } from "@/lib/agent/tools/security-tools"
import { slackTools } from "@/lib/agent/tools/slack-tools"
import { createClient } from "@/lib/supabase/server"

// This route is called by a Vercel Cron Job every 5 minutes
// Configure in vercel.json: { "crons": [{ "path": "/api/monitor", "schedule": "*/5 * * * *" }] }

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const supabase = await createClient()

    // 1. Fetch monitored projects
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

      // 2. Check latest deployments
      const depResult = await deploymentTools.listDeployments.execute({
        projectId: project.vercel_project_id,
        limit: 5,
        status: null,
      }, { toolCallId: "monitor", messages: [], abortSignal: new AbortController().signal })

      if ("deployments" in depResult && Array.isArray(depResult.deployments)) {
        const failedDeps = depResult.deployments.filter((d: Record<string, unknown>) => d.state === "ERROR")
        for (const failed of failedDeps) {
          // Dedup by deployment ID in description — prevents re-alerting on old failures
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

      results.push({ project: project.name, status: "scanned", issues: issuesFound })
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
