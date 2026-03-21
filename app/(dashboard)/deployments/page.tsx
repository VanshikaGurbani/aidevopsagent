import { StatusBadge } from "@/components/dashboard/status-badge"
import { Rocket, GitBranch, Clock, ExternalLink } from "lucide-react"
import Link from "next/link"
import { fetchAllProjects, fetchAllDeployments, normalizeState, type VercelDeployment, type VercelProject } from "@/lib/vercel"
import { createClient } from "@/lib/supabase/server"

export const revalidate = 30

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDuration(start: number | undefined, end: number | undefined) {
  if (!start || !end) return "—"
  const ms = end - start
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

async function syncProjectsToDB(projects: VercelProject[]) {
  try {
    const supabase = await createClient()
    const rows = projects.map((p) => ({
      vercel_project_id: p.id,
      name: p.name,
      github_repo: p.link?.repo ?? null,
      github_owner: p.link?.org ?? null,
      github_branch: p.link?.productionBranch ?? "main",
      framework: p.framework ?? null,
      status: "active",
      updated_at: new Date().toISOString(),
    }))
    await supabase.from("monitored_projects").upsert(rows, { onConflict: "vercel_project_id" })
  } catch (_) {}
}

export default async function DeploymentsPage() {
  const [projects, deployments] = await Promise.all([
    fetchAllProjects(),
    fetchAllDeployments(50),
  ])

  // Auto-sync all Vercel projects to DB (fire and don't block render)
  syncProjectsToDB(projects)

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))

  const deps = deployments as VercelDeployment[]
  const totalReady = deps.filter((d) => normalizeState(d.state) === "ready").length
  const totalError = deps.filter((d) => normalizeState(d.state) === "error").length
  const totalBuilding = deps.filter((d) => normalizeState(d.state) === "building").length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Deployments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All deployments across your Vercel projects</p>
        </div>
        <Link
          href="/agent"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Rocket className="w-3.5 h-3.5" />
          Ask Agent to Deploy
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Successful", count: totalReady, accent: "text-status-success border-status-success/30 bg-status-success/5" },
          { label: "Failed", count: totalError, accent: "text-status-error border-status-error/30 bg-status-error/5" },
          { label: "Building", count: totalBuilding, accent: "text-status-info border-status-info/30 bg-status-info/5" },
        ].map(({ label, count, accent }) => (
          <div key={label} className={`flex items-center justify-between px-4 py-3 rounded-lg border font-mono ${accent}`}>
            <span className="text-xs">{label}</span>
            <span className="text-2xl font-semibold">{count}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Rocket className="w-4 h-4 text-muted-foreground" />
            Deployment History
          </h2>
        </div>

        {deps.length === 0 ? (
          <div className="py-16 text-center">
            <Rocket className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No deployments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Project</th>
                  <th className="text-left px-4 py-2.5 font-medium">Commit</th>
                  <th className="text-left px-4 py-2.5 font-medium">Branch</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Target</th>
                  <th className="text-left px-4 py-2.5 font-medium">Duration</th>
                  <th className="text-left px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deps.map((dep) => {
                  const project = projectMap[dep.name] ?? null
                  const status = normalizeState(dep.state)
                  return (
                    <tr key={dep.uid} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{dep.name}</p>
                        {project?.framework && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{project.framework}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-xs text-foreground truncate">{dep.meta?.githubCommitMessage ?? "—"}</p>
                        {dep.meta?.githubCommitSha && (
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{dep.meta.githubCommitSha.slice(0, 7)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {dep.meta?.githubCommitRef ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                            <GitBranch className="w-3 h-3" />{dep.meta.githubCommitRef}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="deployment" value={status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${dep.target === "production" ? "bg-status-success/10 text-status-success" : "bg-muted/30 text-muted-foreground"}`}>
                          {dep.target ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDuration(dep.buildingAt, dep.ready)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {timeAgo(dep.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {dep.url && (
                          <a href={`https://${dep.url}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
