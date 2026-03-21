import { tool } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { IncidentSeverity, IncidentCategory } from "@/lib/types"

const VERCEL_API = "https://api.vercel.com"

function vercelHeaders() {
  const token = process.env.VERCEL_TOKEN ?? process.env.VERCEL_ACCESS_TOKEN
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

export const securityTools = {
  checkDeploymentSecurity: tool({
    description: "Analyze a deployment for security issues: exposed secrets, misconfigs, failed builds",
    inputSchema: z.object({
      deploymentId: z.string().describe("Vercel deployment UID to analyze"),
      projectId: z.string().nullable().describe("Vercel project ID"),
    }),
    execute: async ({ deploymentId, projectId }) => {
      try {
        const issues: string[] = []
        const warnings: string[] = []

        // Check deployment events for security signals
        const eventsRes = await fetch(
          `${VERCEL_API}/v2/deployments/${deploymentId}/events?limit=100`,
          { headers: vercelHeaders() }
        )
        if (eventsRes.ok) {
          const events = await eventsRes.json()
          if (Array.isArray(events)) {
            const textEvents = events.map((e: Record<string, unknown>) => String(e.text || "").toLowerCase())
            if (textEvents.some((t) => t.includes("secret") && t.includes("exposed")))
              issues.push("Potential secret exposure detected in build logs")
            if (textEvents.some((t) => t.includes("npm audit") && t.includes("critical")))
              issues.push("Critical npm vulnerability found during build")
            if (textEvents.some((t) => t.includes("eslint") && t.includes("error")))
              warnings.push("ESLint errors detected in build")
            if (textEvents.some((t) => t.includes("type error")))
              warnings.push("TypeScript type errors detected")
          }
        }

        // Check env vars for potential issues
        if (projectId) {
          const envRes = await fetch(`${VERCEL_API}/v9/projects/${projectId}/env`, {
            headers: vercelHeaders(),
          })
          if (envRes.ok) {
            const envData = await envRes.json()
            const envKeys: string[] = (envData.envs || []).map((e: Record<string, unknown>) => String(e.key))
            if (envKeys.some((k) => k.startsWith("NEXT_PUBLIC_") && k.toLowerCase().includes("secret")))
              issues.push("Sensitive variable exposed as NEXT_PUBLIC_ (visible to browser)")
            if (!envKeys.includes("NODE_ENV"))
              warnings.push("NODE_ENV not set — may affect runtime behavior")
          }
        }

        return {
          deploymentId,
          criticalIssues: issues,
          warnings,
          securityScore: issues.length === 0 ? (warnings.length === 0 ? 100 : 75) : 40,
          checkedAt: new Date().toISOString(),
        }
      } catch (e: unknown) {
        return { error: String(e) }
      }
    },
  }),

  scanProjectConfiguration: tool({
    description: "Scan a Vercel project configuration for security misconfigurations",
    inputSchema: z.object({
      projectId: z.string().describe("Vercel project ID to scan"),
    }),
    execute: async ({ projectId }) => {
      try {
        const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}`, {
          headers: vercelHeaders(),
        })
        if (!res.ok) return { error: await res.text() }
        const project = await res.json()

        const findings: Array<{ severity: string; issue: string; recommendation: string }> = []

        if (!project.passwordProtection?.deploymentType)
          findings.push({
            severity: "medium",
            issue: "Password protection not enabled",
            recommendation: "Enable password protection for preview deployments",
          })
        if (!project.ssoProtection)
          findings.push({
            severity: "low",
            issue: "SSO protection not configured",
            recommendation: "Consider enabling SSO protection for team access control",
          })
        if (project.publicSource === true)
          findings.push({
            severity: "high",
            issue: "Project source code is publicly accessible",
            recommendation: "Set project visibility to private if source should not be public",
          })

        return {
          projectId,
          projectName: project.name,
          findings,
          totalFindings: findings.length,
          highSeverity: findings.filter((f) => f.severity === "high").length,
          scannedAt: new Date().toISOString(),
        }
      } catch (e: unknown) {
        return { error: String(e) }
      }
    },
  }),

  createIncident: tool({
    description: "Create a new incident record in the database when an issue is detected",
    inputSchema: z.object({
      title: z.string().describe("Short incident title"),
      description: z.string().describe("Detailed description of the incident"),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      category: z.enum(["deployment", "security", "performance", "availability", "configuration", "code"]),
      vercelProjectId: z.string().nullable(),
      rootCause: z.string().nullable().describe("Root cause analysis if known"),
      agentAnalysis: z.string().nullable().describe("Agent's full analysis and reasoning"),
      relatedDeploymentId: z.string().nullable().describe("UUID of related deployment in DB"),
    }),
    execute: async ({ title, description, severity, category, vercelProjectId, rootCause, agentAnalysis, relatedDeploymentId }) => {
      try {
        const supabase = await createClient()

        // Look up project UUID from vercel project id
        let projectId: string | null = null
        if (vercelProjectId) {
          const { data } = await supabase
            .from("monitored_projects")
            .select("id")
            .eq("vercel_project_id", vercelProjectId)
            .single()
          projectId = data?.id ?? null
        }

        const { data, error } = await supabase
          .from("incidents")
          .insert({
            project_id: projectId,
            vercel_project_id: vercelProjectId,
            title,
            description,
            severity: severity as IncidentSeverity,
            category: category as IncidentCategory,
            root_cause: rootCause,
            agent_analysis: agentAnalysis,
            related_deployment_id: relatedDeploymentId,
            status: "open",
            detected_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) return { error: error.message, success: false }
        return { success: true, incidentId: data.id, incident: data }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  updateIncidentStatus: tool({
    description: "Update the status or resolution of an existing incident",
    inputSchema: z.object({
      incidentId: z.string().describe("UUID of the incident to update"),
      status: z.enum(["open", "investigating", "resolved", "dismissed"]),
      resolution: z.string().nullable().describe("Resolution description if resolved"),
    }),
    execute: async ({ incidentId, status, resolution }) => {
      try {
        const supabase = await createClient()
        const updates: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        }
        if (resolution) updates.resolution = resolution
        if (status === "resolved") updates.resolved_at = new Date().toISOString()

        const { error } = await supabase
          .from("incidents")
          .update(updates)
          .eq("id", incidentId)

        if (error) return { error: error.message, success: false }
        return { success: true, incidentId, newStatus: status }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  logSecurityEvent: tool({
    description: "Log a security event to the security feed for monitoring",
    inputSchema: z.object({
      eventType: z.string().describe("Type of security event e.g. 'unauthorized_access', 'secret_scan'"),
      title: z.string(),
      description: z.string().nullable(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      vercelProjectId: z.string().nullable(),
      source: z.string().nullable().describe("Source of the detection e.g. 'build_logs', 'config_scan'"),
    }),
    execute: async ({ eventType, title, description, severity, vercelProjectId, source }) => {
      try {
        const supabase = await createClient()

        let projectId: string | null = null
        if (vercelProjectId) {
          const { data } = await supabase
            .from("monitored_projects")
            .select("id")
            .eq("vercel_project_id", vercelProjectId)
            .single()
          projectId = data?.id ?? null
        }

        const { data, error } = await supabase
          .from("security_events")
          .insert({
            project_id: projectId,
            vercel_project_id: vercelProjectId,
            event_type: eventType,
            title,
            description,
            severity,
            source,
          })
          .select()
          .single()

        if (error) return { error: error.message, success: false }
        return { success: true, eventId: data.id }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  getOpenIncidents: tool({
    description: "Fetch all open and investigating incidents from the database",
    inputSchema: z.object({
      severity: z.enum(["critical", "high", "medium", "low", "info"]).nullable(),
      limit: z.number().default(20),
    }),
    execute: async ({ severity, limit }) => {
      try {
        const supabase = await createClient()
        let query = supabase
          .from("incidents")
          .select("*")
          .in("status", ["open", "investigating"])
          .order("created_at", { ascending: false })
          .limit(limit)

        if (severity) query = query.eq("severity", severity)

        const { data, error } = await query
        if (error) return { error: error.message, incidents: [] }
        return { incidents: data, total: data.length }
      } catch (e: unknown) {
        return { error: String(e), incidents: [] }
      }
    },
  }),
}
