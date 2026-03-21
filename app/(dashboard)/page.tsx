import {
  Rocket,
  AlertTriangle,
  ShieldAlert,
  Activity,
  GitPullRequest,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { StatCard } from "@/components/dashboard/stat-card"
import { StatusBadge } from "@/components/dashboard/status-badge"
import Link from "next/link"
import type { Incident, SecurityEvent } from "@/lib/types"
import { fetchAllProjects, fetchAllDeployments, normalizeState, type VercelDeployment } from "@/lib/vercel"
import { createClient as createSBClient } from "@/lib/supabase/server"

export const revalidate = 30

async function getDashboardData() {
  const supabase = await createClient()

  const [
    projects,
    allDeployments,
    { count: openIncidents },
    { count: criticalIncidents },
    { data: recentIncidents },
    { data: recentSecurityEvents },
    { count: openPRs },
  ] = await Promise.all([
    fetchAllProjects(),
    fetchAllDeployments(20),
    supabase.from("incidents").select("*", { count: "exact", head: true }).in("status", ["open", "investigating"]),
    supabase.from("incidents").select("*", { count: "exact", head: true }).eq("severity", "critical").in("status", ["open", "investigating"]),
    supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("security_events").select("*").eq("acknowledged", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("pull_requests").select("*", { count: "exact", head: true }).eq("status", "open"),
  ])

  // Auto-sync projects
  if (projects.length > 0) {
    try {
      const sb = await createSBClient()
      await sb.from("monitored_projects").upsert(
        projects.map((p) => ({
          vercel_project_id: p.id,
          name: p.name,
          github_repo: p.link?.repo ?? null,
          github_owner: p.link?.org ?? null,
          github_branch: p.link?.productionBranch ?? "main",
          framework: p.framework ?? null,
          status: "active",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "vercel_project_id" }
      )
    } catch (_) {}
  }

  const deps = allDeployments as VercelDeployment[]
  const activeBuilds = deps.filter((d) => normalizeState(d.state) === "building").length

  return {
    totalProjects: projects.length,
    activeDeployments: activeBuilds,
    openIncidents: openIncidents ?? 0,
    criticalIncidents: criticalIncidents ?? 0,
    openPRs: openPRs ?? 0,
    recentDeployments: deps.slice(0, 6),
    recentIncidents: (recentIncidents ?? []) as Incident[],
    recentSecurityEvents: (recentSecurityEvents ?? []) as SecurityEvent[],
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default async function OverviewPage() {
  const data = await getDashboardData()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI DevOps agent monitoring your Vercel infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-card border border-border px-3 py-1.5 rounded-md">
          <RefreshCw className="w-3 h-3" />
          Auto-refresh every 30s
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monitored Projects"
          value={data.totalProjects}
          icon={Activity}
          trend="Connected to Vercel"
          accent="info"
        />
        <StatCard
          title="Active Builds"
          value={data.activeDeployments}
          icon={Rocket}
          trend="Currently building"
          accent={data.activeDeployments > 0 ? "info" : "default"}
        />
        <StatCard
          title="Open Incidents"
          value={data.openIncidents}
          icon={AlertTriangle}
          trend={`${data.criticalIncidents} critical`}
          accent={data.criticalIncidents > 0 ? "error" : data.openIncidents > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Open PRs"
          value={data.openPRs}
          icon={GitPullRequest}
          trend="Agent-raised fixes"
          accent={data.openPRs > 0 ? "warning" : "default"}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Deployments */}
        <div className="bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Recent Deployments</h2>
            </div>
            <Link href="/deployments" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.recentDeployments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No deployments found.
              </div>
            ) : (
              data.recentDeployments.map((dep) => {
                const status = normalizeState(dep.state)
                const mins = Math.floor((Date.now() - dep.createdAt) / 60000)
                const timeStr = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ago`
                return (
                  <div key={dep.uid} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{dep.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        {dep.meta?.githubCommitMessage ?? dep.meta?.githubCommitRef ?? dep.uid.slice(0, 12)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3 shrink-0">
                      <StatusBadge type="deployment" value={status} />
                      <span className="text-xs text-muted-foreground font-mono">{timeStr}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Open Incidents */}
        <div className="bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Active Incidents</h2>
            </div>
            <Link href="/incidents" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.recentIncidents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No open incidents. All systems operational.
              </div>
            ) : (
              data.recentIncidents.map((inc) => (
                <div key={inc.id} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug">{inc.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo(inc.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge type="severity" value={inc.severity} />
                      <StatusBadge type="incident" value={inc.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Security Feed */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Security Feed</h2>
            {data.recentSecurityEvents.length > 0 && (
              <span className="text-[10px] font-mono bg-status-error/10 text-status-error border border-status-error/20 px-1.5 py-0.5 rounded">
                {data.recentSecurityEvents.length} unread
              </span>
            )}
          </div>
          <Link href="/security" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {data.recentSecurityEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No new security events.
            </div>
          ) : (
            data.recentSecurityEvents.map((evt) => (
              <div key={evt.id} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
                <StatusBadge type="severity" value={evt.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{evt.title}</p>
                  {evt.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{evt.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {evt.source && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                      {evt.source}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">{timeAgo(evt.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
