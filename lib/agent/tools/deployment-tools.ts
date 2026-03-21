import { tool } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const VERCEL_API = "https://api.vercel.com"

function vercelHeaders() {
  // VERCEL_TOKEN is a built-in system env var Vercel injects automatically.
  // VERCEL_ACCESS_TOKEN is the manual fallback (user-provided).
  const token = process.env.VERCEL_TOKEN ?? process.env.VERCEL_ACCESS_TOKEN
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

export const deploymentTools = {
  listProjects: tool({
    description: "List all Vercel projects being monitored",
    inputSchema: z.object({
      limit: z.number().default(20).describe("Max number of projects to return"),
    }),
    execute: async ({ limit }) => {
      try {
        const res = await fetch(`${VERCEL_API}/v9/projects?limit=${limit}`, {
          headers: vercelHeaders(),
        })
        if (!res.ok) {
          const err = await res.text()
          return { error: `Vercel API error: ${err}`, projects: [] }
        }
        const data = await res.json()
        const projects = (data.projects || []).map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          framework: p.framework,
          latestDeployment: (p.latestDeployments as Record<string, unknown>[])?.[0] ?? null,
          updatedAt: p.updatedAt,
        }))
        return { projects, total: projects.length }
      } catch (e: unknown) {
        return { error: String(e), projects: [] }
      }
    },
  }),

  listDeployments: tool({
    description: "List recent deployments, optionally filtered by project or status",
    inputSchema: z.object({
      projectId: z.string().nullable().describe("Vercel project ID to filter by"),
      limit: z.number().default(10).describe("Max deployments to return"),
      status: z
        .enum(["building", "ready", "error", "canceled", "queued"])
        .nullable()
        .describe("Filter by deployment status"),
    }),
    execute: async ({ projectId, limit, status }) => {
      try {
        let url = `${VERCEL_API}/v6/deployments?limit=${limit}`
        if (projectId) url += `&projectId=${projectId}`
        if (status) url += `&state=${status}`
        const res = await fetch(url, { headers: vercelHeaders() })
        if (!res.ok) return { error: await res.text(), deployments: [] }
        const data = await res.json()
        const deployments = (data.deployments || []).map((d: Record<string, unknown>) => ({
          id: d.uid,
          name: d.name,
          url: d.url,
          state: d.state,
          target: d.target,
          meta: d.meta,
          createdAt: d.createdAt,
          buildingAt: d.buildingAt,
          ready: d.ready,
        }))
        return { deployments, total: deployments.length }
      } catch (e: unknown) {
        return { error: String(e), deployments: [] }
      }
    },
  }),

  getDeploymentDetails: tool({
    description: "Get detailed info about a specific deployment including logs summary",
    inputSchema: z.object({
      deploymentId: z.string().describe("Vercel deployment UID"),
    }),
    execute: async ({ deploymentId }) => {
      try {
        const [deployRes, eventsRes] = await Promise.all([
          fetch(`${VERCEL_API}/v13/deployments/${deploymentId}`, { headers: vercelHeaders() }),
          fetch(`${VERCEL_API}/v2/deployments/${deploymentId}/events?limit=50`, { headers: vercelHeaders() }),
        ])
        const deployment = deployRes.ok ? await deployRes.json() : null
        const events = eventsRes.ok ? await eventsRes.json() : []
        const errorLogs = Array.isArray(events)
          ? events.filter((e: Record<string, unknown>) => e.type === "error" || (typeof e.text === "string" && e.text.toLowerCase().includes("error")))
          : []
        return {
          deployment,
          errorLogs: errorLogs.slice(0, 10),
          totalEvents: Array.isArray(events) ? events.length : 0,
        }
      } catch (e: unknown) {
        return { error: String(e) }
      }
    },
  }),

  triggerDeployment: tool({
    description: "Trigger a new deployment for a Vercel project",
    inputSchema: z.object({
      projectName: z.string().describe("The Vercel project name"),
      target: z.enum(["production", "preview"]).default("preview"),
      gitBranch: z.string().nullable().describe("Git branch to deploy"),
    }),
    execute: async ({ projectName, target, gitBranch }) => {
      try {
        const body: Record<string, unknown> = { name: projectName, target }
        if (gitBranch) body.gitSource = { type: "github", ref: gitBranch }
        const res = await fetch(`${VERCEL_API}/v13/deployments`, {
          method: "POST",
          headers: vercelHeaders(),
          body: JSON.stringify(body),
        })
        if (!res.ok) return { error: await res.text(), success: false }
        const data = await res.json()
        return { success: true, deploymentId: data.id, url: data.url, state: data.readyState }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  cancelDeployment: tool({
    description: "Cancel a deployment that is currently building or queued",
    inputSchema: z.object({
      deploymentId: z.string().describe("Vercel deployment UID to cancel"),
    }),
    execute: async ({ deploymentId }) => {
      try {
        const res = await fetch(`${VERCEL_API}/v12/deployments/${deploymentId}/cancel`, {
          method: "PATCH",
          headers: vercelHeaders(),
        })
        if (!res.ok) return { error: await res.text(), success: false }
        return { success: true, deploymentId }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  rollbackDeployment: tool({
    description: "Rollback a project to a previously successful deployment",
    inputSchema: z.object({
      projectId: z.string().describe("Vercel project ID"),
      deploymentId: z.string().describe("Deployment UID to rollback to"),
    }),
    execute: async ({ projectId, deploymentId }) => {
      try {
        const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}/rollback/${deploymentId}`, {
          method: "POST",
          headers: vercelHeaders(),
        })
        if (!res.ok) return { error: await res.text(), success: false }
        return { success: true, message: `Rolled back project ${projectId} to deployment ${deploymentId}` }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  getProjectEnvironmentVariables: tool({
    description: "List environment variables for a Vercel project (values are redacted for security)",
    inputSchema: z.object({
      projectId: z.string().describe("Vercel project ID or name"),
    }),
    execute: async ({ projectId }) => {
      try {
        const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}/env`, {
          headers: vercelHeaders(),
        })
        if (!res.ok) return { error: await res.text(), envs: [] }
        const data = await res.json()
        const envs = (data.envs || []).map((e: Record<string, unknown>) => ({
          key: e.key,
          target: e.target,
          type: e.type,
          updatedAt: e.updatedAt,
        }))
        return { envs, total: envs.length }
      } catch (e: unknown) {
        return { error: String(e), envs: [] }
      }
    },
  }),

  saveDeploymentToDb: tool({
    description: "Save a deployment record to the database for tracking",
    inputSchema: z.object({
      vercelDeploymentId: z.string(),
      vercelProjectId: z.string(),
      projectName: z.string(),
      url: z.string().nullable(),
      status: z.enum(["building", "ready", "error", "canceled", "queued"]),
      target: z.enum(["production", "preview"]).nullable(),
      branch: z.string().nullable(),
      commitMessage: z.string().nullable(),
      errorMessage: z.string().nullable(),
    }),
    execute: async (data) => {
      try {
        const supabase = await createClient()
        const { error } = await supabase.from("deployments").upsert({
          vercel_deployment_id: data.vercelDeploymentId,
          vercel_project_id: data.vercelProjectId,
          project_name: data.projectName,
          url: data.url,
          status: data.status,
          target: data.target,
          branch: data.branch,
          commit_message: data.commitMessage,
          error_message: data.errorMessage,
          updated_at: new Date().toISOString(),
        }, { onConflict: "vercel_deployment_id" })
        if (error) return { error: error.message, success: false }
        return { success: true }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),
}
